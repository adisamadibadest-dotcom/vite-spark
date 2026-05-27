import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  getPool, ensureTransactionsTable, getMpesaEnv, getAccessToken,
  formatPhone, getTimestamp, getCallbackUrl, PACKAGES,
} from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { phone, packageId, userId, userEmail, amountKes } = req.body as {
    phone?: string;
    packageId?: string;
    userId?: string;
    userEmail?: string;
    amountKes?: number;
  };

  if (!phone || !packageId || !userId || !userEmail || !amountKes) {
    return res.status(400).json({ error: "phone, packageId, userId, userEmail, and amountKes are required." });
  }

  const pkg = PACKAGES[packageId];
  if (!pkg) return res.status(400).json({ error: "Invalid package." });

  try {
    await ensureTransactionsTable();

    const { baseUrl, shortcode, passkey } = getMpesaEnv();
    const timestamp = getTimestamp();
    const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString("base64");
    const token = await getAccessToken();
    const formattedPhone = formatPhone(phone);
    const amount = Math.ceil(amountKes);
    const txId = crypto.randomUUID();

    const stkBody = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline",
      Amount: amount,
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: getCallbackUrl(),
      AccountReference: `APEXGOLD-${txId.slice(0, 8).toUpperCase()}`,
      TransactionDesc: `ApexGold ${pkg.name}`,
    };

    const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(stkBody),
    });

    const data = (await stkRes.json()) as {
      ResponseCode?: string;
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResponseDescription?: string;
      errorMessage?: string;
    };

    if (!stkRes.ok || data.ResponseCode !== "0") {
      throw new Error(data.errorMessage ?? data.ResponseDescription ?? "STK push failed");
    }

    await getPool().query(
      `INSERT INTO mpesa_transactions
        (id, user_id, user_email, package_id, package_name, amount_usd, amount_kes, phone,
         merchant_request_id, checkout_request_id, status, days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',$11)`,
      [txId, userId, userEmail, packageId, pkg.name, pkg.usd, amount, phone,
       data.MerchantRequestID, data.CheckoutRequestID, pkg.days]
    );

    return res.json({ ok: true, transactionId: txId, checkoutRequestId: data.CheckoutRequestID });
  } catch (e) {
    console.error("[mpesa/stk-push]", e);
    return res.status(500).json({ error: e instanceof Error ? e.message : "Failed to initiate payment." });
  }
}
