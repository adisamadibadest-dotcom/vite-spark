import { useCallback, useState } from "react";

export type RiskPreference = "conservative" | "moderate" | "aggressive";

function storageKey(userId: string) {
  return `apex_risk_${userId}`;
}

export function useRiskPreference(userId: string | undefined) {
  const [risk, setRiskState] = useState<RiskPreference>(() => {
    if (!userId) return "moderate";
    return (localStorage.getItem(storageKey(userId)) as RiskPreference) ?? "moderate";
  });

  const setRisk = useCallback((pref: RiskPreference) => {
    if (userId) localStorage.setItem(storageKey(userId), pref);
    setRiskState(pref);
  }, [userId]);

  return { risk, setRisk };
}
