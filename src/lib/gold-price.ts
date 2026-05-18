// Fetch live gold spot price.
// 1) Try our own /api/gold-price (works on Vercel deployment).
// 2) Fall back to public APIs directly (works in Lovable preview / any host).

export type GoldQuote = { price: number; source: string; fetchedAt: number };

async function fromOwnApi(): Promise<GoldQuote | null> {
  try {
    const r = await fetch("/api/gold-price", { cache: "no-store" });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return null; // SPA fallback returned index.html
    const j = (await r.json()) as Partial<GoldQuote>;
    if (typeof j.price === "number" && j.price > 100) {
      return { price: j.price, source: j.source ?? "api", fetchedAt: j.fetchedAt ?? Date.now() };
    }
  } catch {}
  return null;
}

async function fromGoldApi(): Promise<GoldQuote | null> {
  try {
    const r = await fetch("https://api.gold-api.com/price/XAU", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { price?: number };
    if (typeof j.price === "number" && j.price > 100) {
      return { price: +j.price.toFixed(2), source: "gold-api", fetchedAt: Date.now() };
    }
  } catch {}
  return null;
}

export async function fetchGoldPrice(): Promise<GoldQuote | null> {
  return (await fromOwnApi()) ?? (await fromGoldApi());
}
