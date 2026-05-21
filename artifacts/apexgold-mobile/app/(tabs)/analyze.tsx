import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
  Image,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as Haptics from "expo-haptics";
import { Ionicons, Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { analyzeChart, type ChartAnalysis, type Bias } from "@/lib/api";

export default function AnalyzeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const s = styles(colors);

  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState("image/jpeg");
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ChartAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow access to your photo library.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.8,
      base64: false,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    setImageUri(asset.uri);
    setResult(null);
    setError(null);

    if (Platform.OS !== "web") {
      const b64 = await FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.Base64 });
      setImageBase64(b64);
      setMimeType(asset.mimeType ?? "image/jpeg");
    } else {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        setImageBase64(dataUrl.split(",")[1] ?? "");
        setMimeType(blob.type || "image/jpeg");
      };
      reader.readAsDataURL(blob);
    }
  };

  const runAnalysis = async () => {
    if (!imageBase64) return;
    setAnalyzing(true);
    setError(null);
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await analyzeChart(imageBase64, mimeType);
      setResult(res);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setAnalyzing(false);
    }
  };

  const biasColor = (b: Bias) =>
    b === "bullish" ? colors.bullish : b === "bearish" ? colors.bearish : colors.gold;

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <ScrollView
      style={[s.root, { paddingTop: topPad }]}
      contentContainerStyle={[s.content, { paddingBottom: Platform.OS === "web" ? 84 + 34 : insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={s.title}>Chart Analysis</Text>
      <Text style={s.subtitle}>Upload a XAUUSD chart for an AI institutional playbook</Text>

      {/* Image picker */}
      <Pressable
        style={({ pressed }) => [s.uploadBox, imageUri && s.uploadBoxFilled, pressed && { opacity: 0.8 }]}
        onPress={pickImage}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={s.previewImg} resizeMode="cover" />
        ) : (
          <View style={s.uploadPlaceholder}>
            <Ionicons name="cloud-upload-outline" size={36} color={colors.gold} />
            <Text style={s.uploadText}>Tap to upload chart</Text>
            <Text style={s.uploadSub}>TradingView, MT4/5, any screenshot</Text>
          </View>
        )}
      </Pressable>

      {imageUri && !result && (
        <Pressable
          style={({ pressed }) => [s.analyzeBtn, (analyzing || !imageBase64) && s.analyzeBtnDisabled, pressed && { opacity: 0.85 }]}
          onPress={runAnalysis}
          disabled={analyzing || !imageBase64}
          testID="analyze-button"
        >
          {analyzing ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Ionicons name="flash" size={16} color={colors.primaryForeground} />
              <Text style={s.analyzeBtnText}>Analyze Chart</Text>
            </>
          )}
        </Pressable>
      )}

      {analyzing && (
        <View style={s.analyzingCard}>
          <ActivityIndicator color={colors.gold} />
          <Text style={s.analyzingText}>Reading price structure, liquidity zones and setup…</Text>
        </View>
      )}

      {error && (
        <View style={s.errorBox}>
          <Ionicons name="alert-circle-outline" size={16} color={colors.destructive} />
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}

      {result && (
        <>
          {/* Bias header */}
          <View style={[s.biasCard, { borderColor: biasColor(result.bias) + "60" }]}>
            <View style={s.biasRow}>
              <View style={[s.biasDot, { backgroundColor: biasColor(result.bias) }]} />
              <Text style={[s.biasLabel, { color: biasColor(result.bias) }]}>
                {result.bias.toUpperCase()}
              </Text>
              <Text style={s.confText}>{Math.round(result.confidence)}% confidence</Text>
            </View>
            <Text style={s.summary}>{result.summary}</Text>
          </View>

          {/* Reasoning */}
          <View style={s.card}>
            <View style={s.cardHeader}>
              <Feather name="layers" size={14} color={colors.gold} />
              <Text style={s.cardTitle}>Structure Read</Text>
            </View>
            {[
              { label: "Structure", value: result.reasoning.structure },
              { label: "Liquidity", value: result.reasoning.liquidity },
              { label: "Momentum", value: result.reasoning.momentum },
              { label: "Key Levels", value: result.reasoning.levels },
            ].map((item) => item.value ? (
              <View key={item.label} style={s.reasonItem}>
                <Text style={s.reasonLabel}>{item.label}</Text>
                <Text style={s.reasonValue}>{item.value}</Text>
              </View>
            ) : null)}
          </View>

          {/* Trade Setup */}
          {result.setup?.valid && (
            <View style={[s.card, s.setupCard]}>
              <View style={s.cardHeader}>
                <Ionicons name="trending-up" size={14} color={colors.gold} />
                <Text style={s.cardTitle}>Trade Setup</Text>
                <View style={[s.dirBadge, {
                  backgroundColor: result.setup.direction === "long" ? colors.bullish + "20" : colors.bearish + "20",
                  borderColor: result.setup.direction === "long" ? colors.bullish + "60" : colors.bearish + "60",
                }]}>
                  <Text style={[s.dirText, { color: result.setup.direction === "long" ? colors.bullish : colors.bearish }]}>
                    {result.setup.direction.toUpperCase()} · {result.setup.tradeType?.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View style={s.setupGrid}>
                <SetupCell label="Entry" value={result.setup.entryZone ? `${result.setup.entryZone.low}–${result.setup.entryZone.high}` : result.setup.entry} colors={colors} />
                <SetupCell label="Stop Loss" value={result.setup.stopLoss} colors={colors} red />
                <SetupCell label="TP1" value={result.setup.takeProfits[0] ?? "—"} colors={colors} green />
                <SetupCell label="TP2" value={result.setup.takeProfits[1] ?? "—"} colors={colors} green />
                <SetupCell label="TP3" value={result.setup.takeProfits[2] ?? "—"} colors={colors} green />
                <SetupCell label="R:R" value={result.setup.riskReward} colors={colors} />
              </View>
              {result.setup.rationale && (
                <Text style={s.rationale}>{result.setup.rationale}</Text>
              )}
            </View>
          )}

          {result.setup && !result.setup.valid && result.setup.noSetupReason && (
            <View style={s.noSetup}>
              <Ionicons name="information-circle-outline" size={14} color={colors.mutedForeground} />
              <Text style={s.noSetupText}>{result.setup.noSetupReason}</Text>
            </View>
          )}

          {/* Re-analyze */}
          <Pressable style={s.resetBtn} onPress={() => { setResult(null); setImageUri(null); setImageBase64(null); }}>
            <Text style={s.resetText}>Analyze another chart</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

function SetupCell({ label, value, colors, red, green }: { label: string; value: string; colors: Record<string, string>; red?: boolean; green?: boolean }) {
  const color = red ? colors.bearish : green ? colors.bullish : colors.foreground;
  return (
    <View style={{ flex: 1, minWidth: "30%" as unknown as number }}>
      <Text style={{ fontSize: 8, color: colors.mutedForeground, textTransform: "uppercase" as const, letterSpacing: 0.5 }}>{label}</Text>
      <Text style={{ fontSize: 13, fontWeight: "700" as const, color, marginTop: 2 }}>{value}</Text>
    </View>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, gap: 12 },
    title: { fontSize: 22, fontWeight: "700" as const, color: colors.foreground, marginTop: 8 },
    subtitle: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
    uploadBox: { borderWidth: 2, borderColor: colors.border, borderStyle: "dashed" as const, borderRadius: 16, minHeight: 180, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    uploadBoxFilled: { borderStyle: "solid" as const, borderColor: colors.gold + "60" },
    uploadPlaceholder: { alignItems: "center", gap: 8, padding: 24 },
    uploadText: { fontSize: 15, fontWeight: "600" as const, color: colors.foreground },
    uploadSub: { fontSize: 12, color: colors.mutedForeground },
    previewImg: { width: "100%" as unknown as number, height: 220 },
    analyzeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: colors.gold, borderRadius: 12, height: 48 },
    analyzeBtnDisabled: { opacity: 0.5 },
    analyzeBtnText: { fontSize: 15, fontWeight: "700" as const, color: colors.primaryForeground },
    analyzingCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14 },
    analyzingText: { flex: 1, fontSize: 13, color: colors.mutedForeground, lineHeight: 18 },
    errorBox: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.destructive + "18", borderWidth: 1, borderColor: colors.destructive + "40", borderRadius: 10, padding: 12 },
    errorText: { flex: 1, fontSize: 13, color: colors.destructive },
    biasCard: { backgroundColor: colors.card, borderWidth: 1, borderRadius: 14, padding: 14 },
    biasRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
    biasDot: { width: 8, height: 8, borderRadius: 4 },
    biasLabel: { fontSize: 14, fontWeight: "700" as const, letterSpacing: 1 },
    confText: { fontSize: 11, color: colors.mutedForeground, marginLeft: "auto" as unknown as number },
    summary: { fontSize: 13, color: colors.foreground, lineHeight: 19 },
    card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14 },
    setupCard: { borderColor: colors.gold + "40" },
    cardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
    cardTitle: { fontSize: 13, fontWeight: "600" as const, color: colors.foreground },
    reasonItem: { marginBottom: 8 },
    reasonLabel: { fontSize: 9, color: colors.gold, textTransform: "uppercase" as const, letterSpacing: 1, fontWeight: "600" as const },
    reasonValue: { fontSize: 12, color: colors.foreground, lineHeight: 17, marginTop: 2 },
    dirBadge: { marginLeft: "auto" as unknown as number, borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    dirText: { fontSize: 9, fontWeight: "700" as const, letterSpacing: 0.5 },
    setupGrid: { flexDirection: "row", flexWrap: "wrap" as const, gap: 12 },
    rationale: { fontSize: 12, color: colors.mutedForeground, lineHeight: 17, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
    noSetup: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.muted, borderRadius: 10, padding: 12 },
    noSetupText: { flex: 1, fontSize: 12, color: colors.mutedForeground },
    resetBtn: { alignItems: "center", padding: 14 },
    resetText: { fontSize: 13, color: colors.gold, fontWeight: "600" as const },
  });
}
