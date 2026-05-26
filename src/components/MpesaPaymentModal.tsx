import { useEffect, useRef, useState } from "react";
import { Crown, Loader2, CheckCircle2, XCircle, Phone, X, Zap, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useAccess } from "@/hooks/use-access";

export type Package = {
  id: string;
  name: string;
  usd: number;
  days: number;
  label: string;
};

export const PACKAGES: Package[] = [
  { id: "1-week",  name: "1 Week Premium",  usd: 7,  days: 7,  label: "1 Week"  },
  { id: "2-weeks", name: "2 Weeks Premium", usd: 14, days: 14, label: "2 Weeks" },
  { id: "1-month", name: "1 Month Premium", usd: 28, days: 30, label: "1 Month" },
];

type Step = "select" | "phone" | "waiting" | "success" | "failed";

interface Props {
  open: boolean;
  onClose: () => void;
  initialPackageId?: string;
}

export function MpesaPaymentModal({ open, onClose, initialPackageId }: Props) {
  const { user } = useAuth();
  const { refresh } = useAccess();

  const [selectedId, setSelectedId] = useState(initialPackageId ?? "1-month");
  const [step, setStep] = useState<Step>("select");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [checkoutRequestId, setCheckoutRequestId] = useState<string | null>(null);
  const [kesRate, setKesRate] = useState(130);
  const [errorMsg, setErrorMsg] = useState("");
  const [receipt, setReceipt] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const selectedPkg = PACKAGES.find((p) => p.id === selectedId) ?? PACKAGES[2];
  const kesAmount = Math.ceil(selectedPkg.usd * kesRate);

  useEffect(() => {
    fetch("/api/exchange-rate/usd-kes")
      .then((r) => r.json())
      .then((d: { rate?: number }) => { if (d.rate && d.rate > 50) setKesRate(d.rate); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!open) {
      stopPolling();
      if (step !== "success") {
        setStep("select");
        setPhone("");
        setPhoneError("");
        setCheckoutRequestId(null);
        setErrorMsg("");
        setReceipt("");
      }
    }
  }, [open]);

  useEffect(() => {
    if (initialPackageId) setSelectedId(initialPackageId);
  }, [initialPackageId]);

  function stopPolling() {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  }

  function validatePhone(val: string): string {
    const digits = val.replace(/\D/g, "");
    if (!digits) return "Phone number is required.";
    if (digits.startsWith("0") && digits.length !== 10) return "Enter a 10-digit number starting with 07.";
    if (digits.startsWith("254") && digits.length !== 12) return "Enter a 12-digit number starting with 254.";
    if (digits.startsWith("7") && digits.length !== 9) return "Enter a 9-digit number starting with 7.";
    if (!digits.match(/^(254|0)7\d{8}$/) && !digits.match(/^7\d{8}$/)) return "Invalid Kenyan number. Use 07XXXXXXXX.";
    return "";
  }

  async function handleSubmitPhone() {
    const err = validatePhone(phone);
    if (err) { setPhoneError(err); return; }
    setPhoneError("");

    if (!user) { setErrorMsg("You must be logged in."); return; }

    setStep("waiting");
    try {
      const res = await fetch("/api/mpesa/stk-push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          packageId: selectedPkg.id,
          userId: user.id,
          userEmail: user.email,
          amountKes: kesAmount,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; checkoutRequestId?: string; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Failed to initiate payment.");

      setCheckoutRequestId(data.checkoutRequestId!);
      startPolling(data.checkoutRequestId!);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Failed to initiate payment.");
      setStep("failed");
    }
  }

  function startPolling(crid: string) {
    stopPolling();
    let attempts = 0;
    const MAX = 60;
    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts > MAX) {
        stopPolling();
        setErrorMsg("Payment timed out. If you paid, your premium will activate shortly.");
        setStep("failed");
        return;
      }
      try {
        const res = await fetch(`/api/mpesa/status/${crid}`);
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string; mpesa_receipt?: string };
        if (data.status === "completed") {
          stopPolling();
          setReceipt(data.mpesa_receipt ?? "");
          setStep("success");
          refresh();
        } else if (data.status === "failed") {
          stopPolling();
          setErrorMsg("Payment was cancelled or declined. Please try again.");
          setStep("failed");
        }
      } catch { /* keep polling */ }
    }, 4000);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full sm:max-w-md bg-background border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-fade-up max-h-[92dvh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-gold flex items-center justify-center">
              <Crown className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-sm">Go Premium</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {step === "select" && (
            <SelectStep
              selectedId={selectedId}
              setSelectedId={setSelectedId}
              selectedPkg={selectedPkg}
              kesRate={kesRate}
              kesAmount={kesAmount}
              onNext={() => setStep("phone")}
            />
          )}

          {step === "phone" && (
            <PhoneStep
              selectedPkg={selectedPkg}
              kesAmount={kesAmount}
              phone={phone}
              setPhone={setPhone}
              phoneError={phoneError}
              onBack={() => setStep("select")}
              onSubmit={handleSubmitPhone}
            />
          )}

          {step === "waiting" && (
            <WaitingStep selectedPkg={selectedPkg} kesAmount={kesAmount} phone={phone} />
          )}

          {step === "success" && (
            <SuccessStep selectedPkg={selectedPkg} receipt={receipt} onClose={onClose} />
          )}

          {step === "failed" && (
            <FailedStep errorMsg={errorMsg} onRetry={() => setStep("phone")} onClose={onClose} />
          )}
        </div>
      </div>
    </div>
  );
}

