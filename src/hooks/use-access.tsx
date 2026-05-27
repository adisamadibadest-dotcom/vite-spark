import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

type Subscription = {
  id: string;
  plan: string;
  status: string;
  starts_at: string;
  expires_at: string;
};

const ADMIN_EMAIL = "apexgoldaiteam1@gmail.com";

export function useAccess() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshIdx, setRefreshIdx] = useState(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) { setIsAdmin(false); setSubscription(null); setLoading(false); return; }

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [rolesResult, rpcResult, subsResult] = await Promise.allSettled([
          supabase.from("user_roles").select("role").eq("user_id", user.id),
          supabase.rpc("ensure_admin_role"),
          supabase
            .from("subscriptions")
            .select("id, plan, status, starts_at, expires_at")
            .eq("user_id", user.id)
            .eq("status", "active")
            .gt("expires_at", new Date().toISOString())
            .order("expires_at", { ascending: false })
            .limit(1),
        ]);
        if (cancelled) return;

        const roles = rolesResult.status === "fulfilled" ? (rolesResult.value.data ?? []) : [];
        const repairedAdminRole = rpcResult.status === "fulfilled" ? rpcResult.value.data : null;
        const subs = subsResult.status === "fulfilled" ? (subsResult.value.data ?? []) : [];

        const emailAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
        setIsAdmin(emailAdmin || repairedAdminRole === true || (roles as Array<{ role: string }>).some((r) => r.role === "admin"));
        setSubscription((subs as Subscription[])[0] ?? null);
      } catch {
        if (cancelled) return;
        const emailAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
        setIsAdmin(emailAdmin);
        setSubscription(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user, authLoading, refreshIdx]);

  const hasActiveSubscription = !!subscription;
  const unlimited = isAdmin || hasActiveSubscription;

  return {
    isAdmin,
    subscription,
    hasActiveSubscription,
    unlimited,
    loading,
    refresh: () => setRefreshIdx((i) => i + 1),
  };
}
