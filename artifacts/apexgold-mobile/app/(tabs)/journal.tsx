import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  Image,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

interface Trade {
  id: string;
  bias: "bullish" | "bearish" | "neutral";
  confidence: number;
  summary: string | null;
  note: string | null;
  image_data_url: string | null;
  created_at: string;
}

const FILTERS = ["all", "bullish", "bearish", "neutral"] as const;
type Filter = (typeof FILTERS)[number];

export default function JournalScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const s = styles(colors);

  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("trades")
      .select("id,bias,confidence,summary,note,image_data_url,created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    setTrades((data ?? []) as Trade[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const remove = (id: string) => {
    Alert.alert("Delete trade?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await supabase.from("trades").delete().eq("id", id);
          setTrades((t) => t.filter((x) => x.id !== id));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const visible = trades.filter((t) => filter === "all" || t.bias === filter);

  const biasColor = (b: string) =>
    b === "bullish" ? colors.bullish : b === "bearish" ? colors.bearish : colors.gold;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <View style={s.headerArea}>
        <Text style={s.title}>My Journal</Text>
        <View style={s.stats}>
          <StatPill label={`${trades.filter((t) => t.bias === "bullish").length}↑`} color={colors.bullish} />
          <StatPill label={`${trades.filter((t) => t.bias === "bearish").length}↓`} color={colors.bearish} />
          <StatPill label={`${trades.filter((t) => t.bias === "neutral").length}—`} color={colors.gold} />
        </View>
      </View>

      {/* Filters */}
      <View style={s.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f}
            style={[s.filterBtn, filter === f && s.filterBtnActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[s.filterText, filter === f && s.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[s.list, { paddingBottom: Platform.OS === "web" ? 84 + 34 : insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!visible.length}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="book-outline" size={36} color={colors.border} />
              <Text style={s.emptyTitle}>No trades yet</Text>
              <Text style={s.emptySubtitle}>Analyze a chart on the Analyze tab to save trades here</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={[s.tradeCard, { borderLeftColor: biasColor(item.bias) }]}>
              <View style={s.tradeHeader}>
                <View style={[s.biasPill, { backgroundColor: biasColor(item.bias) + "20", borderColor: biasColor(item.bias) + "50" }]}>
                  <Text style={[s.biasPillText, { color: biasColor(item.bias) }]}>
                    {item.bias.toUpperCase()}
                  </Text>
                </View>
                <Text style={s.confText}>{Math.round(item.confidence)}%</Text>
                <Text style={s.dateText}>{new Date(item.created_at).toLocaleDateString()}</Text>
                <Pressable onPress={() => remove(item.id)} style={s.deleteBtn}>
                  <Ionicons name="trash-outline" size={14} color={colors.mutedForeground} />
                </Pressable>
              </View>
              {item.image_data_url && (
                <Image source={{ uri: item.image_data_url }} style={s.chartThumb} resizeMode="cover" />
              )}
              {item.summary && <Text style={s.summary} numberOfLines={3}>{item.summary}</Text>}
              {item.note && <Text style={s.note}>{item.note}</Text>}
            </View>
          )}
        />
      )}
    </View>
  );
}

function StatPill({ label, color }: { label: string; color: string }) {
  return (
    <View style={{ paddingHorizontal: 8, paddingVertical: 3, backgroundColor: color + "18", borderWidth: 1, borderColor: color + "40", borderRadius: 100 }}>
      <Text style={{ fontSize: 11, fontWeight: "700" as const, color }}>{label}</Text>
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    headerArea: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    title: { fontSize: 22, fontWeight: "700" as const, color: colors.foreground, flex: 1 },
    stats: { flexDirection: "row", gap: 6 },
    filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
    filterBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: colors.border },
    filterBtnActive: { borderColor: colors.gold, backgroundColor: colors.gold + "14" },
    filterText: { fontSize: 11, fontWeight: "600" as const, color: colors.mutedForeground, textTransform: "capitalize" as const },
    filterTextActive: { color: colors.gold },
    list: { paddingHorizontal: 16, gap: 10 },
    tradeCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, borderLeftWidth: 3, padding: 12, gap: 8 },
    tradeHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
    biasPill: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    biasPillText: { fontSize: 9, fontWeight: "700" as const, letterSpacing: 0.5 },
    confText: { fontSize: 11, color: colors.gold, fontWeight: "600" as const },
    dateText: { fontSize: 10, color: colors.mutedForeground, flex: 1, textAlign: "right" },
    deleteBtn: { padding: 4 },
    chartThumb: { width: "100%" as unknown as number, height: 100, borderRadius: 8 },
    summary: { fontSize: 12, color: colors.foreground, lineHeight: 17 },
    note: { fontSize: 12, color: colors.mutedForeground, fontStyle: "italic" as const },
    empty: { alignItems: "center", paddingVertical: 60, gap: 8 },
    emptyTitle: { fontSize: 16, fontWeight: "600" as const, color: colors.mutedForeground },
    emptySubtitle: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", paddingHorizontal: 24 },
  });
}