function SelectStep({
  selectedId, setSelectedId, selectedPkg, kesRate, kesAmount, onNext,
}: {
  selectedId: string;
  setSelectedId: (id: string) => void;
  selectedPkg: Package;
  kesRate: number;
  kesAmount: number;
  onNext: () => void;
}) {
  return (
    <div className="p-5 space-y-4">
      <div>
        <p className="text-sm font-medium mb-1">Choose your plan</p>
        <p className="text-[11px] text-muted-foreground">Pay securely via M-Pesa STK Push.</p>
      </div>

      <div className="space-y-2.5">
        {PACKAGES.map((pkg) => {
          const kes = Math.ceil(pkg.usd * kesRate);
          const active = selectedId === pkg.id;
          const isPopular = pkg.id === "1-month";
          return (
            <button
              key={pkg.id}
              type="button"
              onClick={() => setSelectedId(pkg.id)}
              className={`relative w-full flex items-center justify-between gap-3 rounded-xl border px-4 py-3.5 text-left transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/60 ${
                active
                  ? "border-gold bg-gold/10 shadow-[0_0_20px_-6px_var(--gold)]"
                  : "border-border bg-card/60 hover:border-gold/40"
              }`}
            >
              {isPopular && (
                <span className="absolute -top-2.5 right-3 text-[9px] font-bold bg-gradient-gold text-primary-foreground px-2 py-0.5 rounded-full">
                  BEST VALUE
                </span>
              )}
              <div>
                <p className={`text-sm font-semibold ${active ? "text-gold" : ""}`}>{pkg.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{pkg.days} days access</p>
              </div>
              <div className="text-right shrink-0">
                <div className={`text-xl font-black tabular-nums ${active ? "text-gradient-gold" : ""}`}>${pkg.usd}</div>
                <div className="text-[10px] text-muted-foreground">≈ KES {kes.toLocaleString()}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-xl border border-border bg-card/40 p-3 space-y-1.5">
        {[
          "Unlimited AI chart analysis",
          "Advanced premium trade signals",
          "Screenshot history & review",
          "Personalised risk settings",
          "Future premium trading tools",
        ].map((f) => (
          <div key={f} className="flex items-center gap-2 text-xs">
            <div className="w-4 h-4 rounded-full bg-gold/15 flex items-center justify-center shrink-0">
              <span className="text-gold text-[9px] font-bold">✓</span>
            </div>
            <span className="text-foreground/80">{f}</span>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full bg-gradient-gold text-primary-foreground font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-gold hover:opacity-90 transition-opacity active:scale-[0.98]"
      >
        <Zap className="w-4 h-4" />
        Continue — ${selectedPkg.usd} (KES {kesAmount.toLocaleString()})
      </button>

      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
        <Lock className="w-3 h-3" />
        Secured by M-Pesa · Automatic activation
      </div>
    </div>
  );
}

function PhoneStep({
  selectedPkg, kesAmount, phone, setPhone, phoneError, onBack, onSubmit,
}: {
  selectedPkg: Package;
  kesAmount: number;
  phone: string;
  setPhone: (v: string) => void;
  phoneError: string;
  onBack: () => void;
  onSubmit: () => void;
}) {
  return (
    <div className="p-5 space-y-4">
      <div className="rounded-xl border border-gold/30 bg-gold/5 px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-gold">{selectedPkg.name}</p>
          <p className="text-[10px] text-muted-foreground">{selectedPkg.days} days</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-black text-gradient-gold">${selectedPkg.usd}</p>
          <p className="text-[10px] text-muted-foreground">KES {kesAmount.toLocaleString()}</p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium mb-1.5">M-Pesa Phone Number</label>
        <div className="relative">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") onSubmit(); }}
            placeholder="07XXXXXXXX or 254XXXXXXXXX"
            className={`w-full pl-9 pr-4 py-3 rounded-xl border bg-card text-sm focus:outline-none focus:ring-2 transition-all ${
              phoneError ? "border-bearish focus:ring-bearish/30" : "border-border focus:ring-gold/30 focus:border-gold/60"
            }`}
            autoFocus
            inputMode="tel"
          />
        </div>
        {phoneError && <p className="text-[11px] text-bearish mt-1">{phoneError}</p>}
        <p className="text-[11px] text-muted-foreground mt-1.5">
          You will receive an M-Pesa payment request on this number.
        </p>
      </div>

      <div className="space-y-2">
        <button
          type="button"
          onClick={onSubmit}
          className="w-full bg-gradient-gold text-primary-foreground font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-gold hover:opacity-90 transition-opacity active:scale-[0.98]"
        >
          <Zap className="w-4 h-4" /> Send M-Pesa Request
        </button>
        <button
          type="button"
          onClick={onBack}
          className="w-full border border-border bg-card/60 hover:border-border/80 font-medium py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Back
        </button>
      </div>

      <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
        <Lock className="w-3 h-3" />
        Your PIN is never shared. M-Pesa handles all payment security.
      </div>
    </div>
  );
}

function WaitingStep({ selectedPkg, kesAmount, phone }: { selectedPkg: Package; kesAmount: number; phone: string }) {
  return (
    <div className="p-6 flex flex-col items-center text-center space-y-5">
      <div className="relative">
        <div className="w-20 h-20 rounded-full border-2 border-gold/30 flex items-center justify-center">
          <Loader2 className="w-9 h-9 text-gold animate-spin" />
        </div>
        <div className="absolute inset-0 rounded-full animate-ping border-2 border-gold/20" />
      </div>

      <div>
        <p className="font-semibold text-base">Check Your Phone</p>
        <p className="text-sm text-muted-foreground mt-1">
          An M-Pesa STK Push has been sent to <span className="text-foreground font-medium">{phone}</span>
        </p>
      </div>

      <div className="w-full rounded-xl border border-border bg-card/60 p-4 space-y-2 text-left">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-semibold">${selectedPkg.usd} (KES {kesAmount.toLocaleString()})</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Plan</span>
          <span className="font-medium">{selectedPkg.name}</span>
        </div>
      </div>

      <div className="text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground/80">Steps:</p>
        <p>1. Open the M-Pesa prompt on your phone</p>
        <p>2. Enter your M-Pesa PIN to confirm</p>
        <p>3. Premium activates automatically after payment</p>
      </div>

      <p className="text-[10px] text-muted-foreground">Waiting for confirmation... (this may take up to 2 minutes)</p>
    </div>
  );
}

function SuccessStep({ selectedPkg, receipt, onClose }: { selectedPkg: Package; receipt: string; onClose: () => void }) {
  return (
    <div className="p-6 flex flex-col items-center text-center space-y-5">
      <div className="w-20 h-20 rounded-full bg-bullish/10 border-2 border-bullish/40 flex items-center justify-center">
        <CheckCircle2 className="w-10 h-10 text-bullish" />
      </div>

      <div>
        <p className="font-bold text-lg text-bullish">Payment Successful!</p>
        <p className="text-sm text-muted-foreground mt-1">
          Your <span className="text-foreground font-medium">{selectedPkg.name}</span> has been activated.
        </p>
      </div>

      {receipt && (
        <div className="w-full rounded-xl border border-bullish/20 bg-bullish/5 p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">M-Pesa Receipt</p>
          <p className="text-sm font-bold font-mono text-bullish">{receipt}</p>
        </div>
      )}

      <div className="w-full rounded-xl border border-border bg-card/60 p-3 space-y-1.5">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Plan</span>
          <span className="font-semibold">{selectedPkg.name}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Duration</span>
          <span className="font-medium">{selectedPkg.days} days</span>
        </div>
      </div>

      <button
        onClick={onClose}
        className="w-full bg-gradient-gold text-primary-foreground font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-gold hover:opacity-90 transition-opacity"
      >
        <Crown className="w-4 h-4" /> Start Using Premium
      </button>
    </div>
  );
}

function FailedStep({ errorMsg, onRetry, onClose }: { errorMsg: string; onRetry: () => void; onClose: () => void }) {
  return (
    <div className="p-6 flex flex-col items-center text-center space-y-5">
      <div className="w-20 h-20 rounded-full bg-bearish/10 border-2 border-bearish/40 flex items-center justify-center">
        <XCircle className="w-10 h-10 text-bearish" />
      </div>

      <div>
        <p className="font-bold text-lg text-bearish">Payment Not Completed</p>
        <p className="text-sm text-muted-foreground mt-1">{errorMsg}</p>
      </div>

      <div className="w-full space-y-2">
        <button
          onClick={onRetry}
          className="w-full bg-gradient-gold text-primary-foreground font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2 shadow-gold hover:opacity-90 transition-opacity"
        >
          Try Again
        </button>
        <button
          onClick={onClose}
          className="w-full border border-border bg-card/60 font-medium py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Close
        </button>
      </div>
    </div>
  );
}
