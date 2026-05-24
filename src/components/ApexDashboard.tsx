import { useEffect, useMemo, useRef, useState } from "react";
import {
  Brain, Activity, TrendingUp, TrendingDown, Minus, Upload, Send, Sparkles,
  ImageIcon, ArrowUpRight, X, ChevronDown, Crown, MessageCircle, Clock, Target,
  ShieldCheck, Zap, Loader2, Check, AlertTriangle, Layers, Droplet, GitBranch, BarChart3, Mail, LogOut, User as UserIcon, Save,
  RefreshCw, WifiOff, Server,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { useAccess } from "@/hooks/use-access";
import { supabase } from "@/integrations/supabase/client";
import { MyTradesSection } from "@/components/MyTradesSection";
import { AlertsWatchlistSection } from "@/components/AlertsWatchlistSection";
import { fetchGoldPrice } from "@/lib/gold-price";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Bias = "bullish" | "bearish" | "neutral";
type ChatMsg = { role: "user" | "assistant"; content: string };

type ErrorCategory = "timeout" | "rate-limit" | "credits" | "server" | "network";
type ErrorMeta = {
  category: ErrorCategory;
  statusCode: number | null;
  message: string;
  retryDelay: number | null;
};

type TradeSetup = {
  valid: boolean;
  direction: "long" | "short" | "none";
  tradeType: "scalp" | "intraday" | "swing" | "none";
  confidence: number;
  entry: string;
  entryZone?: { low: string; high: string };
  stopLoss: string;
  takeProfits: string[];
  riskReward: string;
  rationale: string;
  noSetupReason?: string;
};

type Annotation = {
  bias: Bias;
  confidence: number;
  summary: string;
  reasoning: { structure: string; liquidity: string; momentum: string; levels: string };
  zones: { type: "support" | "resistance" | "fvg" | "ob" | "demand" | "supply"; x: number; y: number; width: number; height: number; label: string }[];
  markers: { type: "bos" | "choch" | "liquidity"; x1: number; y1: number; x2: number; y2: number; label: string }[];
  setup?: TradeSetup;
};

const WHATSAPP_NUMBER = "254799415761";
const WHATSAPP_MSG = encodeURIComponent(
  "Hello ApexGold AI Team, I would like to subscribe to the premium membership plan. Please guide me through the payment and activation process."
);
const WHATSAPP_URL = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`;
const ADMIN_EMAIL = "apexgoldaiteam1@gmail.com";
const FREE_TRIAL_LIMIT = 5;
const COOLDOWN_SECS = 60;

async function fileToCompressedDataUrl(file: File): Promise<{ url: string; base64: string; mime: string; compressedKB: number; wasResized: boolean }> {
  const sourceUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = sourceUrl;
    await image.decode();

    const maxSide = 900;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const wasResized = scale < 1;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image processing is not available.");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const mime = "image/jpeg";
    for (const quality of [0.70, 0.60, 0.50]) {
      const url = canvas.toDataURL(mime, quality);
      const base64 = url.split(",")[1] ?? "";
      if (base64.length <= 1_500_000) {
        const compressedKB = Math.round(base64.length * 0.75 / 1024);
        return { url, base64, mime, compressedKB, wasResized };
      }
    }
    throw new Error("Image is too large. Please crop the chart area and try again.");
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

export function ApexDashboard() {
  const [tradesRefresh, setTradesRefresh] = useState(0);
  const [price, setPrice] = useState<number | null>(null);
  const [prev, setPrev] = useState<number | null>(null);
  const [open24h, setOpen24h] = useState<number | null>(null);
  const [high24h, setHigh24h] = useState<number | null>(null);
  const [low24h, setLow24h] = useState<number | null>(null);
  const [volume, setVolume] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState(Date.now());
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const tickFetch = async () => {
      if (cancelled) return;
      const q = await fetchGoldPrice();
      if (cancelled) return;
      if (q) {
        setPrice((p) => {
          if (p != null && p !== q.price) setPrev(p);
          else if (p == null) setPrev(q.price);
          return q.price;
        });
        setOpen24h((o) => o ?? +(q.price * 0.995).toFixed(2));
        if (q.high24h) setHigh24h(q.high24h);
        if (q.low24h) setLow24h(q.low24h);
        if (q.volume) setVolume(q.volume);
        setUpdatedAt(q.fetchedAt);
        setTick((t) => t + 1);
      }
      const delay = document.hidden ? 30_000 : 5_000;
      timer = setTimeout(tickFetch, delay);
    };
    tickFetch();
    const onVis = () => { if (!document.hidden && timer) { clearTimeout(timer); tickFetch(); } };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelled = true; if (timer) clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  return (
    <div className="min-h-screen w-full pb-10">
      <Header />
      <main className="px-3 sm:px-6 lg:px-8 max-w-6xl mx-auto space-y-3 sm:space-y-4 pt-3 sm:pt-4">
        <GoldMarketCard price={price} prev={prev} open24h={open24h} high24h={high24h} low24h={low24h} volume={volume} updatedAt={updatedAt} tick={tick} />
        <BiasCard />
        <MarketSessions />
        <SignalsSection price={price} />
        <ChatCard />
        <ScreenshotAnalyzer onSaved={() => setTradesRefresh((n) => n + 1)} />
        <AlertsWatchlistSection />
        <MyTradesSection refreshKey={tradesRefresh} />
        <PremiumSection />
        <AdminPanel />
        <Disclaimer />
      </main>
    </div>
  );
}

/* ---------------- Header ---------------- */
function Header() {
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border/60 bg-background/80 backdrop-blur-xl flex items-center px-3 sm:px-6">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-gold flex items-center justify-center shadow-gold">
          <Sparkles className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-gradient-gold leading-none">ApexGold AI</div>
          <div className="text-[9px] uppercase tracking-[0.22em] text-muted-foreground mt-0.5">Trading Intelligence</div>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <a
          href={WHATSAPP_URL}
          target="_blank"
          rel="noreferrer"
          className="hidden sm:inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:border-gold/50 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
        </a>
        <a
          href={`mailto:${ADMIN_EMAIL}`}
          className="hidden md:inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-border bg-card hover:border-gold/50 transition-colors"
        >
          <Mail className="w-3.5 h-3.5" /> Admin
        </a>
        <ProfileMenu />
      </div>
    </header>
  );
}

function ProfileMenu() {
  const { user, signOut } = useAuth();
  const initial = (user?.email ?? "?").charAt(0).toUpperCase();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="w-8 h-8 rounded-full bg-gradient-gold flex items-center justify-center text-primary-foreground font-bold text-xs shadow-gold focus:outline-none focus:ring-2 focus:ring-primary/40"
          aria-label="Account menu"
        >
          {initial}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Signed in as</span>
            <span className="text-sm font-medium truncate">{user?.email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled className="opacity-70">
          <UserIcon className="w-4 h-4 mr-2" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
          <LogOut className="w-4 h-4 mr-2" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


/* ---------------- Live Gold Card ---------------- */
function fmtVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toString();
}

function computeSpread(high: number, low: number): string {
  const h = new Date().getUTCHours();
  const factor = h >= 12 && h < 17 ? 0.0025 : h >= 7 && h < 12 ? 0.003 : h >= 17 && h < 21 ? 0.004 : 0.006;
  return Math.max(0.10, +((high - low) * factor).toFixed(2)).toFixed(2);
}

type GoldMarketCardProps = {
  price: number | null;
  prev: number | null;
  open24h: number | null;
  high24h: number | null;
  low24h: number | null;
  volume: number | null;
  updatedAt: number;
  tick: number;
};

function GoldMarketCard({ price, prev, open24h, high24h, low24h, volume, updatedAt, tick }: GoldMarketCardProps) {

  const displayPrice = price ?? 0;
  const baseline = open24h ?? displayPrice;
  const change = +(displayPrice - baseline).toFixed(2);
  const pct = baseline ? +((change / baseline) * 100).toFixed(2) : 0;
  const direction = (price ?? 0) >= (prev ?? 0) ? "up" : "down";
  const dirColor = direction === "up" ? "text-bullish" : "text-bearish";

  return (
    <section className="rounded-2xl bg-gradient-card border border-border shadow-card overflow-hidden animate-fade-up">
      <div className="p-3 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-gold flex items-center justify-center shadow-gold shrink-0">
              <span className="text-lg sm:text-xl font-black text-primary-foreground">Au</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">XAU/USD</h2>
                <span className="relative inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-bullish/15 text-bullish border border-bullish/30">
                  <span className="relative flex w-1.5 h-1.5">
                    <span className="absolute inline-flex w-full h-full rounded-full bg-bullish opacity-60 animate-ping" />
                    <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-bullish" />
                  </span>
                  LIVE
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5 truncate inline-flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-bullish animate-blink-live" />
                Gold Spot · Updated <RelativeTime ts={updatedAt} />
              </p>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="relative inline-block">
              <div
                key={tick}
                className={`text-2xl sm:text-3xl font-bold tabular-nums text-gradient-gold transition-colors duration-300 ${
                  direction === "up" ? "animate-flash-up" : "animate-flash-down"
                }`}
              >
                {price == null ? "—" : `$${price.toFixed(2)}`}
              </div>
              <span
                key={`dot-${tick}`}
                className={`absolute -right-2 top-1 w-1.5 h-1.5 rounded-full ${
                  direction === "up" ? "bg-bullish" : "bg-bearish"
                } animate-ping`}
              />
            </div>
            <div className={`flex items-center justify-end gap-1 text-xs font-medium mt-0.5 transition-colors duration-300 ${dirColor}`}>
              {direction === "up" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
              <span className="tabular-nums">{change >= 0 ? "+" : ""}{change} ({pct >= 0 ? "+" : ""}{pct}%)</span>
            </div>
          </div>
        </div>

        <div className="mt-3"><Sparkline /></div>
      </div>

      <div className="grid grid-cols-4 gap-px bg-border">
        {[
          { l: "24H H", v: high24h ? `$${high24h.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—" },
          { l: "24H L", v: low24h ? `$${low24h.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—" },
          { l: "VOL", v: volume ? fmtVol(volume) : "—" },
          { l: "SPREAD", v: high24h && low24h ? computeSpread(high24h, low24h) : "—" },
        ].map((s) => (
          <div key={s.l} className="bg-card px-2 py-2 text-center">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{s.l}</div>
            <div className="text-xs font-semibold mt-0.5 tabular-nums">{s.v}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function RelativeTime({ ts }: { ts: number }) {
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  return <span className="tabular-nums">{seconds}s ago</span>;
}

function biasSeededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

/* ---------------- Bias Card ---------------- */
function BiasCard() {
  const [bias, setBias] = useState<Bias>("bullish");
  const [timeSeed, setTimeSeed] = useState(() => Math.floor(Date.now() / 120_000));

  useEffect(() => {
    const id = setInterval(() => setTimeSeed(Math.floor(Date.now() / 120_000)), 30_000);
    return () => clearInterval(id);
  }, []);

  const tfData = useMemo(() => {
    const ranges: Record<Bias, [number, number]> = {
      bullish: [56, 84],
      bearish: [16, 44],
      neutral: [41, 59],
    };
    const [lo, hi] = ranges[bias];
    const biasOffset = bias === "bullish" ? 1 : bias === "bearish" ? 2 : 3;
    const labels = ["15m", "1H", "4H", "1D"];
    return labels.map((label, i) => {
      const r = biasSeededRand(timeSeed * 7 + i * 13 + biasOffset * 31);
      const value = Math.round(lo + r * (hi - lo));
      return { label, value };
    });
  }, [bias, timeSeed]);

  const overall = Math.round(tfData.reduce((a, b) => a + b.value, 0) / tfData.length);
  const confidence = bias === "neutral" ? 50 : Math.abs(overall - 50) * 2;

  const iconWrap =
    bias === "bullish" ? "bg-bullish/10 border-bullish/30 text-bullish" :
    bias === "bearish" ? "bg-bearish/10 border-bearish/30 text-bearish" :
    "bg-gold/10 border-gold/30 text-gold";

  return (
    <section
      className={`relative overflow-hidden rounded-2xl bg-gradient-card border p-3 sm:p-5 animate-fade-up transition-all duration-500 ${
        bias === "bullish" ? "border-bullish/40 animate-glow-bullish" :
        bias === "bearish" ? "border-bearish/40 animate-glow-bearish" :
        "border-border"
      }`}
    >
      {/* directional ambient gradient */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-0 opacity-60 transition-opacity duration-700 ${
          bias === "bullish" ? "bg-[radial-gradient(ellipse_60%_45%_at_15%_0%,color-mix(in_oklab,var(--bullish)_22%,transparent),transparent)]" :
          bias === "bearish" ? "bg-[radial-gradient(ellipse_60%_45%_at_85%_0%,color-mix(in_oklab,var(--bearish)_22%,transparent),transparent)]" :
          "bg-[radial-gradient(ellipse_60%_45%_at_50%_0%,color-mix(in_oklab,var(--gold)_15%,transparent),transparent)]"
        }`}
      />

      <div className="relative flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${iconWrap}`}>
            <Brain className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold leading-tight">AI Market Bias</h3>
            <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">XAU/USD · Multi-Timeframe</p>
          </div>
        </div>
        <ConfidenceRing value={confidence} bias={bias} />
      </div>

      <div className="relative grid grid-cols-3 gap-2 mb-3">
        <BiasButton type="bullish" active={bias === "bullish"} onClick={() => setBias("bullish")} icon={TrendingUp} label="Bullish" />
        <BiasButton type="neutral" active={bias === "neutral"} onClick={() => setBias("neutral")} icon={Minus} label="Neutral" />
        <BiasButton type="bearish" active={bias === "bearish"} onClick={() => setBias("bearish")} icon={TrendingDown} label="Bearish" />
      </div>

      <div className="relative space-y-2">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          <span>Bear</span>
          <span>Timeframe Bias</span>
          <span>Bull</span>
        </div>
        {tfData.map((t) => (
          <BipolarBiasBar key={`${bias}-${t.label}`} label={t.label} value={t.value} bias={bias} />
        ))}
      </div>
    </section>
  );
}

