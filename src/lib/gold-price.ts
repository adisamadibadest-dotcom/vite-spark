// Live XAU/USD spot price. Multi-source with fast failover to keep the
// quote as close to MT5 mid-price as possible.

export type GoldQuote = { price: number; source: string; fetchedAt: number };

const isSane = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n) && n > 500 && n < 10000;

async function fromOwnApi(): Promise<GoldQuote | null> {
  try {
    const r = await fetch("/api/gold-price", { cache: "no-store" });
    if (!r.ok) return null;
    const ct = r.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) return null;
    const j = (await r.json()) as Partial<GoldQuote>;
    if (isSane(j.price)) {
      return { price: +j.price.toFixed(2), source: j.source ?? "api", fetchedAt: j.fetchedAt ?? Date.now() };
    }
  } catch {}
  return null;
}

async function fromGoldApi(): Promise<GoldQuote | null> {
  try {
    const r = await fetch("https://api.gold-api.com/price/XAU", {
      headers: { accept: "application/json" }, cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { price?: number };
    if (isSane(j.price)) return { price: +j.price.toFixed(2), source: "gold-api", fetchedAt: Date.now() };
  } catch {}
  return null;
}

async function fromGoldPriceOrg(): Promise<GoldQuote | null> {
  try {
    const r = await fetch("https://data-asg.goldprice.org/dbXRates/USD", {
      headers: { accept: "application/json" }, cache: "no-store",
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { items?: { xauPrice?: number }[] };
    const p = j.items?.[0]?.xauPrice;
    if (isSane(p)) return { price: +p.toFixed(2), source: "goldprice.org", fetchedAt: Date.now() };
  } catch {}
  return null;
}

async function requireQuote(source: Promise<GoldQuote | null>): Promise<GoldQuote> {
  const quote = await source;
  if (!quote) throw new Error("No quote from upstream");
  return quote;
}

// Race two upstream sources in parallel — first sane response wins.
// This brings the live tick closer to MT5 broker mid-price.
export async function fetchGoldPrice(): Promise<GoldQuote | null> {
  const own = fromOwnApi();
  const race = Promise.any([
    requireQuote(fromGoldApi()),
    requireQuote(fromGoldPriceOrg()),
  ]).catch(() => null);
  return (await own) ?? (await race) ?? null;
}
