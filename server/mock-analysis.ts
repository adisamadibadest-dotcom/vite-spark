/**
 * Mock analysis engine for ApexGold AI.
 *
 * Returns realistic-looking XAUUSD chart analysis without any external API call.
 * Swap this out by replacing the two exported functions with real AI calls.
 *
 * Architecture note: this module is the ONLY place to change when re-enabling AI.
 * Both handleAnalyzeChart and handleChat in handlers.ts delegate here.
 */

import type { ChartAnnotations } from "./handlers.js";

function hash(str: string): number {
  let h = 5381;
  for (let i = 0; i < Math.min(str.length, 200); i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick<T>(arr: T[], seed: number, offset = 0): T {
  return arr[(seed + offset) % arr.length];
}

function fmt(n: number): string {
  return n.toFixed(2);
}

type Bias = "bullish" | "bearish" | "neutral";

interface ScenarioTemplate {
  bias: Bias;
  confidence: number;
  structure: string;
  liquidity: string;
  momentum: string;
  levels: string;
  summary: string;
  direction: "long" | "short" | "none";
  tradeType: "scalp" | "intraday" | "swing" | "none";
  rrRatio: number;
  stopPct: number;
  tp1Pct: number;
  tp2Pct: number;
  tp3Pct: number;
  zoneTypes: Array<"ob" | "demand" | "supply" | "fvg" | "support" | "resistance">;
  markerTypes: Array<"bos" | "choch" | "liquidity">;
}

const SCENARIOS: ScenarioTemplate[] = [
  {
    bias: "bullish",
    confidence: 76,
    structure: "Higher highs and higher lows sustained above the daily 50 EMA. A clear BOS to the upside was printed on H4, confirming demand-side dominance.",
    liquidity: "Buy-side liquidity resting above the prior swing high at the key level. Equal highs identified — price likely to raid before continuation.",
    momentum: "RSI holding above 55, bullish divergence on H1. Volume expanding on up-candles.",
    levels: "Key demand block: lower band. Weekly resistance confluence overhead.",
    summary: "Price is in a confirmed bullish leg following a clean H4 BOS. Structure favors long continuation with a re-test of the demand OB in play. Momentum supports the thesis. Not financial advice.",
    direction: "long",
    tradeType: "intraday",
    rrRatio: 2.4,
    stopPct: 0.0035,
    tp1Pct: 0.004,
    tp2Pct: 0.008,
    tp3Pct: 0.014,
    zoneTypes: ["ob", "demand", "resistance", "fvg"],
    markerTypes: ["bos", "liquidity"],
  },
  {
    bias: "bearish",
    confidence: 71,
    structure: "Lower lows confirmed after a CHOCH on H4. Price trading below the 4H 20 EMA, structure flipped bearish. Distribution phase visible on higher timeframe.",
    liquidity: "Sell-side liquidity pool sitting below recent lows. Sellside engineered — smart money likely targeting that zone.",
    momentum: "RSI rejected from 55 zone, bearish tone. Decreasing volume on rallies indicates weak buying pressure.",
    levels: "Supply zone overhead acting as resistance. Prior support now flipped to resistance confluence.",
    summary: "Bearish structure confirmed with CHOCH on H4. Supply zone overhead has capped multiple rallies. Bias remains short until structure shifts. Not financial advice.",
    direction: "short",
    tradeType: "intraday",
    rrRatio: 2.1,
    stopPct: 0.003,
    tp1Pct: 0.0035,
    tp2Pct: 0.007,
    tp3Pct: 0.012,
    zoneTypes: ["supply", "resistance", "fvg", "ob"],
    markerTypes: ["choch", "liquidity"],
  },
  {
    bias: "bullish",
    confidence: 83,
    structure: "Strong bullish impulse leg off weekly demand. BOS on both H4 and H1 confirmed. Institutional orderflow aligned to the upside with clean market structure.",
    liquidity: "Buyside liquidity engineered above equal highs. Inducement complete — expecting displacement to the upside targeting untapped premium array.",
    momentum: "Strong bullish momentum with price trading far from mean. MACD bullish cross on H4. High probability continuation.",
    levels: "Immediate support: demand OB low. Target zone: weekly resistance level with prior imbalance fill.",
    summary: "High-conviction bullish setup with clean BOS confirmation and untapped FVG as magnet above. Risk is well-defined at OB low. Not financial advice.",
    direction: "long",
    tradeType: "swing",
    rrRatio: 3.1,
    stopPct: 0.004,
    tp1Pct: 0.006,
    tp2Pct: 0.012,
    tp3Pct: 0.02,
    zoneTypes: ["demand", "fvg", "support", "ob"],
    markerTypes: ["bos", "bos", "liquidity"],
  },
  {
    bias: "bearish",
    confidence: 68,
    structure: "Failed rally below broken support now acting as resistance. Bearish CHOCH on M15 confirmed lower timeframe intent. H4 remains in down-trend.",
    liquidity: "SSL pool resting below the Asian session low. Price likely to sweep before any meaningful reaction.",
    momentum: "Bearish momentum; RSI below 45. Wicks to the upside rejected consistently — no follow-through buying.",
    levels: "Resistance: prior support turned resistance. Target: equal lows liquidity pool below.",
    summary: "Bearish continuation aligned on multiple timeframes. Rejection from broken support confirms supply overhead. Targeting sell-side liquidity below. Not financial advice.",
    direction: "short",
    tradeType: "scalp",
    rrRatio: 1.8,
    stopPct: 0.002,
    tp1Pct: 0.002,
    tp2Pct: 0.004,
    tp3Pct: 0.007,
    zoneTypes: ["supply", "resistance", "fvg"],
    markerTypes: ["choch", "liquidity"],
  },
  {
    bias: "neutral",
    confidence: 44,
    structure: "Price consolidating within a defined range. No clear BOS in either direction. Market in equilibrium — higher timeframe bias unclear without further confirmation.",
    liquidity: "Liquidity pools on both sides of the range. No clear directional sweep yet. Waiting for raid and displacement before committing.",
    momentum: "RSI ranging between 40-60. No directional conviction. Volume light and contracting.",
    levels: "Range high as resistance; range low as support. Breakout direction will define the next leg.",
    summary: "Price in consolidation with no clear directional bias. Smart money accumulation or distribution phase — waiting for a confirmed breakout with displacement. Not financial advice.",
    direction: "none",
    tradeType: "none",
    rrRatio: 0,
    stopPct: 0,
    tp1Pct: 0,
    tp2Pct: 0,
    tp3Pct: 0,
    zoneTypes: ["support", "resistance"],
    markerTypes: ["liquidity"],
  },
  {
    bias: "bullish",
    confidence: 61,
    structure: "Bullish BOS on M15 within an H4 bearish trend — potential reversal signal at daily demand. Need higher timeframe confirmation, but short-term bias is long.",
    liquidity: "BSL resting above M15 highs. Internal BOS confirmed. Price likely inducing before the real move up.",
    momentum: "Bullish divergence on RSI. Price holding above short-term EMA. Cautious but leaning long.",
    levels: "Immediate demand: M15 OB. Overhead resistance at H4 supply — key decision point.",
    summary: "Lower-timeframe bullish BOS at daily demand zone. Caution advised given higher-timeframe context, but short-term long setups valid within the OB. Not financial advice.",
    direction: "long",
    tradeType: "scalp",
    rrRatio: 1.9,
    stopPct: 0.0025,
    tp1Pct: 0.003,
    tp2Pct: 0.005,
    tp3Pct: 0.009,
    zoneTypes: ["demand", "ob", "resistance"],
    markerTypes: ["bos", "liquidity"],
  },
];

const CHAT_RESPONSES = [
  (price: number) => `**Bias: Bullish** — Key level defining the thesis: ${fmt(price - 18)}.

**Structure & Liquidity:** H4 BOS to the upside confirmed. Buy-side liquidity resting at ${fmt(price + 22)} (equal highs). Clean demand OB at ${fmt(price - 28)}–${fmt(price - 18)} acting as the launchpad.

**Momentum:** RSI above 55 on H1, bullish divergence forming on M15. Volume expanding on up-candles — institutional participation evident.

**Targets:** TP1 ${fmt(price + 18)}, TP2 ${fmt(price + 40)}.

**Invalidation:** Close below ${fmt(price - 35)} on H1 flips the thesis to neutral.

*Risk note: Position sizing critical here. Not financial advice.*`,

  (price: number) => `**Bias: Bearish** — Key level: ${fmt(price + 15)} supply confluence.

**Structure & Liquidity:** CHOCH confirmed on H4 after rejection from weekly supply. Sell-side liquidity pool at ${fmt(price - 25)} is the primary target. Prior support at ${fmt(price - 8)} now acting as resistance.

**Momentum:** RSI rolling over from 60, bearish divergence on H4. Wicks to the upside being sold aggressively.

**Targets:** TP1 ${fmt(price - 20)}, TP2 ${fmt(price - 45)}.

**Invalidation:** Reclaim of ${fmt(price + 20)} invalidates the short bias.

*Risk note: Aggressive structure — keep risk tight. Not financial advice.*`,

  (price: number) => `**Bias: Neutral** — Price in equilibrium between ${fmt(price - 30)} and ${fmt(price + 30)}.

**Structure & Liquidity:** No directional BOS confirmed. Liquidity pools on both sides of the range. Smart money accumulation or distribution phase — premature to commit directionally.

**Momentum:** RSI ranging 40–55. Volume light. No displacement candles visible.

**Targets:** Wait for a confirmed range break with strong displacement volume before entering. Breakout above ${fmt(price + 32)} is bullish; below ${fmt(price - 32)} is bearish.

**Invalidation:** N/A — waiting for structure confirmation.

*Risk note: Patience is a position. Not financial advice.*`,

  (price: number) => `**Bias: Bullish** — Institutional demand confirmed at ${fmt(price - 45)}.

**Structure & Liquidity:** Weekly BOS to the upside with clean impulse leg. FVG imbalance at ${fmt(price - 22)}–${fmt(price - 14)} acting as a magnet for a pullback before continuation. Equal highs at ${fmt(price + 55)} represent the primary BSL target.

**Momentum:** Strong bullish momentum — price extended from mean but daily structure supports continuation. RSI holding 60+.

**Targets:** TP1 ${fmt(price + 28)}, TP2 ${fmt(price + 55)}.

**Invalidation:** Breach of daily OB low at ${fmt(price - 50)} on close.

*Risk note: Extended — manage partials at TP1. Not financial advice.*`,
];

export function mockAnalyzeChart(imageBase64: string): ChartAnnotations {
  const seed = hash(imageBase64.slice(0, 500));
  const scenario = pick(SCENARIOS, seed);

  const BASE = 4510;
  const priceSeed = (seed % 400) - 200;
  const mid = BASE + priceSeed;

  const stop = scenario.direction === "long"
    ? mid - mid * scenario.stopPct
    : scenario.direction === "short"
    ? mid + mid * scenario.stopPct
    : mid;

  const tp1 = scenario.direction === "long"
    ? mid + mid * scenario.tp1Pct
    : scenario.direction === "short"
    ? mid - mid * scenario.tp1Pct
    : mid;

  const tp2 = scenario.direction === "long"
    ? mid + mid * scenario.tp2Pct
    : scenario.direction === "short"
    ? mid - mid * scenario.tp2Pct
    : mid;

  const tp3 = scenario.direction === "long"
    ? mid + mid * scenario.tp3Pct
    : scenario.direction === "short"
    ? mid - mid * scenario.tp3Pct
    : mid;

  const zones: ChartAnnotations["zones"] = scenario.zoneTypes.slice(0, 6).map((type, i) => {
    const yBase = 0.15 + i * 0.13;
    const xBase = 0.1 + i * 0.05;
    return {
      type,
      x: +(xBase % 0.7).toFixed(3),
      y: +(yBase % 0.85).toFixed(3),
      width: +(0.12 + (seed % 10) * 0.008).toFixed(3),
      height: +(0.03 + (seed % 5) * 0.006).toFixed(3),
      label: type === "ob" ? "Order Block"
        : type === "demand" ? `Demand ${fmt(mid - mid * scenario.stopPct * 1.5)}`
        : type === "supply" ? `Supply ${fmt(mid + mid * scenario.stopPct * 1.5)}`
        : type === "fvg" ? "Fair Value Gap"
        : type === "support" ? `Support ${fmt(stop)}`
        : `Resistance ${fmt(tp2)}`,
    };
  });

  const markers: ChartAnnotations["markers"] = scenario.markerTypes.slice(0, 5).map((type, i) => {
    const x1 = +(0.1 + i * 0.18).toFixed(3);
    const y1 = +(0.25 + (i % 3) * 0.15).toFixed(3);
    return {
      type,
      x1,
      y1,
      x2: +(x1 + 0.12).toFixed(3),
      y2: +(y1 + (type === "liquidity" ? 0 : 0.04)).toFixed(3),
      label: type === "bos" ? "BOS" : type === "choch" ? "CHOCH" : "SSL",
    };
  });

  const setup: ChartAnnotations["setup"] = scenario.direction === "none"
    ? {
        valid: false,
        direction: "none",
        tradeType: "none",
        confidence: 0,
        entry: "",
        stopLoss: "",
        takeProfits: [],
        riskReward: "",
        rationale: "",
        noSetupReason: "No high-probability setup — consolidation phase. Wait for confirmed BOS with displacement.",
      }
    : {
        valid: true,
        direction: scenario.direction,
        tradeType: scenario.tradeType,
        confidence: scenario.confidence - 5,
        entry: fmt(mid),
        entryZone: { low: fmt(mid - 3), high: fmt(mid + 3) },
        stopLoss: fmt(stop),
        takeProfits: [fmt(tp1), fmt(tp2), fmt(tp3)],
        riskReward: `1:${scenario.rrRatio.toFixed(1)}`,
        rationale: `${scenario.direction === "long" ? "Bullish" : "Bearish"} continuation from identified institutional zone after structure confirmation and liquidity sweep.`,
      };

  return {
    bias: scenario.bias,
    confidence: scenario.confidence,
    summary: scenario.summary,
    reasoning: {
      structure: scenario.structure,
      liquidity: scenario.liquidity,
      momentum: scenario.momentum,
      levels: scenario.levels,
    },
    zones,
    markers,
    setup,
  };
}

type PairInfo = { base: number; name: string; digits: number; swing: number };

const PAIR_MAP: [RegExp, PairInfo][] = [
  [/xau|gold/,                        { base: 4510,   name: "XAU/USD", digits: 2, swing: 18  }],
  [/eur\/?usd|euro/,                  { base: 1.0850, name: "EUR/USD", digits: 5, swing: 0.0045 }],
  [/gbp\/?usd|pound|cable|sterling/,  { base: 1.2750, name: "GBP/USD", digits: 5, swing: 0.0060 }],
  [/usd\/?jpy|yen|jpy/,              { base: 157.50, name: "USD/JPY", digits: 3, swing: 0.65 }],
  [/aud\/?usd|aussie/,                { base: 0.6520, name: "AUD/USD", digits: 5, swing: 0.0035 }],
  [/usd\/?chf|swissy|chf/,           { base: 0.8950, name: "USD/CHF", digits: 5, swing: 0.0040 }],
  [/usd\/?cad|loonie|cad/,           { base: 1.3650, name: "USD/CAD", digits: 5, swing: 0.0050 }],
];

function detectPair(msg: string): PairInfo {
  const lc = msg.toLowerCase();
  for (const [re, info] of PAIR_MAP) {
    if (re.test(lc)) return info;
  }
  return PAIR_MAP[0][1]; // default: gold
}

function fmtP(n: number, digits: number): string {
  return n.toFixed(digits);
}

function buildResponse(
  template: (p: number, s: number, d: number, name: string) => string,
  pair: PairInfo
): string {
  return template(pair.base, pair.swing, pair.digits, pair.name);
}

const PAIR_RESPONSES: Array<(p: number, s: number, d: number, name: string) => string> = [
  // Bullish
  (p, s, d, name) => `**Bias: Bullish** — Key level: ${fmtP(p - s, d)} demand.

**Structure & Liquidity:** H4 BOS confirmed to the upside on ${name}. Buy-side liquidity resting at ${fmtP(p + s * 1.2, d)} (equal highs). Demand OB at ${fmtP(p - s * 1.6, d)}–${fmtP(p - s, d)} acting as launchpad.

**Momentum:** RSI above 55 on H1, bullish divergence on M15. Volume expanding on up-candles — institutional participation evident.

**Targets:** TP1 ${fmtP(p + s, d)}, TP2 ${fmtP(p + s * 2.2, d)}.

**Invalidation:** H1 close below ${fmtP(p - s * 1.9, d)} flips bias neutral.

*Risk note: Position sizing critical. Not financial advice.*`,

  // Bearish
  (p, s, d, name) => `**Bias: Bearish** — Key supply: ${fmtP(p + s * 0.8, d)}.

**Structure & Liquidity:** CHOCH confirmed on H4 after rejection from weekly supply on ${name}. SSL pool at ${fmtP(p - s * 1.4, d)} is the primary target. Prior support at ${fmtP(p - s * 0.5, d)} now flipped to resistance.

**Momentum:** RSI rolling over from 60, bearish divergence on H4. Rallies being sold aggressively — no follow-through buying.

**Targets:** TP1 ${fmtP(p - s, d)}, TP2 ${fmtP(p - s * 2.5, d)}.

**Invalidation:** Reclaim of ${fmtP(p + s * 1.1, d)} invalidates the short thesis.

*Risk note: Keep stops tight above the supply. Not financial advice.*`,

  // Neutral / Range
  (p, s, d, name) => `**Bias: Neutral** — ${name} in equilibrium between ${fmtP(p - s * 1.7, d)} and ${fmtP(p + s * 1.7, d)}.

**Structure & Liquidity:** No confirmed BOS in either direction. Liquidity pools on both sides of the range — smart money accumulation or distribution phase.

**Momentum:** RSI ranging 40–55. Volume light and contracting. No displacement candles visible.

**Targets:** Wait for a confirmed range break. Breakout above ${fmtP(p + s * 1.8, d)} is bullish; sustained break below ${fmtP(p - s * 1.8, d)} is bearish.

**Invalidation:** N/A — waiting for structure confirmation before committing.

*Risk note: Patience is a position. Not financial advice.*`,

  // Swing / Higher TF bullish
  (p, s, d, name) => `**Bias: Bullish** — Weekly demand confirmed at ${fmtP(p - s * 2.5, d)} on ${name}.

**Structure & Liquidity:** Weekly BOS to the upside with clean impulse leg. FVG imbalance at ${fmtP(p - s * 1.2, d)}–${fmtP(p - s * 0.8, d)} acting as magnet for a pullback before continuation. Equal highs at ${fmtP(p + s * 3, d)} are the primary BSL target.

**Momentum:** Strong bullish momentum — price extended but daily structure supports continuation. RSI holding 60+.

**Targets:** TP1 ${fmtP(p + s * 1.5, d)}, TP2 ${fmtP(p + s * 3, d)}.

**Invalidation:** Daily close below OB low at ${fmtP(p - s * 2.8, d)}.

*Risk note: Manage partials at TP1. Not financial advice.*`,
];

export function mockChat(message: string): string {
  const seed = hash(message);
  const lc = message.toLowerCase();
  const pair = detectPair(lc);

  let responseIdx: number;
  if (/bear|sell|short|down/.test(lc)) responseIdx = 1;
  else if (/neutral|range|consolidat|sideways/.test(lc)) responseIdx = 2;
  else if (/weekly|swing|higher tf|htf/.test(lc)) responseIdx = 3;
  else if (/bull|buy|long|up/.test(lc)) responseIdx = 0;
  else responseIdx = seed % PAIR_RESPONSES.length;

  return buildResponse(PAIR_RESPONSES[responseIdx], pair);
}