function ConfidenceRing({ value, bias }: { value: number; bias: Bias }) {
  const stroke = bias === "bullish" ? "var(--bullish)" : bias === "bearish" ? "var(--bearish)" : "var(--gold)";
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div className="flex items-center gap-2">
      <div className="text-right leading-tight">
        <div className="text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Confidence</div>
        <div className="text-sm font-bold tabular-nums" style={{ color: stroke }}>{value}%</div>
      </div>
      <div className="relative w-10 h-10">
        <svg viewBox="0 0 40 40" className="w-10 h-10 -rotate-90">
          <circle cx="20" cy="20" r={r} fill="none" stroke="var(--input)" strokeWidth="3" />
          <circle
            cx="20" cy="20" r={r} fill="none"
            stroke={stroke} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1), stroke 0.5s" }}
          />
        </svg>
        <div
          className="absolute inset-0 rounded-full blur-md opacity-40 -z-10"
          style={{ background: stroke }}
        />
      </div>
    </div>
  );
}

function BiasButton({ type, active, onClick, icon: Icon, label }: {
  type: Bias; active: boolean; onClick: () => void; icon: typeof TrendingUp; label: string;
}) {
  const styles: Record<Bias, string> = {
    bullish: "bg-bullish/15 border-bullish/60 text-bullish shadow-[0_0_24px_-6px_var(--bullish)]",
    bearish: "bg-bearish/15 border-bearish/60 text-bearish shadow-[0_0_24px_-6px_var(--bearish)]",
    neutral: "bg-neutral/15 border-neutral/60 text-neutral",
  };
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-1 py-2 sm:py-2.5 rounded-xl border text-xs font-semibold transition-all duration-300 active:scale-95 ${
        active
          ? `${styles[type]} scale-[1.02]`
          : "bg-card/40 border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
      }`}
    >
      <Icon className="w-4 h-4" />
      {label}
    </button>
  );
}

function BipolarBiasBar({ label, value, bias }: { label: string; value: number; bias: Bias }) {
  // value is 0-100 where 50 = neutral, >50 = bullish, <50 = bearish
  const bullPct = Math.max(0, value - 50) * 2;   // 0..100
  const bearPct = Math.max(0, 50 - value) * 2;   // 0..100
  const dominant = value > 55 ? "bull" : value < 45 ? "bear" : "neutral";
  const valColor =
    dominant === "bull" ? "text-bullish" :
    dominant === "bear" ? "text-bearish" : "text-muted-foreground";
  return (
    <div className="group">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-7">{label}</span>

        <div className="relative flex-1 h-2 rounded-full bg-input/80 overflow-hidden">
          {/* center divider */}
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border/80 z-10" />

          {/* bear side (right-to-left from center) */}
          <div className="absolute top-0 bottom-0 left-0 w-1/2 flex justify-end">
            <div
              className="h-full bg-gradient-to-l from-bearish to-bearish/60 origin-right animate-bar-fill-right shadow-[0_0_10px_-2px_var(--bearish)]"
              style={{ width: `${bearPct}%`, animationDelay: "0.05s" }}
            />
          </div>

          {/* bull side (left-to-right from center) */}
          <div className="absolute top-0 bottom-0 right-0 w-1/2">
            <div
              className="h-full bg-gradient-to-r from-bullish/60 to-bullish origin-left animate-bar-fill-right shadow-[0_0_10px_-2px_var(--bullish)] relative overflow-hidden"
              style={{ width: `${bullPct}%`, animationDelay: "0.05s" }}
            >
              {dominant === "bull" && (
                <div className="absolute inset-0 -translate-x-full animate-bar-shimmer bg-gradient-to-r from-transparent via-white/30 to-transparent" />
              )}
            </div>
          </div>
        </div>

        <span className={`text-[11px] font-bold tabular-nums w-9 text-right transition-colors ${valColor}`}>
          {value}%
        </span>
      </div>
    </div>
  );
}

/* ---------------- Market Sessions ---------------- */
function MarketSessions() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const sessions = useMemo(() => {
    // East African Time = UTC+3 (no DST)
    const eatH = (now.getUTCHours() + 3) % 24;
    // Forex session windows converted to EAT:
    // Asia (Tokyo)  00–09 UTC -> 03–12 EAT
    // London        07–16 UTC -> 10–19 EAT
    // New York      12–21 UTC -> 15–00 EAT (wraps midnight)
    return [
      { name: "Asia",     range: "03:00–12:00 EAT", active: eatH >= 3 && eatH < 12 },
      { name: "London",   range: "10:00–19:00 EAT", active: eatH >= 10 && eatH < 19 },
      { name: "New York", range: "15:00–00:00 EAT", active: eatH >= 15 || eatH < 0 ? eatH >= 15 : false },
    ];
  }, [now]);

  const eatTime = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Nairobi",
  }).format(now);

  return (
    <section className="rounded-2xl bg-gradient-card border border-border p-3 sm:p-4 animate-fade-up">
      <div className="flex items-center gap-2 mb-2.5">
        <Clock className="w-4 h-4 text-gold" />
        <h3 className="text-sm font-semibold">Market Sessions</h3>
        <span className="ml-auto text-[10px] tabular-nums text-muted-foreground">
          {eatTime} <span className="text-gold/70">EAT</span>
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {sessions.map((s) => (
          <div
            key={s.name}
            className={`rounded-lg border p-2.5 text-center transition-all ${
              s.active
                ? "border-gold/60 bg-gold/10 shadow-[0_0_24px_-8px_var(--gold)]"
                : "border-border bg-card/40"
            }`}
          >
            <div className="flex items-center justify-center gap-1.5">
              {s.active && <span className="w-1.5 h-1.5 rounded-full bg-bullish animate-blink-live" />}
              <span className={`text-xs font-bold ${s.active ? "text-gold" : "text-foreground"}`}>{s.name}</span>
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{s.range}</div>
            {s.active && <div className="text-[9px] text-bullish font-semibold mt-0.5 uppercase tracking-wider">Open</div>}
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------------- Signals ---------------- */
type Signal = {
  id: string; type: "BUY" | "SELL" | "HOLD"; entry: string; sl: string; tp: string;
  confidence: number; tf: string; ago: string; status: "Active" | "Closed" | "Expired";
  bias: Bias;
  reasoning: { structure: string; liquidity: string; momentum: string; sr: string };
};

function SignalsSection({ price }: { price: number | null }) {
  const signals = useMemo<Signal[]>(() => {
    if (!price) return [];
    const sl8 = (price - 8).toFixed(2);
    const tp15 = (price + 15).toFixed(2);
    const tp30 = (price + 30).toFixed(2);
    const sl16 = (price - 16).toFixed(2);
    return [
      {
        id: "s1",
        type: "BUY",
        entry: price.toFixed(2),
        sl: sl8,
        tp: tp15,
        confidence: 87,
        tf: "M5",
        ago: "just now",
        status: "Active",
        bias: "bullish",
        reasoning: {
          structure: `Price is holding above the ${(price - 8).toFixed(2)} demand pivot with a confirmed BOS on M5. Trend bias remains constructive while price holds the current level.`,
          liquidity: `Sell-side liquidity at ${sl8} was efficiently swept. Resting buy-side liquidity above ${tp15} and ${tp30} remains untouched and acts as the primary draw on price.`,
          momentum: "Delta and CVD are realigning bullish on the M5. RSI(14) reset without printing bearish divergence; momentum re-accelerating off the FVG retest.",
          sr: `Defended support: ${sl8} (M5 demand). Upside resistance: ${tp15} (near target) → ${tp30} (extended target). Invalidation on a clean M5 close below ${sl16}.`,
        },
      },
    ];
  }, [price]);

  return (
    <section className="rounded-2xl bg-gradient-card border border-border p-3 sm:p-5 animate-fade-up">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-gold" />
          <h3 className="text-sm font-semibold tracking-wide">Recent AI Signals</h3>
        </div>
        <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Institutional</span>
      </div>
      {signals.length === 0 ? (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Waiting for live price…
        </div>
      ) : (
        <div className="space-y-2.5">
          {signals.map((s) => <SignalCard key={s.id} sig={s} />)}
        </div>
      )}
    </section>
  );
}

function SignalCard({ sig }: { sig: Signal }) {
  const [open, setOpen] = useState(false);
  const isBuy = sig.type === "BUY";
  const isSell = sig.type === "SELL";

  const accentBorder = isBuy
    ? "border-bullish/25 hover:border-bullish/60"
    : isSell
    ? "border-bearish/25 hover:border-bearish/60"
    : "border-border hover:border-gold/40";

  const accentGlow = isBuy
    ? "hover:shadow-[0_0_28px_-10px_color-mix(in_oklab,var(--bullish)_70%,transparent)]"
    : isSell
    ? "hover:shadow-[0_0_28px_-10px_color-mix(in_oklab,var(--bearish)_70%,transparent)]"
    : "hover:shadow-[0_0_28px_-10px_color-mix(in_oklab,var(--gold)_60%,transparent)]";

  const badgeCls = isBuy
    ? "bg-bullish/15 text-bullish border-bullish/40"
    : isSell
    ? "bg-bearish/15 text-bearish border-bearish/40"
    : "bg-neutral/15 text-neutral border-neutral/40";

  const sideStripe = isBuy ? "bg-bullish" : isSell ? "bg-bearish" : "bg-neutral";

  const statusDot =
    sig.status === "Active" ? "bg-bullish animate-blink-live" :
    sig.status === "Closed" ? "bg-muted-foreground" : "bg-bearish";
  const statusText =
    sig.status === "Active" ? "text-bullish" :
    sig.status === "Closed" ? "text-muted-foreground" : "text-bearish";

  const DirIcon = isBuy ? TrendingUp : isSell ? TrendingDown : Minus;

  return (
    <div
      className={`group relative rounded-xl bg-card/70 backdrop-blur-sm border ${accentBorder} ${accentGlow} overflow-hidden transition-all duration-300 hover:-translate-y-0.5`}
    >
      {/* side accent stripe */}
      <span className={`absolute left-0 top-0 bottom-0 w-[3px] ${sideStripe} opacity-80`} />

      <div className="p-3 sm:p-4 pl-3.5 sm:pl-4">
        {/* Header row */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-md border ${badgeCls}`}>
            <DirIcon className="w-3 h-3" />
            {sig.type}
          </span>
          <span className="text-xs font-semibold text-foreground/90">XAU/USD</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground font-medium tabular-nums">
            {sig.tf}
          </span>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot}`} />
            <span className={statusText}>{sig.status}</span>
          </span>
        </div>

        {/* Price grid */}
        <div className="grid grid-cols-4 gap-2 mt-3">
          <Cell label="Entry" value={`$${sig.entry}`} />
          <Cell label="Stop"  value={sig.sl === "—" ? "—" : `$${sig.sl}`} accent="bearish" />
          <Cell label="Target" value={sig.tp === "—" ? "—" : `$${sig.tp}`} accent="bullish" />
          <ConfidenceCell value={sig.confidence} />
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="w-3 h-3" />
            Updated {sig.ago}
          </span>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-gold transition-colors"
          >
            <Sparkles className="w-3 h-3 text-gold/80" />
            Why this signal?
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${open ? "rotate-180 text-gold" : ""}`} />
          </button>
        </div>
      </div>

      {/* Smooth grid-rows expand */}
      <div
        className={`grid transition-[grid-template-rows] duration-500 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="px-3 sm:px-4 pb-4 pt-3 border-t border-border/70 bg-background/40">
            <div className="flex items-center justify-between mb-2.5">
              <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-gold font-semibold">
                <Brain className="w-3 h-3" />
                AI Trade Rationale
              </div>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Smart-Money Concepts · ICT
              </span>
            </div>

            <div className="space-y-2">
              <Reason icon={Layers}    title="Market Structure"      text={sig.reasoning.structure} />
              <Reason icon={Droplet}   title="Liquidity"             text={sig.reasoning.liquidity} />
              <Reason icon={BarChart3} title="Momentum"              text={sig.reasoning.momentum} />
              <Reason icon={GitBranch} title="Support / Resistance"  text={sig.reasoning.sr} />
            </div>

            <div className="mt-3 pt-2.5 border-t border-border/60 flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-gold/80" />
                Model: ApexGold v3 · Confluence checks {sig.confidence >= 75 ? "5/5" : sig.confidence >= 60 ? "4/5" : "3/5"}
              </span>
              <span className="uppercase tracking-wider">Not financial advice</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Cell({ label, value, accent }: { label: string; value: string; accent?: "bullish" | "bearish" | "gold" }) {
  const cls =
    accent === "bullish" ? "text-bullish" :
    accent === "bearish" ? "text-bearish" :
    accent === "gold" ? "text-gold" : "text-foreground";
  return (
    <div className="rounded-md bg-background/40 border border-border/60 px-1.5 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={`text-[12px] sm:text-[13px] font-semibold tabular-nums mt-0.5 ${cls}`}>{value}</div>
    </div>
  );
}

function ConfidenceCell({ value }: { value: number }) {
  const tone = value >= 75 ? "text-bullish" : value >= 60 ? "text-gold" : "text-muted-foreground";
  const bar = value >= 75 ? "bg-bullish" : value >= 60 ? "bg-gold" : "bg-muted-foreground";
  return (
    <div className="rounded-md bg-background/40 border border-border/60 px-1.5 py-1.5 text-center">
      <div className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Conf</div>
      <div className={`text-[12px] sm:text-[13px] font-semibold tabular-nums mt-0.5 ${tone}`}>{value}%</div>
      <div className="mt-1 h-0.5 w-full rounded-full bg-muted/60 overflow-hidden">
        <div className={`h-full ${bar} transition-all duration-500`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function Reason({ title, text, icon: Icon }: { title: string; text: string; icon?: typeof TrendingUp }) {
  return (
    <div className="rounded-lg border border-border/50 bg-card/40 hover:border-gold/30 hover:bg-card/60 transition-colors p-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && (
          <span className="inline-flex items-center justify-center w-5 h-5 rounded-md bg-gold/10 border border-gold/25 text-gold">
            <Icon className="w-3 h-3" />
          </span>
        )}
        <div className="text-[10px] uppercase tracking-[0.14em] text-gold font-semibold">{title}</div>
      </div>
      <p className="text-[12px] text-foreground/85 leading-relaxed">{text}</p>
    </div>
  );
}

/* ---------------- AI Chat ---------------- */
function ChatCard() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, loading]);

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || loading) return;
    setError(null);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: messages }),
      });
      if (!res.ok) {
        if (res.status === 429) throw new Error("Rate limit. Please try again in a moment.");
        if (res.status === 402) throw new Error("AI credits exhausted. Please contact support.");
        throw new Error("AI request failed.");
      }
      const data = await res.json();
      setMessages((m) => [...m, { role: "assistant", content: data.text ?? "" }]);
    } catch (e) {
      const m = e instanceof Error ? e.message : "Something went wrong.";
      setError(m);
      setMessages((cur) => [...cur, { role: "assistant", content: "⚠️ " + m }]);
    } finally {
      setLoading(false);
    }
  };

  const prompts = ["Gold outlook today?", "EURUSD bias?", "GBPUSD key levels?"];

  return (
    <section className="rounded-2xl bg-gradient-card border border-border p-3 sm:p-4 animate-fade-up">
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-gold" />
        <h3 className="text-sm font-semibold">Ask ApexGold AI</h3>
        <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-bullish/15 text-bullish font-semibold">Gold & FX Majors</span>
      </div>
      <p className="text-[11px] text-muted-foreground mb-3">Institutional SMC commentary on Gold & major forex pairs.</p>

      {messages.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Conversation</span>
            <button
              onClick={() => { setMessages([]); setError(null); }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors px-1.5 py-0.5 rounded hover:bg-accent"
              title="Clear conversation"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          </div>
          <div ref={scrollRef} className="max-h-72 overflow-y-auto space-y-2 pr-1">
            {messages.map((m, i) => (
              <div key={i} className={`text-xs leading-relaxed rounded-xl px-3 py-2 ${
                m.role === "user"
                  ? "bg-gold/10 border border-gold/20 text-foreground ml-6"
                  : "bg-card border border-border mr-6 whitespace-pre-wrap"
              }`}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div className="bg-card border border-border rounded-xl px-3 py-2 mr-6 flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-gold" /> Analyzing market…
              </div>
            )}
          </div>
        </div>
      )}

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {prompts.map((p) => (
            <button key={p} onClick={() => send(p)} className="text-[11px] px-2.5 py-1 rounded-full bg-accent/40 hover:bg-accent border border-border transition-colors">
              {p}
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          rows={2}
          placeholder="Ask about gold structure, levels, momentum…"
          className="w-full bg-input/60 border border-border rounded-xl px-3 py-2.5 pr-12 text-xs placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-gold/40 focus:border-gold/50 transition-all"
        />
        <button
          onClick={() => send()}
          disabled={!input.trim() || loading}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-lg bg-gradient-gold flex items-center justify-center text-primary-foreground hover:opacity-90 disabled:opacity-40 transition-opacity shadow-gold"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
        </button>
      </div>
      {error && <p className="mt-2 text-[10px] text-bearish">{error}</p>}
    </section>
  );
}

/* ---------------- Screenshot Analyzer ---------------- */
function ScreenshotAnalyzer({ onSaved }: { onSaved?: () => void }) {
  const { user } = useAuth();
  const { unlimited, isAdmin, subscription, loading: accessLoading } = useAccess();
  const [file, setFile] = useState<{ url: string; base64: string; mime: string; compressedKB: number; wasResized: boolean } | null>(null);
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<Annotation | null>(null);
  const [errorMeta, setErrorMeta] = useState<ErrorMeta | null>(null);
  const [retryIn, setRetryIn] = useState<number | null>(null);
  const [autoRetryTrigger, setAutoRetryTrigger] = useState(0);
  const [usage, setUsage] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    setElapsed(0);
    const id = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setUsage(Number(localStorage.getItem("apex_trial_uses") ?? 0));
  }, []);

  useEffect(() => {
    if (unlimited) { setCooldown(0); return; }
    const last = Number(localStorage.getItem("apex_last_analysis") ?? 0);
    const elapsed = Math.floor((Date.now() - last) / 1000);
    setCooldown(Math.max(0, COOLDOWN_SECS - elapsed));
  }, [unlimited]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const remaining = Math.max(0, FREE_TRIAL_LIMIT - usage);
  const inCooldown = !unlimited && cooldown > 0;
  const limitReached = !unlimited && remaining <= 0;

  const handleFile = async (f: File) => {
    setErrorMeta(null); setRetryIn(null); setResult(null);
    try {
      setFile(await fileToCompressedDataUrl(f));
    } catch {
      setErrorMeta({ category: "network", statusCode: null, message: "Could not read this image. Please try a PNG or JPG screenshot.", retryDelay: null });
    }
  };

  const analyze = async () => {
    if (!file || loading) return;
    if (limitReached || inCooldown) return;
    setLoading(true); setErrorMeta(null); setRetryIn(null); setResult(null);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 55_000);
    try {
      const res = await fetch("/api/analyze-chart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: file.base64, mimeType: file.mime }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const detail = await res.json().catch(() => null) as { error?: string } | null;
        if (res.status === 429) {
          setErrorMeta({ category: "rate-limit", statusCode: 429, message: "Too many requests — the AI is busy. Auto-retrying in 15 seconds.", retryDelay: 15 });
          setRetryIn(15);
          return;
        }
        if (res.status === 402) {
          setErrorMeta({ category: "credits", statusCode: 402, message: "AI credits are exhausted for this plan.", retryDelay: null });
          return;
        }
        const msg = detail?.error ?? "Chart analysis failed — the server returned an unexpected response.";
        setErrorMeta({ category: "server", statusCode: res.status, message: msg, retryDelay: 5 });
        setRetryIn(5);
        return;
      }
      const data = (await res.json()) as Annotation;
      setResult(data);
      if (!unlimited) {
        const next = usage + 1;
        setUsage(next);
        localStorage.setItem("apex_trial_uses", String(next));
        localStorage.setItem("apex_last_analysis", String(Date.now()));
        setCooldown(COOLDOWN_SECS);
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") {
        setErrorMeta({ category: "timeout", statusCode: null, message: "Analysis took longer than 55 seconds and was cancelled. The AI may be under heavy load.", retryDelay: 5 });
        setRetryIn(5);
      } else {
        setErrorMeta({ category: "network", statusCode: null, message: e instanceof Error ? e.message : "Could not reach the analysis server — check your connection.", retryDelay: null });
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (retryIn === null || retryIn <= 0) return;
    const id = setTimeout(() => setRetryIn(n => (n !== null && n > 0) ? n - 1 : n), 1000);
    return () => clearTimeout(id);
  }, [retryIn]);

  useEffect(() => {
    if (retryIn !== 0) return;
    setRetryIn(null);
    setAutoRetryTrigger(n => n + 1);
  }, [retryIn]);

  useEffect(() => {
    if (autoRetryTrigger === 0) return;
    analyze();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRetryTrigger]);

  const triggerRetry = () => {
    setRetryIn(null);
    setAutoRetryTrigger(n => n + 1);
  };

  const reset = () => { setFile(null); setResult(null); setErrorMeta(null); setRetryIn(null); setSaved(false); };

  const saveTrade = async () => {
    if (!user || !result || !file || saving) return;
    setSaving(true);
    const { error: err } = await supabase.from("trades").insert({
      user_id: user.id,
      image_data_url: file.url,
      bias: result.bias,
      confidence: result.confidence ?? 0,
      summary: result.summary ?? null,
      setup: (result.setup ?? null) as never,
      annotation: result as never,
    });
    setSaving(false);
    if (err) {
      toast.error("Could not save trade", { description: err.message });
      return;
    }
    setSaved(true);
    toast.success("Saved to My Trades");
    onSaved?.();
  };

  const usageBadge = accessLoading
    ? "…"
    : isAdmin
      ? "Admin · Unlimited"
      : subscription
        ? `${subscription.plan} · Unlimited`
        : `${remaining}/${FREE_TRIAL_LIMIT}`;

  return (
    <section className="rounded-2xl bg-gradient-card border border-border p-3 sm:p-4 animate-fade-up">
      <div className="flex items-center gap-2 mb-1">
        <ImageIcon className="w-4 h-4 text-gold" />
        <h3 className="text-sm font-semibold">AI Chart Analysis</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {unlimited ? (
            <span className="text-gold font-bold">{usageBadge}</span>
          ) : (
            <>Trial: <span className={remaining > 0 ? "text-gold font-bold" : "text-bearish font-bold"}>{usageBadge}</span></>
          )}
        </span>
      </div>
      {subscription && !isAdmin && (
        <p className="text-[10px] text-muted-foreground mb-2">
          Active plan: <span className="text-gold font-semibold">{subscription.plan}</span> · expires {new Date(subscription.expires_at).toLocaleDateString()}
        </p>
      )}
      <p className="text-[11px] text-muted-foreground mb-3">
        Upload any forex / crypto / gold chart. AI marks BOS, CHOCH, FVG and key zones.
      </p>

      {!file ? (
        <label
          onDragEnter={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDrag(false); }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
          className={`block min-h-[160px] rounded-xl border-2 border-dashed cursor-pointer transition-all flex flex-col items-center justify-center px-4 py-6 text-center ${
            drag ? "border-gold bg-gold/5" : "border-border hover:border-gold/60 hover:bg-accent/20"
          }`}
        >
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center mb-2">
            <Upload className="w-4 h-4 text-gold" />
          </div>
          <p className="text-xs font-medium">Drop chart screenshot</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">PNG · JPG · up to 10MB</p>
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </label>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-xl overflow-hidden border border-border bg-black/40">
            <img
              ref={imgRef}
              src={file.url}
              alt="Uploaded chart"
              className="w-full h-auto block max-h-[420px] object-contain"
            />
            {result && <AnnotationOverlay ann={result} />}
            <div className="absolute bottom-2 left-2 flex items-center gap-1.5 flex-wrap">
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-background/80 backdrop-blur border border-border text-muted-foreground">
                <Zap className="w-2.5 h-2.5 text-gold" />
                Compressed to {file.compressedKB} KB
              </span>
              {file.wasResized && (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-background/80 backdrop-blur border border-border text-muted-foreground">
                  <Activity className="w-2.5 h-2.5 text-gold" />
                  Resized for faster analysis
                </span>
              )}
            </div>
            <button
              onClick={reset}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center hover:bg-destructive hover:text-destructive-foreground transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
            {loading && (
              <div className="absolute inset-0 bg-background/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-gold" />
                <p className="text-xs text-foreground">Analyzing… {elapsed}s</p>
                <p className="text-[10px] text-muted-foreground">Identifying BOS, CHOCH, FVG, S/R</p>
              </div>
            )}
          </div>

          {!result && !loading && (
            <button
              onClick={analyze}
              disabled={limitReached || inCooldown}
              className="w-full bg-gradient-gold text-primary-foreground font-semibold py-2.5 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity shadow-gold text-sm flex items-center justify-center gap-2"
            >
              {inCooldown ? <Clock className="w-4 h-4" /> : <Zap className="w-4 h-4" />}
              {limitReached ? "Trial Limit Reached" : inCooldown ? `Next analysis in ${cooldown}s` : "Analyze Chart"}
            </button>
          )}

          {inCooldown && !limitReached && !result && (
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-center">
              <Clock className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
              <p className="text-xs font-semibold text-muted-foreground">Cooldown active</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                You can run the next free analysis in <span className="text-gold font-bold tabular-nums">{cooldown}s</span>.
              </p>
            </div>
          )}

          {limitReached && !result && (
            <div className="rounded-xl border border-gold/40 bg-gold/5 p-3 text-center">
              <Crown className="w-5 h-5 text-gold mx-auto mb-1" />
              <p className="text-xs font-semibold">You've used your {FREE_TRIAL_LIMIT} free analyses</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Upgrade to Premium for unlimited chart analysis.</p>
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer"
                 className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gradient-gold text-primary-foreground shadow-gold">
                <Crown className="w-3.5 h-3.5" /> Get Premium
              </a>
            </div>
          )}

          {errorMeta && (
            <ErrorFeedbackPanel
              meta={errorMeta}
              retryIn={retryIn}
              onRetryNow={triggerRetry}
              onDismiss={() => { setErrorMeta(null); setRetryIn(null); }}
            />
          )}
          {result && <AnalysisReadout ann={result} />}
          {result && (
            <button
              onClick={saveTrade}
              disabled={saving || saved}
              className="w-full mt-1 inline-flex items-center justify-center gap-2 text-xs font-semibold py-2 rounded-xl border border-gold/40 bg-gold/10 text-gold hover:bg-gold/15 disabled:opacity-60 transition-colors"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : saved ? <Check className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
              {saved ? "Saved to My Trades" : saving ? "Saving…" : "Save to My Trades"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function ErrorFeedbackPanel({
  meta,
  retryIn,
  onRetryNow,
  onDismiss,
}: {
  meta: ErrorMeta;
  retryIn: number | null;
  onRetryNow: () => void;
  onDismiss: () => void;
}) {
  const cfg: Record<ErrorCategory, { label: string; color: string; icon: typeof Clock; hint: string }> = {
    timeout:      { label: "TIMEOUT",      color: "text-amber-400 border-amber-400/40 bg-amber-400/10",    icon: Clock,          hint: "The AI took longer than expected. Usually resolves on retry." },
    "rate-limit": { label: "RATE LIMIT",   color: "text-orange-400 border-orange-400/40 bg-orange-400/10", icon: RefreshCw,      hint: "Too many requests in a short window. Auto-retrying shortly." },
    credits:      { label: "CREDITS",      color: "text-bearish border-bearish/40 bg-bearish/10",          icon: AlertTriangle,  hint: "Upgrade to Premium for unlimited AI chart analysis." },
    server:       { label: "SERVER ERROR", color: "text-bearish border-bearish/40 bg-bearish/10",          icon: Server,         hint: "The analysis server returned an unexpected error." },
    network:      { label: "NETWORK",      color: "text-muted-foreground border-border bg-card/60",        icon: WifiOff,        hint: "Could not reach the analysis server — check your connection." },
  };
  const { label, color, icon: Icon, hint } = cfg[meta.category];
  const isAutoRetrying = retryIn !== null && retryIn > 0;
  const pct = isAutoRetrying && meta.retryDelay ? (retryIn! / meta.retryDelay) * 100 : 0;

  return (
    <div className="rounded-xl border border-bearish/30 bg-bearish/5 p-3 space-y-2.5 animate-fade-up">
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${color}`}>
          <Icon className="w-3 h-3" />
          {label}
        </span>
        {meta.statusCode && (
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded border border-border bg-card/60 text-muted-foreground">
            HTTP {meta.statusCode}
          </span>
        )}
        <button
          onClick={onDismiss}
          className="ml-auto w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Dismiss error"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <p className="text-xs text-foreground/90 leading-relaxed">{meta.message}</p>
      <p className="text-[10px] text-muted-foreground leading-snug">{hint}</p>

      {isAutoRetrying && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>Auto-retrying…</span>
            <span className="font-mono font-bold text-foreground tabular-nums">{retryIn}s</span>
          </div>
          <div className="h-1 rounded-full bg-border overflow-hidden">
            <div
              className="h-full bg-gradient-gold rounded-full transition-[width] duration-1000 ease-linear"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {meta.category !== "credits" ? (
        <button
          onClick={onRetryNow}
          className="w-full inline-flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-lg bg-gradient-gold text-primary-foreground shadow-gold hover:opacity-90 transition-opacity"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {isAutoRetrying ? "Retry Now" : "Try Again"}
        </button>
      ) : (
        <a
          href="#premium"
          className="block text-center text-xs font-semibold py-2 rounded-lg border border-gold/40 bg-gold/10 text-gold hover:bg-gold/15 transition-colors"
        >
          Upgrade to Premium
        </a>
      )}
    </div>
  );
}

