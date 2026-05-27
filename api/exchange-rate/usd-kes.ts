import type { VercelRequest, VercelResponse } from "@vercel/node";

const FALLBACK_RATE = 130;

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const r = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
    if (r.ok) {
      const d = (await r.json()) as { rates?: { KES?: number } };
      const rate = d.rates?.KES;
      if (rate && rate > 50) return res.json({ rate, source: "live" });
    }
  } catch {
    // fall through
  }
  return res.json({ rate: FALLBACK_RATE, source: "fallback" });
}
