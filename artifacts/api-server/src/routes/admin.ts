import { Router, type IRouter, type Request, type Response } from "express";
import { createClient } from "@supabase/supabase-js";

const router: IRouter = Router();

const ADMIN_EMAIL = "apexgoldaiteam1@gmail.com";

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.");
  }
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

async function verifyAdminJwt(authHeader: string | undefined): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, error: "Missing or invalid Authorization header." };
  }
  const token = authHeader.slice(7);
  try {
    const admin = getAdminClient();
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user?.email) {
      return { ok: false, error: "Invalid or expired token." };
    }
    return { ok: true, email: data.user.email };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Token verification failed." };
  }
}

router.post("/admin/grant-subscription", async (req: Request, res: Response) => {
  const verified = await verifyAdminJwt(req.headers.authorization);
  if (!verified.ok) {
    res.status(401).json({ error: verified.error });
    return;
  }
  if (verified.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    res.status(403).json({ error: "Forbidden: admin only." });
    return;
  }

  const { email, plan, days } = req.body as { email?: string; plan?: string; days?: number };
  if (!email || !plan || typeof days !== "number") {
    res.status(400).json({ error: "email, plan, and days are required." });
    return;
  }

  try {
    const admin = getAdminClient();
    const normalizedEmail = email.trim().toLowerCase();

    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("id")
      .ilike("email", normalizedEmail)
      .maybeSingle();

    if (profErr) {
      res.status(500).json({ error: profErr.message });
      return;
    }

    if (!prof) {
      res.status(404).json({ error: `No registered user found with email "${normalizedEmail}". Make sure they have signed up first.` });
      return;
    }

    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const { error: insertErr } = await admin.from("subscriptions").insert({
      user_id: prof.id,
      plan,
      status: "active",
      expires_at: expires,
    });

    if (insertErr) {
      res.status(500).json({ error: insertErr.message });
      return;
    }

    res.json({ ok: true, expires });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Server error." });
  }
});

router.get("/admin/subscriptions", async (req: Request, res: Response) => {
  const verified = await verifyAdminJwt(req.headers.authorization);
  if (!verified.ok) {
    res.status(401).json({ error: verified.error });
    return;
  }
  if (verified.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    res.status(403).json({ error: "Forbidden: admin only." });
    return;
  }

  try {
    const admin = getAdminClient();

    const { data: subs, error: subsErr } = await admin
      .from("subscriptions")
      .select("id, user_id, plan, status, expires_at")
      .order("expires_at", { ascending: false })
      .limit(50);

    if (subsErr) {
      res.status(500).json({ error: subsErr.message });
      return;
    }

    const ids = Array.from(new Set((subs ?? []).map((s) => s.user_id)));
    let emailMap = new Map<string, string>();
    if (ids.length > 0) {
      const { data: profs } = await admin
        .from("profiles")
        .select("id, email")
        .in("id", ids);
      emailMap = new Map((profs ?? []).map((p) => [p.id, p.email]));
    }

    const result = (subs ?? []).map((s) => ({ ...s, email: emailMap.get(s.user_id) }));
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Server error." });
  }
});

router.post("/admin/terminate-subscription", async (req: Request, res: Response) => {
  const verified = await verifyAdminJwt(req.headers.authorization);
  if (!verified.ok) {
    res.status(401).json({ error: verified.error });
    return;
  }
  if (verified.email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    res.status(403).json({ error: "Forbidden: admin only." });
    return;
  }

  const { id } = req.body as { id?: string };
  if (!id) {
    res.status(400).json({ error: "id is required." });
    return;
  }

  try {
    const admin = getAdminClient();
    const { error } = await admin
      .from("subscriptions")
      .update({ status: "terminated", expires_at: new Date().toISOString() })
      .eq("id", id);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : "Server error." });
  }
});

export default router;
