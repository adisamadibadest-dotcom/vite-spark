import pkg from "pg";
const { Pool } = pkg;

let _pool: InstanceType<typeof Pool> | null = null;

export function getPool() {
  if (!_pool) {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
    _pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      max: 3,
      ssl: { rejectUnauthorized: false },
    });
  }
  return _pool;
}

export async function ensureTransactionsTable() {
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

export function getMpesaEnv() {
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

export async function getAccessToken(): Promise<string> {
  const { baseUrl } = getMpesaEnv();
  const consumerKey = process.env.MPESA_CONSUMER_KEY;
  const consumerSecret = process.env.MPESA_CONSUMER_SECRET;
  if (!consumerKey || !consumerSecret) {
    throw new Error("Missing MPESA_CONSUMER_KEY or MPESA_CONSUMER_SECRET.");
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

export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
  throw new Error("Invalid phone number. Use format: 07XXXXXXXX or 254XXXXXXXXX");
}

export function getTimestamp(): string {
  return new Date().toISOString().replace(/[-:T.Z]/g, "").slice(0, 14);
}

export function getCallbackUrl(): string {
  if (process.env.MPESA_CALLBACK_URL) return process.env.MPESA_CALLBACK_URL;
  return "https://apexgoldai.online/api/mpesa/callback";
}

export const PACKAGES: Record<string, { name: string; usd: number; days: number }> = {
  "1-week":  { name: "1 Week Premium",  usd: 7,  days: 7  },
  "2-weeks": { name: "2 Weeks Premium", usd: 14, days: 14 },
  "1-month": { name: "1 Month Premium", usd: 28, days: 30 },
};
