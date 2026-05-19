import { generateText } from "ai";
import { z } from "zod";
import { google } from "@ai-sdk/google";

type GoldQuote = { price: number; source: string; fetchedAt: number };

async function fromGoldApi(): Promise<GoldQuote | null> {
  try {
    const r = await fetch("https://api.gold-api.com/price/XAU", {
      headers: { accept: "application/json" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { price?: number };
    if (typeof j.price === "number" && j.price > 500 && j.price < 10000) {
      return { price: +j.price.toFixed(2), source: "gold-api", fetchedAt: Date.now() };
    }
  } catch {}
  return null;
}

async function fromMetalsLive(): Promise<GoldQuote | null> {
  try {
    const r = await fetch("https://data-asg.goldprice.org/dbXRates/USD", {
      headers: { accept: "application/json", "user-agent": "Mozilla/5.0" },
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { items?: { xauPrice?: number }[] };
    const p = j.items?.[0]?.xauPrice;
    if (typeof p === "number" && p > 500 && p < 10000) {
      return { price: +p.toFixed(2), source: "goldprice.org", fetchedAt: Date.now() };
    }
  } catch {}
  return null;
}

async function requireQuote(source: Promise<GoldQuote | null>): Promise<GoldQuote> {
  const quote = await source;
  if (!quote) throw new Error("No quote from upstream");
  return quote;
}

export async function handleGoldPrice(): Promise<Response> {
  // Race both upstreams in parallel — first sane quote wins. Null/failed feeds are ignored.
  const quote = await Promise.any([
    requireQuote(fromGoldApi()),
    requireQuote(fromMetalsLive()),
  ]).catch(() => null);
  if (!quote) return Response.json({ error: "Unable to fetch gold price" }, { status: 502 });
  return Response.json(quote, {
    status: 200,
    headers: { "cache-control": "no-store, must-revalidate" },
  });
}

const CHAT_SYSTEM_PROMPT = `You are ApexGold AI, an institutional-grade Gold (XAU/USD) trading assistant.

Respond like a senior FX/commodities desk strategist. Every reply MUST be concise (90-140 words) and cover, in this order:

1. **Bias** — Bullish / Bearish / Neutral with the key level that defines it.
2. **Structure & Liquidity** — recent BOS/CHOCH, swept liquidity pools, fair value gaps if relevant.
3. **Momentum** — short-term momentum read (RSI/volume tone in plain words).
4. **Targets** — 1-2 upside or downside levels (use realistic XAUUSD prices around the 2,300-2,500 zone unless the user specifies otherwise).
5. **Invalidation** — the price that flips the thesis.
6. **Risk note** — one short line. Always include: "Not financial advice."

Tone: professional, calm, data-driven. No hype, no emojis. Use precise prices like 2,418.65. If the user uploads or references a chart, ground your commentary in classic SMC/ICT concepts (BOS, CHOCH, FVG, liquidity sweeps, OB).`;

function getAiModel() {
  const key = process.env.GEMINI_API_KEY;

  if (!key) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  return google({
  model: "gemini-2.0-flash",
  apiKey: key,
});
}

export async function handleChat(request: Request): Promise<Response> {
  try {
    const { message, history } = (await request.json()) as {
      message?: string;
      history?: { role: "user" | "assistant"; content: string }[];
    };
    if (!message?.trim()) return new Response("message required", { status: 400 });

    const { text } = await generateText({
      model: getAiModel(),
      system: CHAT_SYSTEM_PROMPT,
      messages: [
        ...(history ?? []).slice(-8).map((m) => ({ role: m.role, content: m.content })),
        { role: "user", content: message },
      ],
    });

    return Response.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI error";
    const status = /429/.test(msg) ? 429 : /402/.test(msg) ? 402 : /Missing LOVABLE_API_KEY/.test(msg) ? 500 : 500;
    return Response.json({ error: msg }, { status });
  }
}

const NormalizedNumberSchema = z.preprocess((value) => {
  if (typeof value !== "number") return value;
  if (value > 1 && value <= 100) return value / 100;
  return value;
}, z.number().min(0).max(1));

const ConfidenceSchema = z.preprocess((value) => {
  if (typeof value !== "number") return value;
  return value <= 1 ? value * 100 : value;
}, z.number().min(0).max(100));

const AnnotationSchema = z.object({
  bias: z.enum(["bullish", "bearish", "neutral"]).default("neutral"),
  confidence: ConfidenceSchema.default(0),
  summary: z.string().default(""),
  reasoning: z.object({
    structure: z.string().default(""),
    liquidity: z.string().default(""),
    momentum: z.string().default(""),
    levels: z.string().default(""),
  }).default({ structure: "", liquidity: "", momentum: "", levels: "" }),
  zones: z.array(z.object({
    type: z.enum(["support", "resistance", "fvg", "ob", "demand", "supply"]),
    x: NormalizedNumberSchema,
    y: NormalizedNumberSchema,
    width: NormalizedNumberSchema,
    height: NormalizedNumberSchema,
    label: z.string().default(""),
  })).max(8).default([]),
  markers: z.array(z.object({
    type: z.enum(["bos", "choch", "liquidity", "sweep"]).transform((v) => (v === "sweep" ? "liquidity" : v) as "bos" | "choch" | "liquidity"),
    x1: NormalizedNumberSchema,
    y1: NormalizedNumberSchema,
    x2: NormalizedNumberSchema,
    y2: NormalizedNumberSchema,
    label: z.string().default(""),
  })).max(6).default([]),
  setup: z.object({
    valid: z.boolean().default(false),
    direction: z.enum(["long", "short", "none"]).default("none"),
    tradeType: z.enum(["scalp", "intraday", "swing", "none"]).default("none"),
    confidence: ConfidenceSchema.default(0),
    entry: z.string().default(""),
    entryZone: z.object({ low: z.string(), high: z.string() }).optional(),
    stopLoss: z.string().default(""),
    takeProfits: z.array(z.string()).max(3).default([]),
    riskReward: z.string().default(""),
    rationale: z.string().default(""),
    noSetupReason: z.string().optional(),
  }).default({
    valid: false,
    direction: "none",
    tradeType: "none",
    confidence: 0,
    entry: "",
    stopLoss: "",
    takeProfits: [],
    riskReward: "",
    rationale: "",
    noSetupReason: "No high-probability setup detected.",
  }),
});

export type ChartAnnotations = z.infer<typeof AnnotationSchema>;
type TradeSetup = NonNullable<ChartAnnotations["setup"]>;

function extractPricesFromAnalysis(annotation: ChartAnnotations): number[] {
  const text = [
    annotation.summary,
    annotation.reasoning.structure,
    annotation.reasoning.liquidity,
    annotation.reasoning.momentum,
    annotation.reasoning.levels,
    ...annotation.zones.map((zone) => zone.label),
    ...(annotation.setup ? [annotation.setup.entry, annotation.setup.stopLoss, ...annotation.setup.takeProfits] : []),
  ].join(" ");

  const matches = text.match(/\b\d{1,6}(?:,\d{3})*(?:\.\d{1,5})\b/g) ?? [];
  return Array.from(new Set(matches
    .map((value) => Number(value.replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0)))
    .sort((a, b) => a - b);
}

function formatPrice(value: number, referencePrices: number[]) {
  const decimalPlaces = Math.max(2, ...referencePrices.map((price) => {
    const [, decimal = ""] = String(price).split(".");
    return Math.min(decimal.length, 5);
  }));
  return value.toFixed(Math.min(decimalPlaces, 5));
}

function inferTradeType(annotation: ChartAnnotations): TradeSetup["tradeType"] {
  const text = `${annotation.summary} ${Object.values(annotation.reasoning).join(" ")}`.toLowerCase();
  if (/\b(m1|m5|m15|1m|5m|15m)\b/.test(text)) return "scalp";
  if (/\b(d1|daily|w1|weekly)\b/.test(text)) return "swing";
  return "intraday";
}

function completeTradeSetup(annotation: ChartAnnotations): ChartAnnotations {
  const current = annotation.setup;
  if (current?.valid && current.direction !== "none" && (current.entry || current.entryZone) && current.stopLoss && current.takeProfits.length >= 3 && current.riskReward) {
    return annotation;
  }

  const hasStructure = annotation.markers.some((marker) => marker.type === "bos" || marker.type === "choch");
  const hasActionableZone = annotation.zones.length > 0;
  if (annotation.bias === "neutral" || annotation.confidence < 50 || (!hasStructure && !hasActionableZone)) {
    return {
      ...annotation,
      setup: {
        valid: false,
        direction: "none",
        tradeType: "none",
        confidence: Math.min(annotation.confidence, 35),
        entry: "",
        stopLoss: "",
        takeProfits: [],
        riskReward: "",
        rationale: "",
        noSetupReason: current?.noSetupReason ?? "No high-probability setup detected.",
      },
    };
  }

  const prices = extractPricesFromAnalysis(annotation);
  if (prices.length < 2) return annotation;

  const isLong = annotation.bias === "bullish";
  const direction = isLong ? "long" : "short";
  const entry = isLong ? prices[Math.min(1, prices.length - 1)] : prices[Math.max(prices.length - 2, 0)];
  let stop = isLong ? prices[0] : prices[prices.length - 1];
  if (Math.abs(entry - stop) === 0) stop = isLong ? entry * 0.998 : entry * 1.002;
  const risk = Math.abs(entry - stop);
  const tp1 = isLong ? entry + risk : entry - risk;
  const tp2 = isLong ? entry + risk * 2 : entry - risk * 2;
  const nearestTarget = isLong ? prices.find((price) => price > entry + risk * 2.5) : [...prices].reverse().find((price) => price < entry - risk * 2.5);
  const tp3 = nearestTarget ?? (isLong ? entry + risk * 3 : entry - risk * 3);
  const fallbackTakeProfits = [tp1, tp2, tp3].map((price) => formatPrice(price, prices));
  const takeProfits = [...(current?.takeProfits ?? []), ...fallbackTakeProfits].filter(Boolean).slice(0, 3);

  return {
    ...annotation,
    setup: {
      valid: true,
      direction,
      tradeType: current?.tradeType && current.tradeType !== "none" ? current.tradeType : inferTradeType(annotation),
      confidence: current?.confidence && current.confidence > 0 ? current.confidence : Math.max(60, Math.min(90, annotation.confidence - 5)),
      entry: current?.entry || formatPrice(entry, prices),
      entryZone: current?.entryZone,
      stopLoss: current?.stopLoss || formatPrice(stop, prices),
      takeProfits,
      riskReward: current?.riskReward || `1:${(Math.abs(tp2 - entry) / risk).toFixed(1)}`,
      rationale: current?.rationale || `${isLong ? "Bullish" : "Bearish"} continuation setup from the identified institutional zone after structure confirmation and liquidity context.`,
    },
  };
}

const ANALYZE_SYSTEM = `You are a senior institutional Smart Money Concepts (SMC / ICT) chart analyst. The user uploads a trading chart screenshot (forex, crypto, gold).

Your job:
- Read the visible price action carefully and identify: overall trend / market structure, BOS (break of structure), CHOCH (change of character), liquidity sweeps (buy-side / sell-side liquidity grabs), order blocks (OB), fair value gaps (FVG / imbalances), supply and demand zones, and key support/resistance.
- Mark them ON the chart using NORMALIZED 0..1 coordinates relative to the image (x grows right, y grows DOWN from the top edge).
- Be CLEAN and SELECTIVE: max 6 zones, max 5 markers. No HH/HL/LH/LL clutter. Tight zones (height 0.02-0.08).
- Zone types:
    * "ob"          — order block (bullish or bearish OB) — label like "Bull OB" / "Bear OB"
    * "demand"      — institutional demand zone
    * "supply"      — institutional supply zone
    * "fvg"         — fair value gap / imbalance
    * "support"     — major horizontal support
    * "resistance"  — major horizontal resistance
- Marker types:
    * "bos"        — break of structure (short line segment at the break)
    * "choch"      — change of character
    * "liquidity"  — liquidity sweep (label "BSL swept" / "SSL swept")
- summary + reasoning MUST match what you drew. If bullish BOS + demand holding, bias = bullish.
- TRADE SETUP is MANDATORY. Build a high-probability institutional setup whenever the structure + one zone of confluence is clearly visible. Only set valid=false if the chart is mid-range with no actionable structure — then fill noSetupReason.
- When valid=true: entry (or entryZone), stopLoss beyond invalidation, exactly TP1/TP2/TP3 respecting structure / liquidity / extensions, riskReward vs TP2 (e.g. "1:2.4"), tradeType (scalp = M1-M15, intraday = H1-H4, swing = H4-D1+), confidence 0-100, and a 1-2 sentence institutional rationale.
- Prices must be read off the visible chart axis and look realistic.
- Tone: institutional desk note. No hype. End summary with: "Not financial advice."`;

function extractJsonObject(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("AI returned unreadable chart analysis.");
  return JSON.parse(cleaned.slice(start, end + 1));
}

function jsonInstruction() {
  return `Analyze this chart and return ONLY one valid JSON object — no markdown, no prose, no arrays at the root.
Schema:
{
  "bias": "bullish" | "bearish" | "neutral",
  "confidence": 0-100,
  "summary": "2-3 sentence institutional desk note ending with: Not financial advice.",
  "reasoning": { "structure": "string", "liquidity": "string", "momentum": "string", "levels": "string" },
  "zones": [{ "type": "support"|"resistance"|"fvg"|"ob"|"demand"|"supply", "x": 0.1, "y": 0.1, "width": 0.2, "height": 0.05, "label": "string" }],
  "markers": [{ "type": "bos"|"choch"|"liquidity", "x1": 0.1, "y1": 0.1, "x2": 0.2, "y2": 0.2, "label": "string" }],
  "setup": {
    "valid": true,
    "direction": "long"|"short"|"none",
    "tradeType": "scalp"|"intraday"|"swing"|"none",
    "confidence": 0-100,
    "entry": "2418.50",
    "entryZone": { "low": "2417.20", "high": "2419.40" },
    "stopLoss": "2412.80",
    "takeProfits": ["2425.00", "2432.50", "2441.00"],
    "riskReward": "1:2.4",
    "rationale": "1-2 sentence institutional reasoning.",
    "noSetupReason": "Only when valid=false."
  }
}
Coordinates are normalized decimals between 0 and 1 relative to the uploaded image. Max 6 zones, max 5 markers.`;
}

async function generateChartAnalysis(imageBase64: string, mimeType: string) {
  return generateText({
    model: getAiModel(),
    temperature: 0.2,
    system: ANALYZE_SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: jsonInstruction() },
          { type: "image", image: `data:${mimeType};base64,${imageBase64}` },
        ],
      },
    ],
  });
}

export async function handleAnalyzeChart(request: Request): Promise<Response> {
  try {
    const { imageBase64, mimeType } = (await request.json()) as {
      imageBase64?: string;
      mimeType?: string;
    };
    if (!imageBase64) return new Response("imageBase64 required", { status: 400 });
    if (imageBase64.length > 3_800_000) {
      return Response.json({ error: "Image is too large. Please upload a smaller screenshot." }, { status: 413 });
    }
    const mt = mimeType ?? "image/png";

    let lastErr: unknown = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { text } = await generateChartAnalysis(imageBase64, mt);
        const parsed = AnnotationSchema.parse(extractJsonObject(text));
        return Response.json(completeTradeSetup(parsed));
      } catch (e) {
        lastErr = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (/429|402/.test(msg)) break; // don't retry rate-limit / payment
      }
    }
    throw lastErr ?? new Error("AI error");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI error";
    const status = /429/.test(msg) ? 429 : /402/.test(msg) ? 402 : 500;
    return Response.json({ error: msg }, { status });
  }
}
