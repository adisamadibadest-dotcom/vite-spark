import type { Request, Response, Express } from "express";
import pkg from "pg";

const { Pool } = pkg;

let _pool: InstanceType<typeof Pool> | null = null;
function getPool() {
  if (!_pool)
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      max: 5,
    });
  return _pool;
}

async function ensureTransactionsTable() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS mpesa_transactions (
      id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      user_id             TEXT NOT NULL,
      user_email          TEXT NOT NULL,
      package_id          TEXT NOT NULL,
      package_name        TEXT NOT NULL,
      amount_usd          NUMERIC NOT NULL,
      amount_kes          NUMERIC NOT NULL,
      phone               TEXT NOT NULL,
      merchant_request_id TEXT,
      checkout_request_id TEXT UNIQUE,
      mpesa_receipt       TEXT,
      status              TEXT NOT NULL DEFAULT 'pending',
      days                INTEGER NOT NULL,
      activated_at        TIMESTAMPTZ,
      expires_at          TIMESTAMPTZ,
      created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

function getMpesaEnv() {
  const env = (process.env.MPESA_ENV ?? "sandbox").toLowerCase();
  if (env === "sandbox") {
    return {
      baseUrl: "https://sandbox.safaricom.co.ke",
      shortcode: process.env.MPESA_SHORTCODE ?? "174379",
      passkey: process.env.MPESA_PASSKEY ?? "bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919",
    };
  }
  return {
    baseUrl: "https://api.safaricom.co.ke",
    shortcode: process.env.MPESA_SHORTCODE ?? "",
    passkey: process.env.MPESA_PASSKEY ?? "",
  };
}

async function getAccessToken(): Promise<string> {
  const { baseUrl } = getMpesaEnv();
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    throw new Error("M-Pesa credentials not configured. Please set MPESA_CONSUMER_KEY and MPESA_CONSUMER_SECRET.");
  }
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const res = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`M-Pesa auth failed: ${text}`);
  }
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
  throw new Error("Invalid phone number. Use format: 07XXXXXXXX or 254XXXXXXXXX");
}

function getTimestamp(): string {
  return new Date()
    .toISOString()
    .replace(/[-:T.Z]/g, "")
    .slice(0, 14);
}

function getCallbackUrl(): string {
  if (process.env.MPESA_CALLBACK_URL) return process.env.MPESA_CALLBACK_URL;
  const domain = process.env.REPLIT_DEV_DOMAIN ?? process.env.REPL_SLUG;
  if (domain) return `https://${domain}/api/mpesa/callback`;
  return "https://apexgold-ai.replit.app/api/mpesa/callback";
}

async function initiateSTKPush(opts: {
  phone: string;
  amountKes: number;
  packageName: string;
  transactionId: string;
}): Promise<{ merchantRequestId: string; checkoutRequestId: string }> {
  const { baseUrl, shortcode, passkey } = getMpesaEnv();
  const timestamp = getTimestamp();
  const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
  const token = await getAccessToken();
  const formattedPhone = formatPhone(opts.phone);
  const amount = Math.ceil(opts.amountKes);

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: amount,
    PartyA: formattedPhone,
    PartyB: shortcode,
    PhoneNumber: formattedPhone,
    CallBackURL: getCallbackUrl(),
    AccountReference: `APEXGOLD-${opts.transactionId.slice(0, 8).toUpperCase()}`,
    TransactionDesc: `ApexGold ${opts.packageName}`,
  };

  const res = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = (await res.json()) as {
    ResponseCode?: string;
    MerchantRequestID?: string;
    CheckoutRequestID?: string;
    CustomerMessage?: string;
    ResponseDescription?: string;
    errorMessage?: string;
  };

  if (!res.ok || data.ResponseCode !== "0") {
    throw new Error(data.errorMessage ?? data.ResponseDescription ?? "STK push failed");
  }

  return {
    merchantRequestId: data.MerchantRequestID!,
    checkoutRequestId: data.CheckoutRequestID!,
  };
}

const PACKAGES: Record<string, { name: string; usd: number; days: number }> = {
  "1-week": { name: "1 Week Premium", usd: 7, days: 7 },
  "2-weeks": { name: "2 Weeks Premium", usd: 14, days: 14 },
  "1-month": { name: "1 Month Premium", usd: 28, days: 30 },
};

