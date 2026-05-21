import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
  RefreshControl,
} from "react-native";
import { Ionicons, Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { fetchGoldPrice } from "@/lib/api";

type Bias = "bullish" | "bearish" | "neutral";

const TF_DATA: Record<Bias, number[]> = {
  bullish: [78, 65, 71, 60],
  bearish: [22, 35, 29, 40],
  neutral: [50, 52, 48, 51],
};

const SIGNALS = [
  { type: "BUY" as const, entry: "2,412.50", sl: "2,401.20", tp: "2,438.00", confidence: 87, tf: "4H", status: "Active" as const },
  { type: "SELL" as const, entry: "2,438.80", sl: "2,447.10", tp: "2,415.50", confidence: 74, tf: "1H", status: "Active" as const },
  { type: "HOLD" as const, entry: "—", sl: "—", tp: "—", confidence: 55, tf: "1D", status: "Expired" as const },
];

export default function MarketScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const s = styles(colors);

  const [price, setPrice] = useState<number | null>(null);
  const [prev, setPrev] = useState<number | null>(null);
  const [open24h, setOpen24h] = useState<number | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number>(Date.now());
  const [refreshing, setRefreshing] = useState(false);
  const [bias, setBias] = useState<Bias>("bullish");

  const doFetch = useCallback(async () => {
    const q = await fetchGoldPrice();
    if (q) {
      setPrice((p) => {
        if (p != null && p !== q.price) setPrev(p);
        else if (p == null) setPrev(q.price);
        return q.price;
      });
      setOpen24h((o) => o ?? +(q.price * 0.995).toFixed(2));
      setUpdatedAt(q.fetchedAt);
    }
  }, []);

  useEffect(() => {
    doFetch();
    const id = setInterval(doFetch, 10_000);
    return () => clearInterval(id);
  }, [doFetch]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await doFetch();
    setRefreshing(false);
  }, [doFetch]);

  const displayPrice = price ?? 0;
  const baseline = open24h ?? displayPrice;
  const change = +(displayPrice - baseline).toFixed(2);
  const pct = baseline ? +((change / baseline) * 100).toFixed(2) : 0;
  const direction = (price ?? 0) >= (prev ?? 0) ? "up" : "down";

  const tfData = useMemo(() => {
    const v = TF_DATA[bias];
    return [
      { label: "15m", value: v[0] },
      { label: "1H", value: v[1] },
      { label: "4H", value: v[2] },
      { label: "1D", value: v[3] },
    ];
  }, [bias]);

  const overall = Math.round(tfData.reduce((a, b) => a + b.value, 0) / tfData.length);
  const confidence = bias === "neutral" ? 50 : Math.abs(overall - 50) * 2;

  const now = new Date();
  const eatH = (now.getUTCHours() + 3) % 24;
  const sessions = [
    { name: "Asia", range: "03–12 EAT", active: eatH >= 3 && eatH < 12 },
    { name: "London", range: "10–19 EAT", active: eatH >= 10 && eatH < 19 },
    { name: "New York", range: "15–00 EAT", active: eatH >= 15 },
  ];

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[s.root, { paddingTop: topPad }]}
      contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 84 + 34 : insets.bottom + 100 }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      showsVerticalScrollIndicator={false}
    >
      {/* Header */}
      <View style={s.header}>
        <View style={s.logoBox}>
          <Ionicons name="flash" size={16} color={colors.primaryForeground} />
        </View>
        <View>
          <Text style={s.logoName}>ApexGold AI</Text>
          <Text style={s.logoSub}>TRADING INTELLIGENCE</Text>
        </View>
        <View style={s.liveBadge}>
          <View style={s.liveDot} />
          <Text style={s.liveText}>LIVE</Text>
        </View>
      </View>

      {/* Gold Price Card */}
      <View style={s.card}>
        <View style={s.priceRow}>
          <View style={s.auBox}>
            <Text style={s.auText}>Au</Text>
          </View>
          <View style={{ flex: 1 }}>
            <View style={s.symbolRow}>
              <Text style={s.symbol}>XAU/USD</Text>
            </View>
            <Text style={s.priceLabel}>Gold Spot</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[s.priceValue, { color: direction === "up" ? colors.bullish : colors.bearish }]}>
              {price == null ? "—" : `$${price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            </Text>
            <View style={s.changeRow}>
              <Ionicons
                name={direction === "up" ? "arrow-up" : "arrow-down"}
                size={12}
                color={direction === "up" ? colors.bullish : colors.bearish}
              />
              <Text style={[s.changeText, { color: direction === "up" ? colors.bullish : colors.bearish }]}>
                {change >= 0 ? "+" : ""}{change} ({pct >= 0 ? "+" : ""}{pct}%)
              </Text>
            </View>
          </View>
        </View>
        <View style={s.statsGrid}>
          {[
            { l: "24h High", v: "$2,425.10" },
            { l: "24h Low", v: "$2,389.40" },
            { l: "Volume", v: "184.2K" },
            { l: "Spread", v: "0.18" },
          ].map((stat) => (
            <View key={stat.l} style={s.statCell}>
              <Text style={s.statLabel}>{stat.l}</Text>
              <Text style={s.statValue}>{stat.v}</Text>
            </View>
          ))}
        </View>
        <Text style={s.updateTime}>
          Updated {Math.max(1, Math.round((Date.now() - updatedAt) / 1000))}s ago
        </Text>
      </View>

      {/* AI Bias Card */}
      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Ionicons name="brain" size={16} color={colors.gold} />
          <Text style={s.sectionTitle}>AI Market Bias</Text>
          <Text style={s.sectionSub}>XAU/USD · Multi-Timeframe</Text>
          <View style={{ marginLeft: "auto" as unknown as number, alignItems: "flex-end" }}>
            <Text style={s.confLabel}>Confidence</Text>
            <Text style={[s.confValue, {
              color: bias === "bullish" ? colors.bullish : bias === "bearish" ? colors.bearish : colors.gold
            }]}>{confidence}%</Text>
          </View>
        </View>

        <View style={s.biasRow}>
          {([
            { type: "bullish" as Bias, icon: "trending-up", label: "Bullish", color: colors.bullish },
            { type: "neutral" as Bias, icon: "remove", label: "Neutral", color: colors.gold },
            { type: "bearish" as Bias, icon: "trending-down", label: "Bearish", color: colors.bearish },
          ] as { type: Bias; icon: string; label: string; color: string }[]).map(({ type, icon, label, color }) => (
            <Pressable
              key={type}
              style={[s.biasBtn, bias === type && { borderColor: color, backgroundColor: color + "20" }]}
              onPress={() => { setBias(type); Haptics.selectionAsync(); }}
            >
              <Feather name={icon as "trending-up" | "remove" | "trending-down"} size={16} color={bias === type ? color : colors.mutedForeground} />
              <Text style={[s.biasBtnText, bias === type && { color }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ gap: 6, marginTop: 4 }}>
          {tfData.map((tf) => {
            const bullPct = Math.max(0, tf.value - 50) * 2;
            const bearPct = Math.max(0, 50 - tf.value) * 2;
            return (
              <View key={tf.label} style={s.tfRow}>
                <Text style={s.tfLabel}>{tf.label}</Text>
                <View style={s.bipolarBar}>
                  <View style={[s.bipolarBearFill, { width: `${bearPct / 2}%` as unknown as number }]} />
                  <View style={s.bipolarCenter} />
                  <View style={[s.bipolarBullFill, { width: `${bullPct / 2}%` as unknown as number }]} />
                </View>
                <Text style={[s.tfValue, {
                  color: tf.value > 55 ? colors.bullish : tf.value < 45 ? colors.bearish : colors.mutedForeground
                }]}>{tf.value}%</Text>
              </View>
            );
          })}
        </View>
      </View>

      {/* Market Sessions */}
      <View style={s.card}>
        <View style={s.sectionHeader}>
          <Ionicons name="time-outline" size={16} color={colors.gold} />
          <Text style={s.sectionTitle}>Market Sessions</Text>
        </View>
        <View style={s.sessionsRow}>
          {sessions.map((sess) => (
            <View key={sess.name} style={[s.sessionCell, sess.active && s.sessionCellActive]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, justifyContent: "center" }}>
                {sess.active && <View style={s.sessionDot} />}
                <Text style={[s.sessionName, sess.active && s.sessionNameActive]}>{sess.name}</Text>
              </View>
              <Text style={s.sessionRange}>{sess.range}</Text>
              {sess.active && <Text style={s.sessionOpen}>OPEN</Text>}
            </View>
          ))}
        </View>
      </View>

      {/* Signals */}
      <View style={s.card}>
        <View style={[s.sectionHeader, { marginBottom: 10 }]}>
          <Ionicons name="radio" size={16} color={colors.gold} />
          <Text style={s.sectionTitle}>Live Signals</Text>
        </View>
        {SIGNALS.map((sig, i) => (
          <View key={i} style={[s.signalRow, i < SIGNALS.length - 1 && s.signalRowBorder]}>
            <View style={[s.signalBadge, {
              backgroundColor: sig.type === "BUY" ? colors.bullish + "20" : sig.type === "SELL" ? colors.bearish + "20" : colors.muted,
              borderColor: sig.type === "BUY" ? colors.bullish + "40" : sig.type === "SELL" ? colors.bearish + "40" : colors.border,
            }]}>
              <Text style={[s.signalBadgeText, {
                color: sig.type === "BUY" ? colors.bullish : sig.type === "SELL" ? colors.bearish : colors.mutedForeground,
              }]}>{sig.type}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.signalEntry}>{sig.tf} · Entry {sig.entry}</Text>
              <Text style={s.signalSLTP}>SL {sig.sl}  TP {sig.tp}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[s.signalConf, { color: colors.gold }]}>{sig.confidence}%</Text>
              <Text style={[s.signalStatus, { color: sig.status === "Active" ? colors.bullish : colors.mutedForeground }]}>{sig.status}</Text>
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, gap: 12 },
    header: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
    logoBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
    logoName: { fontSize: 13, fontWeight: "700" as const, color: colors.gold, letterSpacing: -0.2 },
    logoSub: { fontSize: 7, fontWeight: "600" as const, color: colors.mutedForeground, letterSpacing: 2 },
    liveBadge: { marginLeft: "auto" as unknown as number, flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.bullish + "18", borderWidth: 1, borderColor: colors.bullish + "40", borderRadius: 100, paddingHorizontal: 8, paddingVertical: 3 },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.bullish },
    liveText: { fontSize: 9, fontWeight: "700" as const, color: colors.bullish, letterSpacing: 1 },
    card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14 },
    priceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
    auBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
    auText: { fontSize: 16, fontWeight: "900" as const, color: colors.primaryForeground },
    symbolRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    symbol: { fontSize: 16, fontWeight: "700" as const, color: colors.foreground },
    priceLabel: { fontSize: 10, color: colors.mutedForeground, marginTop: 2 },
    priceValue: { fontSize: 24, fontWeight: "700" as const, letterSpacing: -0.5 },
    changeRow: { flexDirection: "row", alignItems: "center", gap: 2, marginTop: 2 },
    changeText: { fontSize: 11, fontWeight: "600" as const },
    statsGrid: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.border, marginTop: 4, paddingTop: 10 },
    statCell: { flex: 1, alignItems: "center" },
    statLabel: { fontSize: 8, color: colors.mutedForeground, textTransform: "uppercase" as const, letterSpacing: 0.5 },
    statValue: { fontSize: 11, fontWeight: "600" as const, color: colors.foreground, marginTop: 2 },
    updateTime: { fontSize: 9, color: colors.mutedForeground, marginTop: 8, textAlign: "center" },
    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    sectionTitle: { fontSize: 13, fontWeight: "600" as const, color: colors.foreground },
    sectionSub: { fontSize: 9, color: colors.mutedForeground, textTransform: "uppercase" as const, letterSpacing: 0.5 },
    confLabel: { fontSize: 8, color: colors.mutedForeground, textTransform: "uppercase" as const, letterSpacing: 0.5 },
    confValue: { fontSize: 14, fontWeight: "700" as const },
    biasRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
    biasBtn: { flex: 1, flexDirection: "column", alignItems: "center", gap: 4, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
    biasBtnText: { fontSize: 11, fontWeight: "600" as const, color: colors.mutedForeground },
    tfRow: { flexDirection: "row", alignItems: "center", gap: 8 },
    tfLabel: { fontSize: 10, fontWeight: "700" as const, color: colors.mutedForeground, width: 24, textTransform: "uppercase" as const },
    bipolarBar: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.input, flexDirection: "row", alignItems: "center", overflow: "hidden" },
    bipolarBearFill: { height: "100%" as unknown as number, backgroundColor: colors.bearish, position: "absolute" as const, right: "50%" as unknown as number, top: 0 },
    bipolarBullFill: { height: "100%" as unknown as number, backgroundColor: colors.bullish, position: "absolute" as const, left: "50%" as unknown as number, top: 0 },
    bipolarCenter: { position: "absolute" as const, left: "50%" as unknown as number, width: 1, height: "100%" as unknown as number, backgroundColor: colors.border },
    tfValue: { fontSize: 11, fontWeight: "700" as const, width: 34, textAlign: "right" },
    sessionsRow: { flexDirection: "row", gap: 8 },
    sessionCell: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 10, alignItems: "center", backgroundColor: colors.background },
    sessionCellActive: { borderColor: colors.gold + "80", backgroundColor: colors.gold + "12" },
    sessionDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.bullish },
    sessionName: { fontSize: 11, fontWeight: "700" as const, color: colors.foreground },
    sessionNameActive: { color: colors.gold },
    sessionRange: { fontSize: 8, color: colors.mutedForeground, marginTop: 3, textAlign: "center" },
    sessionOpen: { fontSize: 8, fontWeight: "700" as const, color: colors.bullish, marginTop: 2, letterSpacing: 0.5 },
    signalRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
    signalRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    signalBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
    signalBadgeText: { fontSize: 10, fontWeight: "700" as const },
    signalEntry: { fontSize: 12, fontWeight: "600" as const, color: colors.foreground },
    signalSLTP: { fontSize: 10, color: colors.mutedForeground, marginTop: 2 },
    signalConf: { fontSize: 12, fontWeight: "700" as const },
    signalStatus: { fontSize: 9, fontWeight: "600" as const, marginTop: 2 },
  });
}
