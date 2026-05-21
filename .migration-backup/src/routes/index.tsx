import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import {
  Sparkles, BarChart3, Bell, BookmarkCheck, ShieldCheck, Zap, LineChart,
  Crown, ArrowRight, CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function Landing() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && session) navigate("/dashboard", { replace: true });
  }, [loading, session, navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Glow */}
      <div className="absolute inset-x-0 top-0 -z-10 h-[600px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/15 via-background to-background" />

      {/* Nav */}
      <header className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold">
            <Sparkles className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <div className="text-sm font-bold tracking-tight text-gradient-gold leading-none">ApexGold AI</div>
            <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground mt-0.5">Trading Intelligence</div>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <Link to="/login" className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition-colors px-3 py-2">
            Sign in
          </Link>
          <Link
            to="/login"
            className="text-xs sm:text-sm font-semibold bg-gradient-gold text-primary-foreground px-3 sm:px-4 py-2 rounded-lg shadow-gold hover:opacity-95 transition-opacity"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-10 sm:pt-20 pb-16 sm:pb-24 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-gold/30 bg-card/40 backdrop-blur text-[11px] uppercase tracking-widest text-gold mb-6">
          <Zap className="w-3 h-3" /> Live AI · XAUUSD
        </div>
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
          Trade Gold with an <span className="text-gradient-gold">institutional edge</span>.
        </h1>
        <p className="mt-5 max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground">
          Upload a chart, get a structured AI playbook in seconds — bias, key levels,
          confluence and a clean setup. Built for serious XAUUSD traders.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/login"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-95 transition-opacity"
          >
            Start free — 3 analyses <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#features"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl border border-border bg-card/60 hover:border-gold/40 hover:bg-card font-semibold transition-colors"
          >
            See how it works
          </a>
        </div>
        <p className="mt-4 text-[11px] text-muted-foreground">No card required · Cancel anytime</p>
      </section>

      {/* Features */}
      <section id="features" className="max-w-6xl mx-auto px-4 sm:px-6 pb-20">
        <h2 className="text-2xl sm:text-3xl font-bold text-center mb-3">Everything you need to trade with conviction</h2>
        <p className="text-center text-sm text-muted-foreground max-w-xl mx-auto mb-12">
          From AI-driven setups to alerts and journaling — ApexGold AI replaces a stack of tools.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { icon: BarChart3, title: "AI Chart Analysis", desc: "Upload any XAUUSD chart and get a structured read: bias, confidence, key levels, confluence, and a tradeable plan." },
            { icon: Bell, title: "Smart Price Alerts", desc: "Set above / below triggers on real-time Gold price and get instantly notified when your level prints." },
            { icon: BookmarkCheck, title: "Trade Journal", desc: "Save every analysis with the original chart. Filter by bias and build your edge over time." },
            { icon: LineChart, title: "Live Gold Price", desc: "Always-on XAUUSD ticker so you never trade blind." },
            { icon: ShieldCheck, title: "Secure & Private", desc: "Bank-grade auth. Your trades, alerts and notes are isolated to your account." },
            { icon: Crown, title: "Premium Access", desc: "Unlimited analyses, longer sessions, and direct support from the ApexGold team." },
          ].map((f) => (
            <div key={f.title} className="rounded-2xl border border-border/60 bg-card/60 backdrop-blur p-5 hover:border-gold/40 transition-colors">
              <div className="w-10 h-10 rounded-lg bg-gradient-gold/10 border border-gold/30 flex items-center justify-center mb-4">
                <f.icon className="w-5 h-5 text-gold" />
              </div>
              <h3 className="font-semibold text-foreground">{f.title}</h3>
              <p className="text-sm text-muted-foreground mt-1.5">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Steps */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="rounded-3xl border border-border/60 bg-card/40 backdrop-blur p-6 sm:p-10">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-10">From chart to call in 3 steps</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { n: "01", t: "Upload your chart", d: "Drop a XAUUSD screenshot from any platform — TradingView, MT4/5, broker app." },
              { n: "02", t: "AI reads the structure", d: "ApexGold AI maps the bias, levels, liquidity and the cleanest setup available." },
              { n: "03", t: "Execute with clarity", d: "Get an actionable playbook. Save it. Set an alert. Trade it." },
            ].map((s) => (
              <div key={s.n}>
                <div className="text-gradient-gold text-3xl font-bold">{s.n}</div>
                <div className="mt-2 font-semibold">{s.t}</div>
                <div className="text-sm text-muted-foreground mt-1">{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-24 text-center">
        <div className="rounded-3xl border border-gold/30 bg-gradient-to-b from-card/80 to-card/40 backdrop-blur p-8 sm:p-12 shadow-gold">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">Ready to trade smarter?</h2>
          <p className="mt-3 text-muted-foreground">Create your free account and run your first AI analysis in under a minute.</p>
          <ul className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm text-muted-foreground">
            {["3 free analyses", "Alerts & watchlist", "Trade journal"].map((b) => (
              <li key={b} className="flex items-center justify-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-bullish" /> {b}
              </li>
            ))}
          </ul>
          <Link
            to="/login"
            className="mt-8 inline-flex items-center justify-center gap-2 h-12 px-8 rounded-xl bg-gradient-gold text-primary-foreground font-semibold shadow-gold hover:opacity-95 transition-opacity"
          >
            Get started free <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border/40 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div>© {new Date().getFullYear()} ApexGold AI. Not financial advice.</div>
          <div className="flex items-center gap-4">
            <Link to="/login" className="hover:text-foreground transition-colors">Sign in</Link>
            <a href="mailto:apexgoldaiteam@gmail.com" className="hover:text-foreground transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
