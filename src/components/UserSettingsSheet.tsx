import { useState } from "react";
import { Monitor, Moon, Sun, TrendingDown, TrendingUp, Zap, Trash2, ExternalLink, Crown, ShieldCheck, Star, ChevronRight, ImageOff, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useTheme, type Theme } from "@/hooks/use-theme";
import { useRiskPreference, type RiskPreference } from "@/hooks/use-risk-preference";
import { useScreenshotHistory, type ScreenshotEntry } from "@/hooks/use-screenshot-history";
import { useAccess } from "@/hooks/use-access";
import { useAuth } from "@/hooks/use-auth";
import { MpesaPaymentModal } from "@/components/MpesaPaymentModal";

type Section = "theme" | "risk" | "history" | "subscription";

interface UserSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenEntry?: (entry: ScreenshotEntry) => void;
}

export function UserSettingsSheet({ open, onOpenChange, onOpenEntry }: UserSettingsSheetProps) {
  const { user } = useAuth();
  const { isAdmin, subscription, hasActiveSubscription } = useAccess();
  const { theme, setTheme } = useTheme();
  const { risk, setRisk } = useRiskPreference(user?.id);
  const { history, deleteEntry, clearAll } = useScreenshotHistory(user?.id);
  const [activeSection, setActiveSection] = useState<Section>("subscription");
  const [confirmClear, setConfirmClear] = useState(false);
  const [payModalOpen, setPayModalOpen] = useState(false);

  const planLabel = isAdmin ? "Admin" : hasActiveSubscription ? "Premium" : "Free";
  const planIcon = isAdmin
    ? <ShieldCheck className="w-4 h-4 text-gold" />
    : hasActiveSubscription
    ? <Crown className="w-4 h-4 text-gold" />
    : <Star className="w-4 h-4 text-muted-foreground" />;

  const daysRemaining = subscription?.expires_at
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / 86400000))
    : null;

  const isExpired = hasActiveSubscription && daysRemaining !== null && daysRemaining === 0;

  const sections: { id: Section; label: string; count?: number }[] = [
    { id: "subscription", label: "Subscription" },
    { id: "theme", label: "Theme" },
    { id: "risk", label: "Risk Preference" },
    { id: "history", label: "Screenshot History", count: history.length },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0 gap-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b border-border shrink-0">
          <SheetTitle className="text-base">User Settings</SheetTitle>
          <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
        </SheetHeader>

        <div className="flex border-b border-border shrink-0 overflow-x-auto">
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={`px-3 py-2.5 text-[11px] font-medium whitespace-nowrap border-b-2 transition-colors flex items-center gap-1 ${
                activeSection === s.id
                  ? "border-gold text-gold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {s.label}
              {s.count !== undefined && s.count > 0 && (
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[10px]">{s.count}</span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">

          {activeSection === "subscription" && (
            <div className="space-y-4">
              {/* Plan badge */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground uppercase tracking-wider">Current Plan</span>
                  <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${
                    isAdmin
                      ? "bg-gold/15 text-gold border border-gold/30"
                      : hasActiveSubscription
                      ? "bg-gold/10 text-gold border border-gold/20"
                      : "bg-muted text-muted-foreground border border-border"
                  }`}>
                    {planIcon} {planLabel}
                  </span>
                </div>

                {/* Admin */}
                {isAdmin && (
                  <div className="flex items-center gap-2 rounded-lg bg-gold/5 border border-gold/20 px-3 py-2">
                    <ShieldCheck className="w-4 h-4 text-gold shrink-0" />
                    <p className="text-xs text-gold font-medium">Full admin access — no expiry.</p>
                  </div>
                )}

                {/* Active Premium */}
                {!isAdmin && hasActiveSubscription && subscription && (
                  <>
                    <div className="flex items-center gap-2 rounded-lg bg-bullish/5 border border-bullish/20 px-3 py-2">
                      <CheckCircle2 className="w-4 h-4 text-bullish shrink-0" />
                      <p className="text-xs text-bullish font-medium">Premium Active — Unlimited AI analysis</p>
                    </div>
                    <div className="space-y-2">
                      {[
                        { label: "Package", value: subscription.plan },
                        { label: "Status", value: "Active", color: "text-bullish" },
                        { label: "Started", value: new Date(subscription.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) },
                        { label: "Expires", value: new Date(subscription.expires_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) },
                      ].map(({ label, value, color }) => (
                        <div key={label} className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">{label}</span>
                          <span className={`font-medium ${color ?? ""}`}>{value}</span>
                        </div>
                      ))}
                      {daysRemaining !== null && (
                        <div className="flex justify-between items-center text-xs">
                          <span className="text-muted-foreground">Days Remaining</span>
                          <span className={`font-bold ${daysRemaining <= 3 ? "text-bearish" : daysRemaining <= 7 ? "text-gold" : "text-bullish"}`}>
                            {daysRemaining} {daysRemaining === 1 ? "day" : "days"}
                          </span>
                        </div>
                      )}
                    </div>
                    {daysRemaining !== null && daysRemaining <= 3 && (
                      <div className="flex items-start gap-2 rounded-lg bg-gold/5 border border-gold/30 px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-gold shrink-0 mt-0.5" />
                        <p className="text-[11px] text-gold">Your plan expires soon. Renew to keep your premium access.</p>
                      </div>
                    )}
                  </>
                )}

                {/* Free tier */}
                {!isAdmin && !hasActiveSubscription && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 rounded-lg bg-muted/60 border border-border px-3 py-2">
                      <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                      <p className="text-xs text-muted-foreground">Free tier — limited to 5 trial analyses with 60-second cooldowns.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPayModalOpen(true)}
                      className="flex items-center justify-center gap-2 w-full bg-gradient-to-r from-gold to-amber-500 text-primary-foreground font-semibold rounded-xl py-2.5 text-sm hover:opacity-90 transition-opacity active:scale-[0.98]"
                    >
                      <Crown className="w-4 h-4" /> Upgrade with M-Pesa
                    </button>
                    <p className="text-[10px] text-muted-foreground text-center">
                      Pay instantly via M-Pesa STK Push — activates automatically.
                    </p>
                  </div>
                )}
              </div>

              {/* Premium perks banner */}
              {hasActiveSubscription && (
                <div className="rounded-xl border border-bullish/20 bg-bullish/5 p-3 space-y-1.5">
                  {["Unlimited AI chart analyses", "No analysis cooldown", "Priority AI processing", "Advanced trade setups", "Screenshot history"].map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs text-bullish">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />{f}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* M-Pesa Payment Modal inside settings */}
          <MpesaPaymentModal
            open={payModalOpen}
            onClose={() => setPayModalOpen(false)}
          />

          {activeSection === "theme" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Choose how ApexGold AI looks. Auto follows your device setting.</p>
              {([
                { value: "dark", label: "Dark Mode", icon: Moon, desc: "Dark background, easy on the eyes in low light." },
                { value: "light", label: "Light Mode", icon: Sun, desc: "White background, ideal for bright environments." },
                { value: "auto", label: "Auto", icon: Monitor, desc: "Follows your device's system preference automatically." },
              ] as { value: Theme; label: string; icon: typeof Moon; desc: string }[]).map(({ value, label, icon: Icon, desc }) => (
                <button
                  key={value}
                  onClick={() => setTheme(value)}
                  className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                    theme === value
                      ? "border-gold bg-gold/10"
                      : "border-border bg-card hover:border-border/80"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${theme === value ? "bg-gold/20" : "bg-muted"}`}>
                    <Icon className={`w-4 h-4 ${theme === value ? "text-gold" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${theme === value ? "text-gold" : "text-foreground"}`}>{label}</p>
                    <p className="text-[11px] text-muted-foreground">{desc}</p>
                  </div>
                  {theme === value && (
                    <div className="w-2 h-2 rounded-full bg-gold shrink-0" />
                  )}
                </button>
              ))}
            </div>
          )}

          {activeSection === "risk" && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Your risk preference shapes how the AI sizes stop-losses, take-profits, and trade aggressiveness.</p>
              {([
                {
                  value: "conservative",
                  label: "Conservative",
                  icon: TrendingDown,
                  desc: "Tighter SL/TP, targets TP1. Prioritises capital preservation over gain.",
                  color: "text-bullish",
                  activeBg: "border-bullish bg-bullish/10",
                  iconBg: "bg-bullish/20",
                },
                {
                  value: "moderate",
                  label: "Moderate",
                  icon: Zap,
                  desc: "Standard risk-reward. Balanced approach targeting TP1–TP2.",
                  color: "text-gold",
                  activeBg: "border-gold bg-gold/10",
                  iconBg: "bg-gold/20",
                },
                {
                  value: "aggressive",
                  label: "Aggressive",
                  icon: TrendingUp,
                  desc: "Wider measured moves, pushes toward TP2/TP3. Higher risk, higher reward.",
                  color: "text-bearish",
                  activeBg: "border-bearish bg-bearish/10",
                  iconBg: "bg-bearish/20",
                },
              ] as { value: RiskPreference; label: string; icon: typeof Zap; desc: string; color: string; activeBg: string; iconBg: string }[]).map(
                ({ value, label, icon: Icon, desc, color, activeBg, iconBg }) => (
                  <button
                    key={value}
                    onClick={() => setRisk(value)}
                    className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                      risk === value ? activeBg : "border-border bg-card hover:border-border/80"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${risk === value ? iconBg : "bg-muted"}`}>
                      <Icon className={`w-4 h-4 ${risk === value ? color : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${risk === value ? color : "text-foreground"}`}>{label}</p>
                      <p className="text-[11px] text-muted-foreground">{desc}</p>
                    </div>
                    {risk === value && (
                      <div className={`w-2 h-2 rounded-full shrink-0 ${color.replace("text-", "bg-")}`} />
                    )}
                  </button>
                )
              )}
            </div>
          )}

          {activeSection === "history" && (
            <div className="space-y-3">
              {history.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
                  <ImageOff className="w-10 h-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No analyses saved yet.</p>
                  <p className="text-xs text-muted-foreground/70">After your first chart analysis the result will appear here automatically.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs text-muted-foreground">{history.length} / 50 entries</p>
                    {confirmClear ? (
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-muted-foreground">Clear all?</span>
                        <button onClick={() => { clearAll(); setConfirmClear(false); }} className="text-[11px] text-bearish hover:underline">Yes</button>
                        <button onClick={() => setConfirmClear(false)} className="text-[11px] text-muted-foreground hover:underline">No</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmClear(true)} className="text-[11px] text-muted-foreground hover:text-bearish flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> Clear all
                      </button>
                    )}
                  </div>

                  {history.map((entry) => (
                    <div key={entry.id} className="group flex gap-3 p-3 rounded-xl border border-border bg-card hover:border-border/60 transition-colors">
                      <div className="w-16 h-10 rounded-md overflow-hidden bg-muted shrink-0">
                        {entry.thumbnailUrl ? (
                          <img src={entry.thumbnailUrl} alt={entry.pair} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ImageOff className="w-4 h-4 text-muted-foreground/40" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs font-semibold">{entry.pair}</span>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                            entry.bias === "bullish" ? "bg-bullish/15 text-bullish" :
                            entry.bias === "bearish" ? "bg-bearish/15 text-bearish" :
                            "bg-muted text-muted-foreground"
                          }`}>
                            {entry.bias}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-auto">{Math.round(entry.confidence)}%</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{entry.summary}</p>
                        <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                          {new Date(entry.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>

                      <div className="flex flex-col gap-1 shrink-0">
                        {onOpenEntry && (
                          <button
                            onClick={() => { onOpenEntry(entry); onOpenChange(false); }}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Re-open analysis"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="p-1.5 rounded-lg hover:bg-bearish/10 text-muted-foreground hover:text-bearish transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
