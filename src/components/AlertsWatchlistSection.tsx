import { useEffect, useRef, useState } from "react";
import { Bell, Eye, Plus, Trash2, BellRing, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

type Alert = {
  id: string;
  symbol: string;
  direction: "above" | "below";
  price: number;
  note: string | null;
  status: "active" | "triggered" | "cancelled";
  triggered_at: string | null;
  created_at: string;
};

type WatchItem = {
  id: string;
  symbol: string;
  note: string | null;
  created_at: string;
};

export function AlertsWatchlistSection() {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [watch, setWatch] = useState<WatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const firedRef = useRef<Set<string>>(new Set());

  // form state
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const [wSymbol, setWSymbol] = useState("");
  const [wNote, setWNote] = useState("");

  const load = async () => {
    if (!user) return;
    setLoading(true);
    const [a, w] = await Promise.all([
      supabase.from("alerts").select("*").order("created_at", { ascending: false }),
      supabase.from("watchlist").select("*").order("created_at", { ascending: false }),
    ]);
    setAlerts(((a.data ?? []) as Alert[]));
    setWatch(((w.data ?? []) as WatchItem[]));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Poll gold price to check XAUUSD alerts
  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const q = await fetchGoldPrice();
      if (cancelled || !q) return;
      setLivePrice(q.price);
      checkAlerts(q.price);
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  const checkAlerts = async (currentPrice: number) => {
    const due = alerts.filter(
      (a) =>
        a.status === "active" &&
        a.symbol === "XAUUSD" &&
        !firedRef.current.has(a.id) &&
        ((a.direction === "above" && currentPrice >= Number(a.price)) ||
          (a.direction === "below" && currentPrice <= Number(a.price)))
    );
    for (const a of due) {
      firedRef.current.add(a.id);
      toast.success(`Alert: XAUUSD ${a.direction} $${Number(a.price).toFixed(2)}`, {
        description: `Now $${currentPrice.toFixed(2)}${a.note ? ` · ${a.note}` : ""}`,
        icon: <BellRing className="w-4 h-4 text-gold" />,
      });
      await supabase
        .from("alerts")
        .update({ status: "triggered", triggered_at: new Date().toISOString() })
        .eq("id", a.id);
    }
    if (due.length) load();
  };

  const addAlert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const p = parseFloat(price);
    if (!Number.isFinite(p) || p <= 0) {
      toast.error("Enter a valid price");
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("alerts").insert({
      user_id: user.id,
      symbol: "XAUUSD",
      direction,
      price: p,
      note: note.trim() || null,
    });
    setAdding(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPrice(""); setNote("");
    toast.success("Alert created");
    load();
  };

  const deleteAlert = async (id: string) => {
    await supabase.from("alerts").delete().eq("id", id);
    firedRef.current.delete(id);
    setAlerts((a) => a.filter((x) => x.id !== id));
  };

  const addWatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const sym = wSymbol.trim().toUpperCase();
    if (!sym) return;
    const { error } = await supabase.from("watchlist").insert({
      user_id: user.id,
      symbol: sym,
      note: wNote.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    setWSymbol(""); setWNote("");
    load();
  };

  const removeWatch = async (id: string) => {
    await supabase.from("watchlist").delete().eq("id", id);
    setWatch((w) => w.filter((x) => x.id !== id));
  };

  return (
    <section className="rounded-2xl bg-gradient-card border border-border p-3 sm:p-4 animate-fade-up space-y-5">
      <div className="flex items-center gap-2">
        <Bell className="w-4 h-4 text-gold" />
        <h3 className="text-sm font-semibold">Alerts & Watchlist</h3>
        {livePrice != null && (
          <span className="ml-auto text-[10px] text-muted-foreground">
            XAUUSD <span className="text-gold font-bold tabular-nums">${livePrice.toFixed(2)}</span>
          </span>
        )}
      </div>

      {/* ---------- ALERTS ---------- */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Price Alerts · XAUUSD</p>

        <form onSubmit={addAlert} className="grid grid-cols-12 gap-1.5">
          <div className="col-span-3 flex rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setDirection("above")}
              className={`flex-1 text-[10px] font-bold uppercase py-1.5 transition-colors ${
                direction === "above" ? "bg-bullish/20 text-bullish" : "text-muted-foreground"
              }`}
            >Above</button>
            <button
              type="button"
              onClick={() => setDirection("below")}
              className={`flex-1 text-[10px] font-bold uppercase py-1.5 transition-colors ${
                direction === "below" ? "bg-bearish/20 text-bearish" : "text-muted-foreground"
              }`}
            >Below</button>
          </div>
          <input
            type="number" inputMode="decimal" step="0.01" placeholder="Price"
            value={price} onChange={(e) => setPrice(e.target.value)}
            className="col-span-3 bg-card border border-border rounded-lg px-2 text-xs tabular-nums focus:outline-none focus:border-gold/60"
          />
          <input
            type="text" placeholder="Note (optional)"
            value={note} onChange={(e) => setNote(e.target.value)}
            className="col-span-4 bg-card border border-border rounded-lg px-2 text-xs focus:outline-none focus:border-gold/60"
          />
          <button
            type="submit" disabled={adding}
            className="col-span-2 bg-gradient-gold text-primary-foreground text-xs font-semibold rounded-lg flex items-center justify-center gap-1 shadow-gold disabled:opacity-60"
          >
            {adding ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
            Add
          </button>
        </form>

        {loading ? (
          <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-gold" /></div>
        ) : alerts.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-3">No alerts yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {alerts.map((a) => {
              const triggered = a.status === "triggered";
              return (
                <li
                  key={a.id}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border ${
                    triggered ? "border-gold/40 bg-gold/5" : "border-border bg-card/40"
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                    a.direction === "above" ? "bg-bullish/15 text-bullish" : "bg-bearish/15 text-bearish"
                  }`}>{a.direction}</span>
                  <span className="text-xs font-semibold tabular-nums">${Number(a.price).toFixed(2)}</span>
                  {a.note && <span className="text-[11px] text-muted-foreground truncate">· {a.note}</span>}
                  <span className="ml-auto text-[10px] text-muted-foreground flex items-center gap-1">
                    {triggered ? (
                      <><CheckCircle2 className="w-3 h-3 text-gold" /> triggered</>
                    ) : "active"}
                  </span>
                  <button
                    onClick={() => deleteAlert(a.id)}
                    className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    aria-label="Delete alert"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* ---------- WATCHLIST ---------- */}
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-1.5">
          <Eye className="w-3 h-3" /> Watchlist
        </p>

        <form onSubmit={addWatch} className="grid grid-cols-12 gap-1.5">
          <input
            type="text" placeholder="Symbol (e.g. EURUSD)"
            value={wSymbol} onChange={(e) => setWSymbol(e.target.value)}
            className="col-span-4 bg-card border border-border rounded-lg px-2 py-1.5 text-xs uppercase focus:outline-none focus:border-gold/60"
          />
          <input
            type="text" placeholder="Note (optional)"
            value={wNote} onChange={(e) => setWNote(e.target.value)}
            className="col-span-6 bg-card border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-gold/60"
          />
          <button
            type="submit"
            className="col-span-2 bg-card border border-border hover:border-gold/50 text-xs font-semibold rounded-lg flex items-center justify-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </form>

        {watch.length === 0 ? (
          <p className="text-[11px] text-muted-foreground text-center py-3">Watchlist is empty.</p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {watch.map((w) => (
              <li
                key={w.id}
                className="group flex items-center gap-1.5 px-2 py-1 rounded-full border border-border bg-card/40 text-xs"
              >
                <span className="font-bold">{w.symbol}</span>
                {w.note && <span className="text-[10px] text-muted-foreground">· {w.note}</span>}
                <button
                  onClick={() => removeWatch(w.id)}
                  className="opacity-50 group-hover:opacity-100 hover:text-destructive transition-opacity"
                  aria-label="Remove"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
