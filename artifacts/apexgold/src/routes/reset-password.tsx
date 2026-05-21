import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import { Sparkles, Lock, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";

const passwordSchema = z.string().min(8, { message: "Password must be at least 8 characters" }).max(72);

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Wait for Supabase to process the recovery hash in the URL.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const parsed = passwordSchema.safeParse(password);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }

    setSubmitting(true);
    try {
      const { error: err } = await supabase.auth.updateUser({ password: parsed.data });
      if (err) throw err;
      setSuccess("Password updated. Redirecting to your dashboard…");
      setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-10 bg-background">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-gradient-gold leading-none">ApexGold AI</div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground mt-0.5">Trading Intelligence</div>
          </div>
        </Link>

        <div className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur-xl p-6 sm:p-8 shadow-2xl">
          <h1 className="text-2xl font-bold text-foreground">Set a new password</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Choose a strong password (at least 8 characters).
          </p>

          {!ready ? (
            <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 animate-spin" /> Verifying reset link…
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3 mt-6">
              <PwField id="password" label="New password" value={password} onChange={setPassword} autoComplete="new-password" />
              <PwField id="confirm" label="Confirm password" value={confirm} onChange={setConfirm} autoComplete="new-password" />

              {error && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              {success && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{success}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-gradient-gold text-primary-foreground font-semibold text-sm shadow-gold hover:opacity-95 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Update password
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function PwField({ id, label, value, onChange, autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; autoComplete: string }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          id={id}
          type="password"
          autoComplete={autoComplete}
          required
          minLength={8}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="At least 8 characters"
          className="w-full h-11 pl-9 pr-3 rounded-lg bg-background border border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/20 outline-none text-sm"
        />
      </div>
    </div>
  );
}
