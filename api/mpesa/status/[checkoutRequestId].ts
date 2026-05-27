import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, ensureTransactionsTable } from "../_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { checkoutRequestId } = req.query;
  if (!checkoutRequestId || typeof checkoutRequestId !== "string") {
    return res.status(400).json({ error: "checkoutRequestId required" });
  }

  try {
    await ensureTransactionsTable();
    const result = await getPool().query(
      `SELECT id, status, mpesa_receipt, package_name, days, activated_at, expires_at, amount_usd, amount_kes
       FROM mpesa_transactions WHERE checkout_request_id=$1 LIMIT 1`,
      [checkoutRequestId]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Transaction not found." });
    }
    return res.json(result.rows[0]);
  } catch (e) {
    console.error("[mpesa/status]", e);
    return res.status(500).json({ error: "Failed to fetch status." });
  }
}
