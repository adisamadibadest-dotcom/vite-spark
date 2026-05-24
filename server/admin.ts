import { createClient } from "@supabase/supabase-js";
import type { Request, Response, Express } from "express";
import pkg from "pg";

const { Pool } = pkg;

const ADMIN_EMAIL = "apexgoldaiteam1@gmail.com";

let _pool: InstanceType<typeof Pool> | null = null;
function getPool() {
  if (!_pool) _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 3000,
    idleTimeoutMillis: 10000,
    max: 3,
  });
  return _pool;
}

async function ensureAuditTable() {
  await getPool().query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id         SERIAL PRIMARY KEY,
      action     TEXT        NOT NULL,
      target_email TEXT,
      plan       TEXT,
      days       INT,
      expires_at TIMESTAMPTZ,
      sub_id     TEXT,
      performed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function writeAudit(entry: {
  action: string;
  target_email?: string;
  plan?: string;
  days?: number;
  expires_at?: string;
  sub_id?: string;
}) {
  try {
    await ensureAuditTable();
    await getPool().query(
      `INSERT INTO admin_audit_log (action, target_email, plan, days, expires_at, sub_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        entry.action,
        entry.target_email ?? null,
        entry.plan ?? null,
        entry.days ?? null,
        entry.expires_at ?? null,
        entry.sub_id ?? null,
      ]
    );
  } catch (e) {
    console.error("[audit] write failed:", e);
  }
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function verifyAdminJwt(authHeader: string | undefined): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  if (!authHeader?.startsWith("Bearer ")) return { ok: false, error: "Missing or invalid Authorization header." };
  const token = authHeader.slice(7);
  try {
    const { data, error } = await getAdminClient().auth.getUser(token);
    if (error || !data?.user?.email) return { ok: false, error: "Invalid or expired token." };
    return { ok: true, email: data.user.email };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Token verification failed." };
  }
}

export function registerAdminRoutes(app: Express) {
  app.post("/api/admin/grant-subscription", async (req: Request, res: Response) => {
    const verified = await verifyAdminJwt(req.headers.authorization);
    if (!verified.ok) { res.status(401).json({ error: verified.error }); return; }
    if (verified.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) { res.status(403).json({ error: "Forbidden: admin only." }); return; }

    const { email, plan, days } = req.body as { email?: string; plan?: string; days?: number };
    if (!email || !plan || typeof days !== "number") { res.status(400).json({ error: "email, plan, and days are required." }); return; }

    try {
      const admin = getAdminClient();
      const { data: prof, error: profErr } = await admin
        .from("profiles")
        .select("id")
        .ilike("email", email.trim())
        .maybeSingle();
      if (profErr) { res.status(500).json({ error: profErr.message }); return; }
      if (!prof) { res.status(404).json({ error: `No registered user found with email "${email.trim()}". Make sure they have signed up first.` }); return; }

      const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
      const { data: newSub, error: insertErr } = await admin
        .from("subscriptions")
        .insert({ user_id: prof.id, plan, status: "active", expires_at: expires })
        .select("id")
        .single();
      if (insertErr) { res.status(500).json({ error: insertErr.message }); return; }

      void writeAudit({ action: "grant", target_email: email.trim().toLowerCase(), plan, days, expires_at: expires, sub_id: newSub?.id });
      res.json({ ok: true, expires });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Server error." });
    }
  });

  app.get("/api/admin/subscriptions", async (req: Request, res: Response) => {
    const verified = await verifyAdminJwt(req.headers.authorization);
    if (!verified.ok) { res.status(401).json({ error: verified.error }); return; }
    if (verified.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) { res.status(403).json({ error: "Forbidden: admin only." }); return; }

    try {
      const admin = getAdminClient();
      const { data: subs, error: subsErr } = await admin
        .from("subscriptions").select("id, user_id, plan, status, expires_at")
        .order("expires_at", { ascending: false }).limit(50);
      if (subsErr) { res.status(500).json({ error: subsErr.message }); return; }

      const ids = Array.from(new Set((subs ?? []).map((s) => s.user_id)));
      let emailMap = new Map<string, string>();
      if (ids.length > 0) {
        const { data: profs } = await admin.from("profiles").select("id, email").in("id", ids);
        emailMap = new Map((profs ?? []).map((p) => [p.id, p.email]));
      }
      res.json((subs ?? []).map((s) => ({ ...s, email: emailMap.get(s.user_id) })));
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Server error." });
    }
  });

  app.post("/api/admin/terminate-subscription", async (req: Request, res: Response) => {
    const verified = await verifyAdminJwt(req.headers.authorization);
    if (!verified.ok) { res.status(401).json({ error: verified.error }); return; }
    if (verified.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) { res.status(403).json({ error: "Forbidden: admin only." }); return; }

    const { id, email } = req.body as { id?: string; email?: string };
    if (!id) { res.status(400).json({ error: "id is required." }); return; }

    try {
      const { error } = await getAdminClient()
        .from("subscriptions")
        .update({ status: "terminated", expires_at: new Date().toISOString() })
        .eq("id", id);
      if (error) { res.status(500).json({ error: error.message }); return; }

      void writeAudit({ action: "terminate", target_email: email, sub_id: id });
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ error: e instanceof Error ? e.message : "Server error." });
    }
  });

  app.get("/api/admin/audit-log", async (req: Request, res: Response) => {
    const verified = await verifyAdminJwt(req.headers.authorization);
    if (!verified.ok) { res.status(401).json({ error: verified.error }); return; }
    if (verified.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) { res.status(403).json({ error: "Forbidden: admin only." }); return; }

    try {
      await ensureAuditTable();
      const result = await getPool().query(
        `SELECT id, action, target_email, plan, days, expires_at, sub_id, performed_at
         FROM admin_audit_log
         ORDER BY performed_at DESC
         LIMIT 100`
      );
      res.json(result.rows);
    } catch (e) {
      console.error("[audit-log] DB unavailable, returning empty:", e);
      res.json([]);
    }
  });
}
