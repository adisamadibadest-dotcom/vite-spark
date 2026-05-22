import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Alert,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";
import { fetchGoldPrice } from "@/lib/api";

interface PriceAlert {
  id: string;
  symbol: string;
  direction: "above" | "below";
  price: number;
  note: string | null;
  status: "active" | "triggered" | "cancelled";
  triggered_at: string | null;
  created_at: string;
}

export default function AlertsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const s = styles(colors);
  const firedRef = useRef<Set<string>>(new Set());

  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [direction, setDirection] = useState<"above" | "below">("above");
  const [priceInput, setPriceInput] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("alerts")
      .select("*")
      .order("created_at", { ascending: false });
    setAlerts((data ?? []) as PriceAlert[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const q = await fetchGoldPrice();
      if (cancelled || !q) return;
      setLivePrice(q.price);
      const due = alerts.filter(
        (a) => a.status === "active" && !firedRef.current.has(a.id) &&
          ((a.direction === "above" && q.price >= a.price) || (a.direction === "below" && q.price <= a.price))
      );
      for (const alert of due) {
        firedRef.current.add(alert.id);
        await supabase.from("alerts").update({ status: "triggered", triggered_at: new Date().toISOString() }).eq("id", alert.id);
        setAlerts((prev) => prev.map((a) => a.id === alert.id ? { ...a, status: "triggered" as const } : a));
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        Alert.alert("Alert Triggered!", `XAUUSD is ${alert.direction} $${alert.price.toFixed(2)}`);
      }
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [alerts]);

  const addAlert = async () => {
    const p = parseFloat(priceInput.replace(",", ""));
    if (!p || isNaN(p) || p < 100 || p > 10000) {
      Alert.alert("Invalid price", "Enter a valid XAUUSD price (e.g. 2400)");
      return;
    }
    if (!user) return;
    setAdding(true);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const { data, error } = await supabase.from("alerts").insert({
      user_id: user.id,
      symbol: "XAUUSD",
      direction,
      price: p,
      note: note.trim() || null,
      status: "active",
    }).select().single();
    if (!error && data) {
      setAlerts((prev) => [data as PriceAlert, ...prev]);
      setPriceInput("");
      setNote("");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    setAdding(false);
  };

  const deleteAlert = (id: string) => {
    Alert.alert("Remove alert?", "This will delete the alert.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive",
        onPress: async () => {
          await supabase.from("alerts").delete().eq("id", id);
          setAlerts((prev) => prev.filter((a) => a.id !== id));
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      },
    ]);
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[s.root, { paddingTop: topPad }]}>
      <View style={s.headerArea}>
        <Text style={s.title}>Price Alerts</Text>
        {livePrice && (
          <View style={s.priceBadge}>
            <View style={s.priceDot} />
            <Text style={s.priceText}>${livePrice.toFixed(2)}</Text>
          </View>
        )}
      </View>

      {/* Add Alert Form */}
      <View style={s.formCard}>
        <Text style={s.formTitle}>New XAUUSD Alert</Text>
        <View style={s.dirRow}>
          {(["above", "below"] as const).map((d) => (
            <Pressable
              key={d}
              style={[s.dirBtn, direction === d && s.dirBtnActive]}
              onPress={() => setDirection(d)}
            >
              <Ionicons
                name={d === "above" ? "arrow-up" : "arrow-down"}
                size={14}
                color={direction === d ? colors.primaryForeground : colors.mutedForeground}
              />
              <Text style={[s.dirText, direction === d && s.dirTextActive]}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={s.priceInput}
          value={priceInput}
          onChangeText={setPriceInput}
          placeholder="e.g. 2450.00"
          placeholderTextColor={colors.mutedForeground}
          keyboardType="decimal-pad"
        />
        <TextInput
          style={s.noteInput}
          value={note}
          onChangeText={setNote}
          placeholder="Note (optional)"
          placeholderTextColor={colors.mutedForeground}
        />
        <Pressable
          style={({ pressed }) => [s.addBtn, adding && s.addBtnDisabled, pressed && { opacity: 0.85 }]}
          onPress={addAlert}
          disabled={adding}
          testID="add-alert"
        >
          {adding ? (
            <ActivityIndicator color={colors.primaryForeground} size="small" />
          ) : (
            <>
              <Ionicons name="add" size={16} color={colors.primaryForeground} />
              <Text style={s.addBtnText}>Set Alert</Text>
            </>
          )}
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: 20 }} />
      ) : (
        <FlatList
          data={alerts}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[s.list, { paddingBottom: Platform.OS === "web" ? 84 + 34 : insets.bottom + 100 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!!alerts.length}
          ListEmptyComponent={
            <View style={s.empty}>
              <Ionicons name="notifications-outline" size={36} color={colors.border} />
              <Text style={s.emptyTitle}>No alerts set</Text>
              <Text style={s.emptySubtitle}>Add a price level above to get notified</Text>
            </View>
          }
          renderItem={({ item }) => {
            const isTriggered = item.status === "triggered";
            return (
              <View style={[s.alertCard, isTriggered && s.alertTriggered]}>
                <View style={s.alertRow}>
                  <View style={[s.alertIconBox, {
                    backgroundColor: item.direction === "above" ? colors.bullish + "20" : colors.bearish + "20",
                  }]}>
                    <Ionicons
                      name={item.direction === "above" ? "arrow-up" : "arrow-down"}
                      size={14}
                      color={item.direction === "above" ? colors.bullish : colors.bearish}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.alertLabel}>
                      XAUUSD {item.direction === "above" ? "above" : "below"}{" "}
                      <Text style={s.alertPrice}>${item.price.toFixed(2)}</Text>
                    </Text>
                    {item.note && <Text style={s.alertNote}>{item.note}</Text>}
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <View style={[s.statusBadge, {
                      backgroundColor: isTriggered ? colors.gold + "20" : colors.bullish + "14",
                      borderColor: isTriggered ? colors.gold + "50" : colors.bullish + "40",
                    }]}>
                      <Text style={[s.statusText, { color: isTriggered ? colors.gold : colors.bullish }]}>
                        {item.status}
                      </Text>
                    </View>
                    <Pressable onPress={() => deleteAlert(item.id)}>
                      <Ionicons name="close-circle-outline" size={18} color={colors.mutedForeground} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    headerArea: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
    title: { fontSize: 22, fontWeight: "700" as const, color: colors.foreground, flex: 1 },
    priceBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.bullish + "14", borderWidth: 1, borderColor: colors.bullish + "40", borderRadius: 100, paddingHorizontal: 10, paddingVertical: 4 },
    priceDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.bullish },
    priceText: { fontSize: 12, fontWeight: "700" as const, color: colors.bullish },
    formCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginHorizontal: 16, marginBottom: 12, gap: 10 },
    formTitle: { fontSize: 13, fontWeight: "600" as const, color: colors.foreground },
    dirRow: { flexDirection: "row", gap: 8 },
    dirBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.border },
    dirBtnActive: { backgroundColor: colors.gold, borderColor: colors.gold },
    dirText: { fontSize: 13, fontWeight: "600" as const, color: colors.mutedForeground },
    dirTextActive: { color: colors.primaryForeground },
    priceInput: { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: colors.foreground },
    noteInput: { backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.foreground },
    addBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.gold, borderRadius: 10, height: 44 },
    addBtnDisabled: { opacity: 0.6 },
    addBtnText: { fontSize: 14, fontWeight: "700" as const, color: colors.primaryForeground },
    list: { paddingHorizontal: 16, gap: 8 },
    alertCard: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
    alertTriggered: { borderColor: colors.gold + "50" },
    alertRow: { flexDirection: "row", alignItems: "center", gap: 10 },
    alertIconBox: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    alertLabel: { fontSize: 13, color: colors.foreground, fontWeight: "500" as const },
    alertPrice: { fontWeight: "700" as const },
    alertNote: { fontSize: 11, color: colors.mutedForeground, marginTop: 2 },
    statusBadge: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    statusText: { fontSize: 9, fontWeight: "700" as const, textTransform: "capitalize" as const, letterSpacing: 0.3 },
    empty: { alignItems: "center", paddingVertical: 40, gap: 8 },
    emptyTitle: { fontSize: 16, fontWeight: "600" as const, color: colors.mutedForeground },
    emptySubtitle: { fontSize: 13, color: colors.mutedForeground, textAlign: "center", paddingHorizontal: 24 },
  });
}
