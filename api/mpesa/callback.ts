import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, ensureTransactionsTable } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

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

    const { CheckoutRequestID: checkoutRequestId, ResultCode: resultCode, ResultDesc: resultDesc = "" } = cb;

    await ensureTransactionsTable();

    if (resultCode !== 0) {
      console.log(`[mpesa/callback] Payment failed: ${resultDesc} (${resultCode})`);
      await getPool().query(
        `UPDATE mpesa_transactions SET status='failed', updated_at=now()
         WHERE checkout_request_id=$1 AND status='pending'`,
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
       SET status='completed', mpesa_receipt=$1, activated_at=now(),
           expires_at=now() + (days * interval '1 day'), updated_at=now()
       WHERE checkout_request_id=$2 AND status='pending'
       RETURNING id, user_email, package_name`,
      [receipt, checkoutRequestId]
    );

    if ((txResult.rowCount ?? 0) === 0) {
      console.warn(`[mpesa/callback] No pending tx for checkout: ${checkoutRequestId}`);
      return;
    }

    const tx = txResult.rows[0] as { id: string; user_email: string; package_name: string };
    console.log(`[mpesa/callback] ✓ Payment complete: receipt=${receipt} user=${tx.user_email} plan=${tx.package_name}`);
  } catch (e) {
    console.error("[mpesa/callback] Error:", e);
  }
}