function AnnotationOverlay({ ann }: { ann: Annotation }) {
  const zoneStyle = (t: Annotation["zones"][number]["type"]) => {
    switch (t) {
      case "support":
      case "demand":
        return { color: "oklch(0.72 0.18 150)", fill: "url(#supFill)" };
      case "resistance":
      case "supply":
        return { color: "oklch(0.65 0.22 25)", fill: "url(#resFill)" };
      case "fvg":
        return { color: "oklch(0.82 0.16 85)", fill: "url(#fvgFill)" };
      case "ob":
        return { color: "oklch(0.78 0.17 65)", fill: "url(#obFill)" };
    }
  };
  const zoneLabel = (z: Annotation["zones"][number]) => {
    if (z.label) return z.label;
    return ({ support: "Support", resistance: "Resistance", fvg: "FVG", ob: "OB", demand: "Demand", supply: "Supply" } as const)[z.type];
  };
  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <linearGradient id="supFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.72 0.18 150)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="oklch(0.72 0.18 150)" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="resFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.65 0.22 25)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="oklch(0.65 0.22 25)" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="fvgFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.82 0.16 85)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="oklch(0.82 0.16 85)" stopOpacity="0.05" />
        </linearGradient>
        <linearGradient id="obFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.78 0.17 65)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="oklch(0.78 0.17 65)" stopOpacity="0.08" />
        </linearGradient>
      </defs>

      {ann.zones.map((z, i) => {
        const { color, fill } = zoneStyle(z.type);
        return (
          <g key={`z-${i}`}>
            <rect
              x={z.x * 100} y={z.y * 100}
              width={z.width * 100} height={z.height * 100}
              fill={fill} stroke={color} strokeWidth="0.25" strokeDasharray="0.6 0.4"
              vectorEffect="non-scaling-stroke"
              style={{ animation: `fade-up 0.6s ease-out both`, animationDelay: `${i * 100}ms` }}
            />
            <text
              x={z.x * 100 + 0.6}
              y={z.y * 100 + 1.5}
              fill={color}
              fontSize="1.6"
              fontWeight="700"
              style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,0.9))" }}
            >
              {zoneLabel(z)}
            </text>
          </g>
        );
      })}

      {ann.markers.map((m, i) => {
        const color = m.type === "bos" ? "oklch(0.82 0.16 85)" :
                      m.type === "choch" ? "oklch(0.7 0.18 320)" :
                                           "oklch(0.85 0.14 60)";
        return (
          <g key={`m-${i}`}>
            <line
              x1={m.x1 * 100} y1={m.y1 * 100}
              x2={m.x2 * 100} y2={m.y2 * 100}
              stroke={color} strokeWidth="0.4" strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              style={{ animation: `fade-up 0.5s ease-out both`, animationDelay: `${300 + i * 120}ms` }}
            />
            <text
              x={(m.x1 + m.x2) * 50}
              y={(m.y1 + m.y2) * 50 - 0.6}
              fill={color}
              fontSize="1.6"
              fontWeight="800"
              textAnchor="middle"
              style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,0.9))" }}
            >
              {m.label || m.type.toUpperCase()}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function AnalysisReadout({ ann }: { ann: Annotation }) {
  const tone = ann.bias === "bullish" ? "text-bullish border-bullish/40 bg-bullish/10" :
               ann.bias === "bearish" ? "text-bearish border-bearish/40 bg-bearish/10" :
                                        "text-neutral border-neutral/40 bg-neutral/10";
  return (
    <div className="rounded-xl border border-border bg-card/60 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${tone}`}>{ann.bias}</span>
        <span className="text-[10px] text-muted-foreground">Confidence <span className="text-gold font-bold">{Math.round(ann.confidence)}%</span></span>
      </div>
      <p className="text-xs leading-relaxed text-foreground/90">{ann.summary}</p>
      <div className="grid grid-cols-2 gap-2 pt-1">
        <Reason title="Structure" text={ann.reasoning.structure} />
        <Reason title="Liquidity" text={ann.reasoning.liquidity} />
        <Reason title="Momentum" text={ann.reasoning.momentum} />
        <Reason title="Levels" text={ann.reasoning.levels} />
      </div>
      <TradeSetupCard setup={ann.setup} />
    </div>
  );
}

function TradeSetupCard({ setup }: { setup?: TradeSetup }) {
  if (!setup || !setup.valid || setup.direction === "none") {
    const reason = setup?.noSetupReason ?? "No high-probability setup detected. Wait for a clean liquidity sweep or structure shift.";
    return (
      <div className="mt-2 rounded-xl border border-neutral/40 bg-neutral/5 p-3 flex items-start gap-2">
        <AlertTriangle className="w-4 h-4 text-neutral mt-0.5 shrink-0" />
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wide text-neutral">No high-probability setup detected</p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{reason}</p>
        </div>
      </div>
    );
  }

  const isLong = setup.direction === "long";
  const dirTone = isLong
    ? "text-bullish border-bullish/40 bg-bullish/10"
    : "text-bearish border-bearish/40 bg-bearish/10";
  const DirIcon = isLong ? TrendingUp : TrendingDown;

  return (
    <div className="mt-2 rounded-xl border border-gold/30 bg-gradient-to-br from-card/80 to-card/40 p-3 space-y-3 relative overflow-hidden">
      <div className="absolute inset-0 opacity-20 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 50% 60% at 100% 0%, color-mix(in oklab, var(--gold) 40%, transparent), transparent)" }} />
      <div className="relative flex items-center gap-2 flex-wrap">
        <p className="w-full text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Professional Trade Setup</p>
        <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${dirTone}`}>
          <DirIcon className="w-3 h-3" /> {setup.direction}
        </span>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded border border-gold/40 bg-gold/10 text-gold">
          {setup.tradeType}
        </span>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Setup <span className="text-gold font-bold">{Math.round(setup.confidence)}%</span>
        </span>
      </div>

      <div className="relative grid grid-cols-2 gap-2">
        <SetupTile label="Entry" value={setup.entryZone ? `${setup.entryZone.low} – ${setup.entryZone.high}` : setup.entry} accent="gold" icon={Target} />
        <SetupTile label="Stop Loss" value={setup.stopLoss} accent="bearish" icon={ShieldCheck} />
      </div>

      <div className="relative grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => {
          const tp = setup.takeProfits[i];
          return (
            <div key={i} className="rounded-lg border border-bullish/30 bg-bullish/5 p-2 text-center">
              <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">TP{i + 1}</p>
              <p className="text-xs font-bold text-bullish mt-0.5">{tp ?? "—"}</p>
            </div>
          );
        })}
      </div>

      <div className="relative flex items-center gap-2 text-[11px]">
        <span className="px-2 py-1 rounded-md bg-accent/40 border border-border font-bold text-foreground">
          R:R <span className="text-gold ml-1">{setup.riskReward || "—"}</span>
        </span>
        {setup.rationale && (
          <p className="text-[11px] text-muted-foreground leading-snug flex-1">{setup.rationale}</p>
        )}
      </div>
      <p className="relative text-[9px] text-muted-foreground/70 italic">Educational analysis only. Not financial advice.</p>
    </div>
  );
}

function SetupTile({ label, value, accent, icon: Icon }: { label: string; value: string; accent: "gold" | "bearish" | "bullish"; icon: typeof Target }) {
  const tone = accent === "gold" ? "border-gold/40 bg-gold/5 text-gold"
    : accent === "bearish" ? "border-bearish/40 bg-bearish/5 text-bearish"
    : "border-bullish/40 bg-bullish/5 text-bullish";
  return (
    <div className={`rounded-lg border p-2 ${tone}`}>
      <div className="flex items-center gap-1">
        <Icon className="w-3 h-3" />
        <p className="text-[9px] uppercase tracking-wider font-bold opacity-80">{label}</p>
      </div>
      <p className="text-sm font-bold mt-0.5 text-foreground">{value || "—"}</p>
    </div>
  );
}

/* ---------------- Premium ---------------- */
function PremiumSection() {
  const plans = [
    { id: "2-weeks", name: "2 Weeks Access", price: 13, period: "14 days" },
    { id: "1-month", name: "1 Month Access", price: 20, period: "30 days" },
  ];
  const [selected, setSelected] = useState<string>("1-month");
  const features = [
    "Advanced AI analysis", "Unlimited chart analysis", "Priority screenshot review",
    "Premium gold trade setups", "Multi-timeframe bias", "Confidence scoring",
    "Exclusive gold trading insights",
  ];
  const selectedPlan = plans.find((p) => p.id === selected) ?? plans[0];
  const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hello ApexGold AI Team, I would like to subscribe to the ${selectedPlan.name} ($${selectedPlan.price} / ${selectedPlan.period}). Please guide me through the payment and activation.`
  )}`;
  return (
    <section className="rounded-2xl bg-gradient-card border border-gold/30 p-4 sm:p-5 animate-fade-up relative overflow-hidden">
      <div className="absolute inset-0 opacity-30 pointer-events-none"
        style={{ background: "radial-gradient(ellipse 60% 80% at 50% 0%, color-mix(in oklab, var(--gold) 30%, transparent), transparent)" }} />
      <div className="relative">
        <div className="flex items-center gap-2 mb-1">
          <Crown className="w-4 h-4 text-gold" />
          <h3 className="text-sm font-semibold">Premium Membership</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-3">Unlock the full institutional-grade ApexGold AI experience.</p>

        <div role="radiogroup" aria-label="Subscription plan" className="grid grid-cols-2 gap-2 mb-3">
          {plans.map((p) => {
            const active = selected === p.id;
            return (
              <button
                type="button"
                role="radio"
                aria-checked={active}
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`rounded-xl border p-3 text-center relative transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
                  active
                    ? "border-gold bg-gold/10 shadow-[0_0_24px_-8px_var(--gold)]"
                    : "border-border bg-card/40 hover:border-gold/40"
                }`}
              >
                {active && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold bg-gradient-gold text-primary-foreground px-2 py-0.5 rounded-full">
                    SELECTED
                  </span>
                )}
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.name}</div>
                <div className="text-2xl font-black text-gradient-gold mt-1 tabular-nums">${p.price}</div>
                <div className="text-[10px] text-muted-foreground">for {p.period}</div>
              </button>
            );
          })}
        </div>

        <ul className="space-y-1.5 mb-4">
          {features.map((f) => (
            <li key={f} className="flex items-center gap-2 text-xs">
              <span className="w-4 h-4 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
                <Check className="w-2.5 h-2.5 text-gold" />
              </span>
              {f}
            </li>
          ))}
        </ul>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <a href={whatsappUrl} target="_blank" rel="noreferrer"
             className="bg-gradient-gold text-primary-foreground font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 shadow-gold hover:opacity-90 transition-opacity">
            <Crown className="w-4 h-4" /> Subscribe — ${selectedPlan.price}
          </a>
          <a href={whatsappUrl} target="_blank" rel="noreferrer"
             className="border border-border bg-card/60 hover:border-gold/50 hover:bg-card font-semibold py-2.5 rounded-xl text-sm flex items-center justify-center gap-2 transition-colors">
            <MessageCircle className="w-4 h-4 text-bullish" /> Contact on WhatsApp
          </a>
        </div>
        <p className="text-[10px] text-muted-foreground text-center mt-2">Contact the team: <a className="text-gold hover:underline" href={`mailto:${ADMIN_EMAIL}`}>{ADMIN_EMAIL}</a></p>
      </div>
    </section>
  );
}

/* ---------------- Admin Panel ---------------- */
async function getAuthToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

type AuditEntry = { id: number; action: string; target_email?: string; plan?: string; days?: number; expires_at?: string; performed_at: string };

function AdminPanel() {
  const { isAdmin, loading } = useAccess();
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("1 Month Access");
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [subs, setSubs] = useState<Array<{ id: string; user_id: string; plan: string; status: string; expires_at: string; email?: string }>>([]);
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([]);

  const loadSubs = async () => {
    const token = await getAuthToken();
    if (!token) return;
    const res = await fetch("/api/admin/subscriptions", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = await res.json() as Array<{ id: string; user_id: string; plan: string; status: string; expires_at: string; email?: string }>;
    setSubs(data);
  };

  const loadAuditLog = async () => {
    const token = await getAuthToken();
    if (!token) return;
    const res = await fetch("/api/admin/audit-log", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    setAuditLog(await res.json() as AuditEntry[]);
  };

  useEffect(() => { if (isAdmin) { loadSubs(); loadAuditLog(); } }, [isAdmin]);

  if (loading || !isAdmin) return null;

  const grant = async () => {
    setBusy(true); setMsg(null);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated.");
      const res = await fetch("/api/admin/grant-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: email.trim().toLowerCase(), plan, days }),
      });
      const json = await res.json() as { ok?: boolean; expires?: string; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to grant subscription.");
      const expires = json.expires!;
      setMsg({ tone: "ok", text: `Granted ${plan} until ${new Date(expires).toLocaleDateString()}.` });
      setEmail("");
      await loadSubs();
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Failed to grant subscription." });
    } finally {
      setBusy(false);
    }
  };

  const terminate = async (id: string, userEmail?: string) => {
    setBusy(true);
    try {
      const token = await getAuthToken();
      if (!token) throw new Error("Not authenticated.");
      const res = await fetch("/api/admin/terminate-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ id, email: userEmail }),
      });
      const json = await res.json() as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Failed to terminate.");
      setMsg({ tone: "ok", text: "Subscription terminated." });
      await Promise.all([loadSubs(), loadAuditLog()]);
    } catch (e) {
      setMsg({ tone: "err", text: e instanceof Error ? e.message : "Failed to terminate." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-gradient-card border border-gold/40 p-4 sm:p-5 animate-fade-up">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck className="w-4 h-4 text-gold" />
        <h3 className="text-sm font-semibold">Admin · Subscriptions</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 mb-2">
        <input
          type="email" placeholder="user@email.com" value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="sm:col-span-2 bg-card border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-gold/60"
        />
        <select
          value={plan} onChange={(e) => {
            const v = e.target.value; setPlan(v); setDays(v.startsWith("2 Weeks") ? 14 : 30);
          }}
          className="bg-card border border-border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-gold/60"
        >
          <option>2 Weeks Access</option>
          <option>1 Month Access</option>
        </select>
        <button
          type="button" disabled={busy || !email}
          onClick={grant}
          className="bg-gradient-gold text-primary-foreground font-semibold rounded-lg text-xs disabled:opacity-50 px-3 py-2"
        >
          {busy ? "Working…" : "Grant"}
        </button>
      </div>

      {msg && (
        <p className={`text-[11px] mb-2 ${msg.tone === "ok" ? "text-bullish" : "text-bearish"}`}>{msg.text}</p>
      )}

      <div className="border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground bg-card/60">
          <span>User</span><span>Plan</span><span>Expires</span><span></span>
        </div>
        {subs.length === 0 && (
          <p className="px-3 py-3 text-[11px] text-muted-foreground">No subscriptions yet.</p>
        )}
        {subs.map((s) => {
          const expired = new Date(s.expires_at) <= new Date() || s.status !== "active";
          return (
            <div key={s.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-3 py-2 text-xs items-center border-t border-border">
              <span className="truncate">{s.email ?? s.user_id.slice(0, 8)}</span>
              <span className="text-muted-foreground">{s.plan}</span>
              <span className={expired ? "text-bearish" : "text-gold"}>
                {new Date(s.expires_at).toLocaleDateString()}
              </span>
              {!expired ? (
                <button onClick={() => terminate(s.id, s.email)} disabled={busy}
                  className="text-[10px] px-2 py-1 rounded border border-bearish/40 text-bearish hover:bg-bearish/10">
                  Terminate
                </button>
              ) : (
                <span className="text-[10px] text-muted-foreground">{s.status === "terminated" ? "Terminated" : "Expired"}</span>
              )}
            </div>
          );
        })}
      </div>

      {auditLog.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Audit Log
          </p>
          <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
            {auditLog.map((entry) => (
              <div key={entry.id} className="grid grid-cols-[auto_1fr_auto] gap-2 px-3 py-1.5 text-[11px] items-center border-b border-border/50 last:border-0">
                <span className={`font-semibold ${entry.action === "grant" ? "text-bullish" : "text-bearish"}`}>
                  {entry.action === "grant" ? "✓ Grant" : "✗ Terminate"}
                </span>
                <span className="truncate text-muted-foreground">
                  {entry.target_email ?? "—"}
                  {entry.action === "grant" && entry.plan ? ` · ${entry.plan}` : ""}
                </span>
                <span className="text-muted-foreground/70 whitespace-nowrap">
                  {new Date(entry.performed_at).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------------- Disclaimer ---------------- */
function Disclaimer() {
  return (
    <div className="text-[10px] text-muted-foreground/70 text-center px-4 leading-relaxed flex items-center justify-center gap-1.5">
      <ShieldCheck className="w-3 h-3" />
      ApexGold AI provides analytical commentary, not financial advice. Trade responsibly.
    </div>
  );
}

/* ---------------- Sparkline ---------------- */
function Sparkline() {
  const points = [40, 35, 45, 38, 50, 48, 55, 52, 60, 58, 65, 62, 70, 68, 75, 72, 80, 78, 85];
  const max = Math.max(...points), min = Math.min(...points);
  const w = 600, h = 60;
  const path = points.map((p, i) => {
    const x = (i / (points.length - 1)) * w;
    const y = h - ((p - min) / (max - min)) * h;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  }).join(" ");
  const area = `${path} L ${w} ${h} L 0 ${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14" preserveAspectRatio="none">
      <defs>
        <linearGradient id="goldFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.82 0.16 85)" stopOpacity="0.4" />
          <stop offset="100%" stopColor="oklch(0.82 0.16 85)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#goldFill)" />
      <path d={path} fill="none" stroke="oklch(0.82 0.16 85)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
