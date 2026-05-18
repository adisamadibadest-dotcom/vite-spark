import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";

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

export async function handleGoldPrice(): Promise<Response> {
  // Race both upstreams in parallel — first sane quote wins (closest to MT5 tick).
  const quote = await Promise.any([fromGoldApi(), fromMetalsLive()]).catch(() => null);
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
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const gateway = createLovableAiGatewayProvider(key);
  return gateway("google/gemini-3-flash-preview");
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
  bias: z.enum(["bullish", "bearish", "neutral"]),
  confidence: ConfidenceSchema,
  summary: z.string(),
  reasoning: z.object({
    structure: z.string(),
    liquidity: z.string(),
    momentum: z.string(),
    levels: z.string(),
  }),
  zones: z.array(z.object({
    type: z.enum(["support", "resistance", "fvg"]),
    x: NormalizedNumberSchema,
    y: NormalizedNumberSchema,
    width: NormalizedNumberSchema,
    height: NormalizedNumberSchema,
    label: z.string(),
  })).max(6),
  markers: z.array(z.object({
    type: z.enum(["bos", "choch", "liquidity"]),
    x1: NormalizedNumberSchema,
    y1: NormalizedNumberSchema,
    x2: NormalizedNumberSchema,
    y2: NormalizedNumberSchema,
    label: z.string(),
  })).max(5),
  setup: z.object({
    valid: z.boolean(),
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
  const hasActionableZone = annotation.zones.some((zone) => zone.type === "support" || zone.type === "resistance" || zone.type === "fvg");
  if (annotation.bias === "neutral" || annotation.confidence < 55 || !hasStructure || !hasActionableZone) {
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

const ANALYZE_SYSTEM = `You are an institutional chart analyst. The user uploads a trading chart screenshot (forex, crypto, or gold).

Your job:
- Read the visible price action carefully.
- Identify clean Smart Money Concepts: market structure, BOS, CHOCH, fair value gaps (FVG), key support/resistance zones, and obvious liquidity pools if visible.
- Output coordinates of annotations in NORMALIZED 0..1 space relative to the uploaded image (x grows right, y grows DOWN from the top edge).
- Keep it CLEAN: max 4 zones, max 4 markers. Do NOT label every swing high/low. No HH/HL/LH/LL clutter.
- Give realistic, tight zones (height ~0.03-0.08 of chart for S/R, ~0.02-0.05 for FVG).
- Markers are short line segments showing where a BOS or CHOCH happened — keep them short and on the right side of the chart.
- Your "summary" and "reasoning" MUST describe exactly what you drew. If you mark bullish BOS + support holding, the prose says bullish.
- Build a TRADE SETUP only when there is a clean institutional confluence (structure shift + liquidity sweep or clean S/R + FVG). Otherwise mark setup.valid = false and explain why in noSetupReason.
- The setup object is MANDATORY in every response. When setup.valid=true, entry, stopLoss, takeProfits with exactly TP1/TP2/TP3, riskReward, tradeType, confidence, and rationale are all REQUIRED.
- Use realistic prices read from the chart axis. Stop loss must sit beyond invalidation structure. TP1/TP2/TP3 must respect prior structure / liquidity / extensions.
- Risk-to-reward expressed against TP2, formatted like "1:2.4".
- Trade type: scalp (intraday minutes-hours, M1-M15), intraday (H1-H4, same day), swing (H4-D1+, multi-day).
- Tone: institutional desk note. No hype. End summary with: "Not financial advice."`;

function extractJsonObject(text: string): unknown {
  const cleaned = text.replace(/```(?:json)?/gi, "").replace(/```/g, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) throw new Error("AI returned unreadable chart analysis.");
    return JSON.parse(cleaned.slice(start, end + 1));
  }
}

function jsonInstruction() {
  return `Analyze this chart and return ONLY one valid JSON object, no markdown and no arrays.
Schema:
{
  "bias": "bullish" | "bearish" | "neutral",
  "confidence": number from 0 to 100,
  "summary": "2-3 sentence institutional commentary ending with: Not financial advice.",
  "reasoning": { "structure": "string", "liquidity": "string", "momentum": "string", "levels": "string" },
  "zones": [{ "type": "support" | "resistance" | "fvg", "x": 0.1, "y": 0.1, "width": 0.2, "height": 0.05, "label": "string" }],
  "markers": [{ "type": "bos" | "choch" | "liquidity", "x1": 0.1, "y1": 0.1, "x2": 0.2, "y2": 0.2, "label": "string" }],
  "setup": {
    "valid": true,
    "direction": "long" | "short" | "none",
    "tradeType": "scalp" | "intraday" | "swing" | "none",
    "confidence": number from 0 to 100,
    "entry": "2418.50",
    "entryZone": { "low": "2417.20", "high": "2419.40" },
    "stopLoss": "2412.80",
    "takeProfits": ["2425.00", "2432.50", "2441.00"],
    "riskReward": "1:2.4",
    "rationale": "1-2 sentence institutional reasoning for the entry.",
    "noSetupReason": "Optional. Required when valid=false. Example: Price mid-range with no liquidity sweep."
  }
}
Coordinates must be normalized decimals between 0 and 1 relative to the uploaded image. Keep max 4 zones and max 4 markers. If no high-probability setup, set setup.valid=false, direction="none", tradeType="none", confidence<=35, leave entry/SL/TP empty arrays/strings, and fill noSetupReason.`;
}

export async function handleAnalyzeChart(request: Request): Promise<Response> {
  try {
    const { imageBase64, mimeType } = (await request.json()) as {
      imageBase64?: string;
      mimeType?: string;
    };
    if (!imageBase64) return new Response("imageBase64 required", { status: 400 });

    const { text } = await generateText({
      model: getAiModel(),
      temperature: 0.2,
      system: ANALYZE_SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: jsonInstruction() },
            { type: "image", image: `data:${mimeType ?? "image/png"};base64,${imageBase64}` },
          ],
        },
      ],
    });

    const object = completeTradeSetup(AnnotationSchema.parse(extractJsonObject(text)));
    return Response.json(object);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI error";
    const status = /429/.test(msg) ? 429 : /402/.test(msg) ? 402 : 500;
    return Response.json({ error: msg }, { status });
  }
}
