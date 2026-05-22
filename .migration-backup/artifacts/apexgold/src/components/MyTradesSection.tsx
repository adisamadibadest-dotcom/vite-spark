import { useEffect, useState } from "react";
import { BookMarked, Trash2, Filter, TrendingUp, TrendingDown, Minus, Loader2, ImageOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

type Trade = {
  id: string;
  bias: string;
  confidence: number;
  summary: string | null;
  note: string | null;
  image_data_url: string | null;
  created_at: string;
};

const FILTERS = ["all", "bullish", "bearish", "neutral"] as const;
type FilterKey = (typeof FILTERS)[number];

export function MyTradesSection({ refreshKey = 0 }: { refreshKey?: number }) {
  const { user } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>("all");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("trades")
      .select("id,bias,confidence,summary,note,image_data_url,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setTrades((data ?? []) as Trade[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, refreshKey]);

  const remove = async (id: string) => {
    await supabase.from("trades").delete().eq("id", id);
    setTrades((t) => t.filter((x) => x.id !== id));
  };

  const visible = trades.filter((t) => filter === "all" || t.bias === filter);

  const stats = {
    total: trades.length,
    bullish: trades.filter((t) => t.bias === "bullish").length,
    bearish: trades.filter((t) => t.bias === "bearish").length,
    neutral: trades.filter((t) => t.bias === "neutral").length,
  };

  return (
    <section className="rounded-2xl bg-gradient-card border border-border p-3 sm:p-4 animate-fade-up">
      <div className="flex items-center gap-2 mb-3">
        <BookMarked className="w-4 h-4 text-gold" />
        <h3 className="text-sm font-semibold">My Trades</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {stats.total} saved · <span className="text-bullish">{stats.bullish}↑</span> · <span className="text-bearish">{stats.bearish}↓</span> · <span className="text-muted-foreground">{stats.neutral}—</span>
        </span>
      </div>

      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto">
        <Filter className="w-3 h-3 text-muted-foreground shrink-0" />
        {FILTERS.map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={`text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-full border transition-colors ${
              filter === k
                ? "border-gold text-gold bg-gold/10"
                : "border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-gold" />
        </div>
      ) : visible.length === 0 ? (
        <div className="text-center py-8 text-xs text-muted-foreground">
          {trades.length === 0
            ? "No saved analyses yet. Analyze a chart and tap “Save to My Trades”."
            : "No trades match this filter."}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((t) => (
            <li
              key={t.id}
              className="flex gap-3 p-2.5 rounded-xl border border-border bg-card/40 hover:border-gold/40 transition-colors"
            >
              <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-lg overflow-hidden bg-black/40 border border-border shrink-0 flex items-center justify-center">
                {t.image_data_url ? (
                  <img src={t.image_data_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <ImageOff className="w-4 h-4 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <BiasPill bias={t.bias} />
                  <span className="text-[10px] text-muted-foreground tabular-nums">{t.confidence}%</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {new Date(t.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-[11px] text-foreground/90 line-clamp-2">
                  {t.note ?? t.summary ?? "—"}
                </p>
              </div>
              <button
                onClick={() => remove(t.id)}
                className="self-start p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                aria-label="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BiasPill({ bias }: { bias: string }) {
  const map: Record<string, { c: string; Icon: typeof TrendingUp }> = {
    bullish: { c: "text-bullish bg-bullish/10 border-bullish/30", Icon: TrendingUp },
    bearish: { c: "text-bearish bg-bearish/10 border-bearish/30", Icon: TrendingDown },
    neutral: { c: "text-gold bg-gold/10 border-gold/30", Icon: Minus },
  };
  const v = map[bias] ?? map.neutral;
  const Icon = v.Icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${v.c}`}>
      <Icon className="w-3 h-3" /> {bias}
    </span>
  );
}
