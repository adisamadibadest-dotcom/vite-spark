import { useCallback, useState } from "react";

export type ScreenshotEntry = {
  id: string;
  thumbnailUrl: string;
  pair: string;
  bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  timestamp: number;
  summary: string;
  reasoning: { structure: string; liquidity: string; momentum: string; levels: string };
  setup?: {
    valid: boolean;
    direction: string;
    entry?: string;
    stopLoss?: string;
    takeProfits?: string[];
    riskReward?: string;
    rationale?: string;
  };
};

const MAX_ENTRIES = 50;

function storageKey(userId: string) {
  return `apex_screenshots_${userId}`;
}

function load(userId: string): ScreenshotEntry[] {
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) ?? "[]") as ScreenshotEntry[];
  } catch {
    return [];
  }
}

function save(userId: string, entries: ScreenshotEntry[]) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(entries));
  } catch {
  }
}

export async function generateThumbnail(dataUrl: string): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxW = 180;
      const scale = maxW / img.width;
      canvas.width = maxW;
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(dataUrl); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.45));
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}

const PAIR_PATTERNS = [
  /\b(XAU\/?USD|GOLD)\b/i,
  /\b(EUR\/?USD)\b/i,
  /\b(GBP\/?USD)\b/i,
  /\b(USD\/?JPY)\b/i,
  /\b(AUD\/?USD)\b/i,
  /\b(USD\/?CHF)\b/i,
  /\b(USD\/?CAD)\b/i,
  /\b(NZD\/?USD)\b/i,
  /\b(BTC\/?USD|BITCOIN)\b/i,
];

export function detectPair(text: string): string {
  for (const pattern of PAIR_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[0].toUpperCase();
      if (/GOLD/i.test(raw)) return "XAU/USD";
      if (/BITCOIN/i.test(raw)) return "BTC/USD";
      if (!raw.includes("/")) return raw.slice(0, 3) + "/" + raw.slice(3);
      return raw;
    }
  }
  return "XAU/USD";
}

export function useScreenshotHistory(userId: string | undefined) {
  const [history, setHistory] = useState<ScreenshotEntry[]>(() =>
    userId ? load(userId) : []
  );

  const addEntry = useCallback((entry: Omit<ScreenshotEntry, "id" | "timestamp">) => {
    if (!userId) return;
    const newEntry: ScreenshotEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    setHistory((prev) => {
      const next = [newEntry, ...prev].slice(0, MAX_ENTRIES);
      save(userId, next);
      return next;
    });
  }, [userId]);

  const deleteEntry = useCallback((id: string) => {
    if (!userId) return;
    setHistory((prev) => {
      const next = prev.filter((e) => e.id !== id);
      save(userId, next);
      return next;
    });
  }, [userId]);

  const clearAll = useCallback(() => {
    if (!userId) return;
    setHistory([]);
    save(userId, []);
  }, [userId]);

  return { history, addEntry, deleteEntry, clearAll };
}
