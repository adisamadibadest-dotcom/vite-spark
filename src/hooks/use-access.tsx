import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";

type Subscription = {
  id: string;
  plan: string;
  status: string;
  starts_at: string;
  expires_at: string;
};

const ADMIN_EMAIL = "apexgoldaiteam1@gmail.com";

async function fetchLocalSubscription(userId: string): Promise<Subscription | null> {
  try {
    const res = await fetch(`/api/mpesa/subscription?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    const data = (await res.json()) as { subscription: Subscription | null };
    return data.subscription ?? null;
  } catch {
    return null;
  }
}

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
        const emailAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;

        if (isSupabaseConfigured) {
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

          const supabaseSub = (subs as Subscription[])[0] ?? null;

          const localSub = !supabaseSub ? await fetchLocalSubscription(user.id) : null;

          if (!cancelled) {
            setIsAdmin(emailAdmin || repairedAdminRole === true || (roles as Array<{ role: string }>).some((r) => r.role === "admin"));
            setSubscription(supabaseSub ?? localSub);
          }
        } else {
          const localSub = await fetchLocalSubscription(user.id);
          if (!cancelled) {
            setIsAdmin(emailAdmin);
            setSubscription(localSub);
          }
        }
      } catch {
        if (cancelled) return;
        const emailAdmin = user.email?.toLowerCase() === ADMIN_EMAIL;
        const localSub = await fetchLocalSubscription(user.id).catch(() => null);
        if (!cancelled) {
          setIsAdmin(emailAdmin);
          setSubscription(localSub);
        }
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
