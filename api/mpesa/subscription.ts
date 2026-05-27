import type { VercelRequest, VercelResponse } from "@vercel/node";
import { getPool, ensureTransactionsTable } from "./_db.js";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const userId = req.query.userId as string | undefined;
  if (!userId) return res.status(400).json({ error: "userId required" });

  try {
    await ensureTransactionsTable();
    const result = await getPool().query(
      `SELECT id, package_name AS plan, 'active' AS status, activated_at AS starts_at, expires_at
       FROM mpesa_transactions
       WHERE user_id=$1 AND status='completed' AND expires_at > now()
       ORDER BY expires_at DESC LIMIT 1`,
      [userId]
    );
    return res.json({ subscription: result.rows[0] ?? null });
  } catch (e) {
    console.error("[mpesa/subscription]", e);
    return res.status(500).json({ error: "Failed to fetch subscription." });
  }
}
