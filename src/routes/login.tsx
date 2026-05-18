import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState, type FormEvent } from "react";
import { Sparkles, Loader2, Mail, Lock, AlertCircle, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/hooks/use-auth";

const emailSchema = z.string().trim().email({ message: "Enter a valid email address" }).max(255);
const passwordSchema = z.string().min(8, { message: "Password must be at least 8 characters" }).max(72);

export function AuthPage() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && session) {
      navigate("/dashboard", { replace: true });
    }
  }, [authLoading, session, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      setError(emailResult.error.issues[0].message);
      return;
    }
    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      setError(passwordResult.error.issues[0].message);
      return;
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({
          email: emailResult.data,
          password: passwordResult.data,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (err) throw err;
        setSuccess("Account created. Redirecting…");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({
          email: emailResult.data,
          password: passwordResult.data,
        });
        if (err) throw err;
        setSuccess("Signed in. Redirecting…");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      if (/already registered|already exists/i.test(msg)) {
        setError("This email is already registered. Try signing in instead.");
      } else if (/invalid login credentials/i.test(msg)) {
        setError("Invalid email or password.");
      } else {
        setError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setOauthLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        setError(result.error instanceof Error ? result.error.message : "Google sign-in failed");
        setOauthLoading(false);
        return;
      }
      if (result.redirected) return;
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Google sign-in failed");
      setOauthLoading(false);
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
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-foreground">
              {mode === "signin" ? "Welcome back" : "Create your account"}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {mode === "signin"
                ? "Sign in to access the trading dashboard."
                : "Get instant access to institutional-grade analysis."}
            </p>
          </div>

          {/* Mode toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-muted/40 mb-5">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); setSuccess(null); }}
                className={`text-xs font-medium py-2 rounded-md transition-all ${
                  mode === m
                    ? "bg-gradient-gold text-primary-foreground shadow-gold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m === "signin" ? "Sign in" : "Create account"}
              </button>
            ))}
          </div>

          {/* Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={oauthLoading || submitting}
            className="w-full flex items-center justify-center gap-2 h-11 rounded-lg border border-border bg-background hover:bg-accent transition-colors text-sm font-medium disabled:opacity-60"
          >
            {oauthLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>

          <div className="flex items-center gap-3 my-5">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Or with email</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-medium text-muted-foreground">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 pl-9 pr-3 rounded-lg bg-background border border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="password" className="text-xs font-medium text-muted-foreground">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="password"
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full h-11 pl-9 pr-3 rounded-lg bg-background border border-border focus:border-primary/60 focus:ring-2 focus:ring-primary/20 outline-none text-sm"
                />
              </div>
            </div>

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
              disabled={submitting || oauthLoading}
              className="w-full h-11 rounded-lg bg-gradient-gold text-primary-foreground font-semibold text-sm shadow-gold hover:opacity-95 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === "signin" ? "Sign in" : "Create account"}
            </button>

            {mode === "signin" && (
              <div className="text-center">
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Forgot password?
                </Link>
              </div>
            )}
          </form>

          <p className="mt-6 text-[11px] text-center text-muted-foreground">
            By continuing you agree to receive trading-related communications. Not financial advice.
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.2.8 3.9 1.5l2.7-2.6C17 3.4 14.7 2.4 12 2.4 6.7 2.4 2.4 6.7 2.4 12s4.3 9.6 9.6 9.6c5.5 0 9.2-3.9 9.2-9.4 0-.6-.07-1.1-.16-1.6H12z"/>
    </svg>
  );
}