export function registerMpesaRoutes(app: Express) {
  app.post("/api/mpesa/stk-push", async (req: Request, res: Response) => {
    const { phone, packageId, userId, userEmail, amountKes } = req.body as {
      phone?: string;
      packageId?: string;
      userId?: string;
      userEmail?: string;
      amountKes?: number;
    };

    if (!phone || !packageId || !userId || !userEmail || !amountKes) {
      res.status(400).json({ error: "phone, packageId, userId, userEmail, and amountKes are required." });
      return;
    }

    const pkg = PACKAGES[packageId];
    if (!pkg) {
      res.status(400).json({ error: "Invalid package." });
      return;
    }

    try {
      await ensureTransactionsTable();

      const txId = crypto.randomUUID();
      const { merchantRequestId, checkoutRequestId } = await initiateSTKPush({
        phone,
        amountKes: Math.ceil(amountKes),
        packageName: pkg.name,
        transactionId: txId,
      });

      await getPool().query(
        `INSERT INTO mpesa_transactions
          (id, user_id, user_email, package_id, package_name, amount_usd, amount_kes, phone, merchant_request_id, checkout_request_id, status, days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11)`,
        [txId, userId, userEmail, packageId, pkg.name, pkg.usd, Math.ceil(amountKes), phone, merchantRequestId, checkoutRequestId, pkg.days]
      );

      res.json({ ok: true, transactionId: txId, checkoutRequestId });
    } catch (e) {
      console.error("[mpesa/stk-push]", e);
      res.status(500).json({ error: e instanceof Error ? e.message : "Failed to initiate payment." });
    }
  });

  app.post("/api/mpesa/callback", async (req: Request, res: Response) => {
    res.json({ ResultCode: 0, ResultDesc: "Accepted" });

    try {
      const body = req.body as {
        Body?: {
          stkCallback?: {
            MerchantRequestID?: string;
            CheckoutRequestID?: string;
            ResultCode?: number;
            ResultDesc?: string;
            CallbackMetadata?: {
              Item?: Array<{ Name: string; Value?: string | number }>;
            };
          };
        };
      };

      const cb = body?.Body?.stkCallback;
      if (!cb) { console.warn("[mpesa/callback] No stkCallback in body"); return; }

      const checkoutRequestId = cb.CheckoutRequestID;
      const resultCode = cb.ResultCode;
      const resultDesc = cb.ResultDesc ?? "";

      await ensureTransactionsTable();

      if (resultCode !== 0) {
        console.log(`[mpesa/callback] Payment failed: ${resultDesc} (${resultCode})`);
        await getPool().query(
          `UPDATE mpesa_transactions SET status='failed', updated_at=now() WHERE checkout_request_id=$1 AND status='pending'`,
          [checkoutRequestId]
        );
        return;
      }

      const items = cb.CallbackMetadata?.Item ?? [];
      const getItem = (name: string) => items.find((i) => i.Name === name)?.Value;
      const receipt = String(getItem("MpesaReceiptNumber") ?? "");

      const dup = await getPool().query(
        `SELECT id FROM mpesa_transactions WHERE mpesa_receipt=$1 AND status='completed' LIMIT 1`,
        [receipt]
      );
      if ((dup.rowCount ?? 0) > 0) {
        console.warn(`[mpesa/callback] Duplicate receipt: ${receipt}`);
        return;
      }

      const txResult = await getPool().query(
        `UPDATE mpesa_transactions
         SET status='completed', mpesa_receipt=$1, activated_at=now(), expires_at=now() + (days * interval '1 day'), updated_at=now()
         WHERE checkout_request_id=$2 AND status='pending'
         RETURNING id, user_id, user_email, package_name, days`,
        [receipt, checkoutRequestId]
      );

      if ((txResult.rowCount ?? 0) === 0) {
        console.warn(`[mpesa/callback] No pending tx for checkout: ${checkoutRequestId}`);
        return;
      }

      const tx = txResult.rows[0] as { id: string; user_id: string; user_email: string; package_name: string; days: number };
      console.log(`[mpesa/callback] ✓ Payment complete: receipt=${receipt} user=${tx.user_email} plan=${tx.package_name}`);
    } catch (e) {
      console.error("[mpesa/callback] Error processing callback:", e);
    }
  });

  app.get("/api/mpesa/status/:checkoutRequestId", async (req: Request, res: Response) => {
    const { checkoutRequestId } = req.params;
    if (!checkoutRequestId) { res.status(400).json({ error: "checkoutRequestId required" }); return; }

    try {
      await ensureTransactionsTable();
      const result = await getPool().query(
        `SELECT id, status, mpesa_receipt, package_name, days, activated_at, expires_at, amount_usd, amount_kes
         FROM mpesa_transactions WHERE checkout_request_id=$1 LIMIT 1`,
        [checkoutRequestId]
      );
      if (result.rowCount === 0) { res.status(404).json({ error: "Transaction not found." }); return; }
      res.json(result.rows[0]);
    } catch (e) {
      console.error("[mpesa/status]", e);
      res.status(500).json({ error: "Failed to fetch status." });
    }
  });

  app.get("/api/mpesa/subscription", async (req: Request, res: Response) => {
    const userId = req.query.userId as string | undefined;
    if (!userId) { res.status(400).json({ error: "userId required" }); return; }

    try {
      await ensureTransactionsTable();
      const result = await getPool().query(
        `SELECT id, package_name AS plan, 'active' AS status, activated_at AS starts_at, expires_at
         FROM mpesa_transactions
         WHERE user_id=$1
           AND status='completed'
           AND expires_at > now()
         ORDER BY expires_at DESC
         LIMIT 1`,
        [userId]
      );
      if (result.rowCount === 0) {
        res.json({ subscription: null });
        return;
      }
      res.json({ subscription: result.rows[0] });
    } catch (e) {
      console.error("[mpesa/subscription]", e);
      res.status(500).json({ error: "Failed to fetch subscription." });
    }
  });

  app.get("/api/mpesa/config", (_req: Request, res: Response) => {
    const configured = !!(
      process.env.MPESA_CONSUMER_KEY &&
      process.env.MPESA_CONSUMER_SECRET
    );
    const env = process.env.MPESA_ENV ?? "sandbox";
    res.json({ configured, env });
  });

  app.get("/api/exchange-rate/usd-kes", async (_req: Request, res: Response) => {
    const FALLBACK_RATE = 130;
    try {
      const r = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
      if (r.ok) {
        const d = (await r.json()) as { rates?: { KES?: number } };
        const rate = d.rates?.KES;
        if (rate && rate > 50) { res.json({ rate, source: "live" }); return; }
      }
    } catch {
      // fall through to fallback
    }
    res.json({ rate: FALLBACK_RATE, source: "fallback" });
  });
}
