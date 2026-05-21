const domain = process.env.EXPO_PUBLIC_DOMAIN;
const BASE = domain ? `https://${domain}` : "";

export async function fetchGoldPrice(): Promise<{ price: number; source: string; fetchedAt: number } | null> {
  try {
    const [own, external] = await Promise.allSettled([
      fetch(`${BASE}/api/gold-price`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)),
      fetch("https://api.gold-api.com/price/XAU", { headers: { accept: "application/json" } }).then((r) =>
        r.ok ? r.json().then((j: { price?: number }) => j.price ? { price: +j.price.toFixed(2), source: "gold-api", fetchedAt: Date.now() } : null) : null
      ),
    ]);
    const ownVal = own.status === "fulfilled" ? own.value : null;
    const extVal = external.status === "fulfilled" ? external.value : null;
    return ownVal ?? extVal ?? null;
  } catch {
    return null;
  }
}

export async function sendChatMessage(
  message: string,
  history: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  const r = await fetch(`${BASE}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, history }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Chat request failed");
  }
  const j = await r.json() as { text: string };
  return j.text;
}

export async function analyzeChart(imageBase64: string, mimeType: string): Promise<ChartAnalysis> {
  const r = await fetch(`${BASE}/api/analyze-chart`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ imageBase64, mimeType }),
  });
  if (!r.ok) {
    const e = await r.json().catch(() => ({})) as { error?: string };
    throw new Error(e.error ?? "Analysis failed");
  }
  return r.json() as Promise<ChartAnalysis>;
}

export type Bias = "bullish" | "bearish" | "neutral";

export interface ChartAnalysis {
  bias: Bias;
  confidence: number;
  summary: string;
  reasoning: { structure: string; liquidity: string; momentum: string; levels: string };
  zones: { type: string; x: number; y: number; width: number; height: number; label: string }[];
  markers: { type: string; x1: number; y1: number; x2: number; y2: number; label: string }[];
  setup?: {
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
}
