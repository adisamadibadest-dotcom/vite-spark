import { useState, useEffect } from "react";
import {
  ShieldCheck, Search, Check, X, Loader2, Users, Clock, RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/hooks/use-access";
import { toast } from "sonner";

type PaymentSubmission = {
  id: string;
  email: string;
  package: string;
  price: number;
  duration_days: number;
  transaction_code: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
};

type ActiveSub = {
  id: string;
  user_id: string;
  plan: string;
  status: string;
  starts_at: string;
  expires_at: string;
  email?: string;
};

const PLAN_DAYS: Record<string, number> = {
  "1 Week Access":  7,
  "2 Weeks Access": 14,
  "1 Month Access": 30,
};

export function AdminPanel() {
  const { isAdmin, loading } = useAccess();
  const [tab, setTab] = useState<"submissions" | "active">("submissions");
  const [submissions, setSubmissions] = useState<PaymentSubmission[]>([]);
  const [activeSubs, setActiveSubs] = useState<ActiveSub[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("pending");
  const [busy, setBusy] = useState<string | null>(null);
  const [dataLoading, setDataLoading] = useState(true);

  const loadData = async () => {
    setDataLoading(true);
    const [{ data: subs }, { data: subData }] = await Promise.all([
      supabase
        .from("payment_submissions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("subscriptions")
        .select("id, user_id, plan, status, starts_at, expires_at")
        .order("expires_at", { ascending: false })
        .limit(200),
    ]);

    setSubmissions((subs ?? []) as PaymentSubmission[]);

    if (subData && subData.length > 0) {
      const ids = [...new Set(subData.map((s) => s.user_id))];
      const { data: profs } = await supabase.from("profiles").select("id, email").in("id", ids);
      const map = new Map((profs ?? []).map((p) => [p.id, p.email]));
      setActiveSubs(subData.map((s) => ({ ...s, email: map.get(s.user_id) ?? undefined })));
    } else {
      setActiveSubs([]);
    }
    setDataLoading(false);
  };

  useEffect(() => {
    if (isAdmin) loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (loading || !isAdmin) return null;

  const approve = async (sub: PaymentSubmission) => {
    setBusy(sub.id);
    try {
      const { data: prof, error: pErr } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", sub.email.trim().toLowerCase())
        .maybeSingle();
      if (pErr) throw pErr;
      if (!prof) throw new Error(`No account found for ${sub.email}. User must register first.`);

      const days = PLAN_DAYS[sub.package] ?? sub.duration_days ?? 30;
      const now = new Date();
      const expires = new Date(now.getTime() + days * 86_400_000).toISOString();

      const { error: subErr } = await supabase.from("subscriptions").insert({
        user_id: prof.id,
        plan: sub.package,
        status: "active",
        starts_at: now.toISOString(),
        expires_at: expires,
      });
      if (subErr) throw subErr;

      const { error: updErr } = await supabase
        .from("payment_submissions")
        .update({ status: "approved", reviewed_at: now.toISOString() })
        .eq("id", sub.id);
      if (updErr) throw updErr;

      toast.success(`Approved: ${sub.email} — ${sub.package}`);
      await loadData();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Approval failed");
    } finally {
      setBusy(null);
    }
  };

  const reject = async (sub: PaymentSubmission) => {
    setBusy(sub.id);
    try {
      const { error } = await supabase
        .from("payment_submissions")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", sub.id);
      if (error) throw error;
      toast.success("Submission rejected");
      setSubmissions((prev) => prev.map((x) => x.id === sub.id ? { ...x, status: "rejected" as const } : x));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setBusy(null);
    }
  };

  const terminate = async (id: string) => {
    setBusy(id);
    const { error } = await supabase
      .from("subscriptions")
      .update({ status: "terminated", expires_at: new Date().toISOString() })
      .eq("id", id);
    setBusy(null);
    if (error) { toast.error(error.message); return; }
    toast.success("Subscription terminated");
    await loadData();
  };

  const pendingCount = submissions.filter((s) => s.status === "pending").length;

  const filteredSubmissions = submissions.filter((s) => {
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const matchSearch = !search ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.transaction_code.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const filteredSubs = activeSubs.filter((s) =>
    !search || (s.email ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <section className="rounded-2xl bg-gradient-card border border-gold/40 p-4 sm:p-5 animate-fade-up">
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <ShieldCheck className="w-4 h-4 text-gold shrink-0" />
        <h3 className="text-sm font-semibold">Premium Access Management</h3>
        <button
          onClick={loadData}
          disabled={dataLoading}
          className="ml-auto p-1.5 rounded-lg border border-border hover:border-gold/50 transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${dataLoading ? "animate-spin" : ""}`} />
        </button>
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-full">
          <ShieldCheck className="w-3 h-3" /> Admin Only
        </span>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search by email or transaction code…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-lg pl-8 pr-3 py-2 text-xs focus:outline-none focus:border-gold/60"
        />
      </div>

      <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted/40 mb-4">
        <button
          onClick={() => setTab("submissions")}
          className={`text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
            tab === "submissions" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Submissions
          {pendingCount > 0 && (
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
              tab === "submissions" ? "bg-white/25 text-white" : "bg-bearish text-white"
            }`}>
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("active")}
          className={`text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${
            tab === "active" ? "bg-gradient-gold text-primary-foreground shadow-gold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          Active Premium
        </button>
      </div>

      {dataLoading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-gold" />
        </div>
      ) : tab === "submissions" ? (
        <div className="space-y-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(["pending", "approved", "rejected", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`text-[10px] uppercase tracking-wide px-2.5 py-1 rounded-full border transition-colors ${
                  statusFilter === f
                    ? f === "pending" ? "border-amber-400/60 bg-amber-400/10 text-amber-400"
                    : f === "approved" ? "border-bullish/60 bg-bullish/10 text-bullish"
                    : f === "rejected" ? "border-bearish/60 bg-bearish/10 text-bearish"
                    : "border-gold text-gold bg-gold/10"
                    : "border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {f === "all" ? "All" : f} {f !== "all" && `(${submissions.filter((s) => s.status === f).length})`}
              </button>
            ))}
          </div>

          {filteredSubmissions.length === 0 ? (
            <div className="text-center py-8 text-[11px] text-muted-foreground">
              {search ? "No submissions match your search." : "No submissions in this category."}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSubmissions.map((s) => (
                <SubmissionRow key={s.id} sub={s} busy={busy} onApprove={approve} onReject={reject} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredSubs.length === 0 ? (
            <div className="text-center py-8 text-[11px] text-muted-foreground">
              {search ? "No subscribers match your search." : "No active subscriptions yet."}
            </div>
          ) : (
            filteredSubs.map((s) => {
              const isExpired = new Date(s.expires_at) <= new Date() || s.status !== "active";
              return (
                <div
                  key={s.id}
                  className={`rounded-xl border p-3 space-y-2 ${
                    isExpired ? "border-border bg-card/30 opacity-60" : "border-gold/30 bg-gold/5"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold truncate">{s.email ?? `${s.user_id.slice(0, 12)}…`}</p>
                      <p className="text-[10px] text-muted-foreground">{s.plan}</p>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase shrink-0 ${
                      isExpired ? "border-border text-muted-foreground" : "border-gold/40 bg-gold/10 text-gold"
                    }`}>
                      {isExpired ? s.status : "Active"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px]">
                    <div>
                      <span className="text-muted-foreground">Start: </span>
                      <span className="font-semibold">{new Date(s.starts_at).toLocaleDateString()}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Expires: </span>
                      <span className={`font-semibold ${isExpired ? "text-bearish" : "text-gold"}`}>
                        {new Date(s.expires_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  {!isExpired && (
                    <button
                      onClick={() => terminate(s.id)}
                      disabled={busy === s.id}
                      className="w-full text-[10px] font-semibold px-3 py-1.5 rounded-lg border border-bearish/40 text-bearish hover:bg-bearish/10 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      {busy === s.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3 h-3" />}
                      Terminate Access
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

function SubmissionRow({
  sub,
  busy,
  onApprove,
  onReject,
}: {
  sub: PaymentSubmission;
  busy: string | null;
  onApprove: (s: PaymentSubmission) => void;
  onReject: (s: PaymentSubmission) => void;
}) {
  const isBusy = busy === sub.id;

  const statusCfg = {
    pending: { color: "text-amber-400 border-amber-400/40 bg-amber-400/10", label: "Pending" },
    approved: { color: "text-bullish border-bullish/40 bg-bullish/10", label: "Approved" },
    rejected: { color: "text-bearish border-bearish/40 bg-bearish/10", label: "Rejected" },
  }[sub.status];

  return (
    <div className="rounded-xl border border-border bg-card/40 p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold truncate">{sub.email}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {sub.package} · ${sub.price} · KES {(sub.price * 130).toLocaleString()} · {new Date(sub.created_at).toLocaleString()}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase shrink-0 ${statusCfg.color}`}>
          {statusCfg.label}
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-card/60 border border-border">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">M-Pesa Code</span>
        <span className="text-xs font-mono font-bold tracking-widest ml-auto">{sub.transaction_code}</span>
      </div>

      {sub.status === "pending" && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onReject(sub)}
            disabled={isBusy}
            className="text-xs font-semibold py-2 rounded-lg border border-bearish/40 text-bearish hover:bg-bearish/10 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
          >
            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            Reject
          </button>
          <button
            onClick={() => onApprove(sub)}
            disabled={isBusy}
            className="text-xs font-semibold py-2 rounded-lg bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-1.5"
          >
            {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Approve
          </button>
        </div>
      )}
    </div>
  );
}
