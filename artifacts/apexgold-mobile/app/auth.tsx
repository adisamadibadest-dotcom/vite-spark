import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "@/lib/supabase";
import { useColors } from "@/hooks/useColors";

type Mode = "signin" | "signup";

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const s = styles(colors);

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error: err } = await supabase.auth.signUp({ email: email.trim(), password });
        if (err) throw err;
        setSuccess("Account created! Check your email to confirm.");
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (err) throw err;
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace("/(tabs)/market");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      if (/already registered|already exists/i.test(msg)) {
        setError("Email already registered. Try signing in.");
      } else if (/invalid login credentials/i.test(msg)) {
        setError("Invalid email or password.");
      } else {
        setError(msg);
      }
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* Logo */}
        <View style={s.logoRow}>
          <View style={s.logoBox}>
            <Ionicons name="flash" size={22} color={colors.primaryForeground} />
          </View>
          <View>
            <Text style={s.logoName}>ApexGold AI</Text>
            <Text style={s.logoSub}>TRADING INTELLIGENCE</Text>
          </View>
        </View>

        <Text style={s.headline}>
          {mode === "signin" ? "Welcome back" : "Create account"}
        </Text>
        <Text style={s.subtext}>
          {mode === "signin"
            ? "Sign in to access your trading dashboard."
            : "Get institutional-grade AI analysis."}
        </Text>

        {/* Mode toggle */}
        <View style={s.toggle}>
          {(["signin", "signup"] as Mode[]).map((m) => (
            <Pressable
              key={m}
              style={[s.toggleBtn, mode === m && s.toggleBtnActive]}
              onPress={() => { setMode(m); setError(null); setSuccess(null); }}
            >
              <Text style={[s.toggleText, mode === m && s.toggleTextActive]}>
                {m === "signin" ? "Sign in" : "Create account"}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Email */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>Email</Text>
          <View style={s.inputRow}>
            <Ionicons name="mail-outline" size={16} color={colors.mutedForeground} style={s.inputIcon} />
            <TextInput
              style={s.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="emailAddress"
            />
          </View>
        </View>

        {/* Password */}
        <View style={s.fieldGroup}>
          <Text style={s.label}>Password</Text>
          <View style={s.inputRow}>
            <Ionicons name="lock-closed-outline" size={16} color={colors.mutedForeground} style={s.inputIcon} />
            <TextInput
              style={[s.input, { flex: 1 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor={colors.mutedForeground}
              secureTextEntry={!showPassword}
              textContentType={mode === "signin" ? "password" : "newPassword"}
            />
            <Pressable onPress={() => setShowPassword((v) => !v)} style={s.eyeBtn}>
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={16}
                color={colors.mutedForeground}
              />
            </Pressable>
          </View>
        </View>

        {/* Error / Success */}
        {error && (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.destructive} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}
        {success && (
          <View style={s.successBox}>
            <Ionicons name="checkmark-circle-outline" size={14} color={colors.bullish} />
            <Text style={s.successText}>{success}</Text>
          </View>
        )}

        {/* Submit */}
        <Pressable
          style={({ pressed }) => [s.submitBtn, pressed && s.submitBtnPressed, loading && s.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={loading}
          testID="auth-submit"
        >
          {loading ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <Text style={s.submitText}>{mode === "signin" ? "Sign in" : "Create account"}</Text>
          )}
        </Pressable>

        <Text style={s.disclaimer}>Not financial advice.</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styles(colors: any) {
  return StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      padding: 24,
      paddingBottom: 48,
    },
    logoRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginBottom: 32,
    },
    logoBox: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.gold,
      alignItems: "center",
      justifyContent: "center",
    },
    logoName: {
      fontSize: 16,
      fontWeight: "700" as const,
      color: colors.gold,
      letterSpacing: -0.3,
    },
    logoSub: {
      fontSize: 8,
      fontWeight: "600" as const,
      color: colors.mutedForeground,
      letterSpacing: 2,
      marginTop: 2,
    },
    headline: {
      fontSize: 28,
      fontWeight: "700" as const,
      color: colors.foreground,
      marginBottom: 6,
    },
    subtext: {
      fontSize: 14,
      color: colors.mutedForeground,
      marginBottom: 24,
      lineHeight: 20,
    },
    toggle: {
      flexDirection: "row",
      backgroundColor: colors.muted,
      borderRadius: 10,
      padding: 4,
      marginBottom: 20,
    },
    toggleBtn: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: 8,
      alignItems: "center",
    },
    toggleBtnActive: {
      backgroundColor: colors.gold,
    },
    toggleText: {
      fontSize: 12,
      fontWeight: "600" as const,
      color: colors.mutedForeground,
    },
    toggleTextActive: {
      color: colors.primaryForeground,
    },
    fieldGroup: {
      marginBottom: 14,
    },
    label: {
      fontSize: 11,
      fontWeight: "600" as const,
      color: colors.mutedForeground,
      letterSpacing: 0.5,
      marginBottom: 6,
      textTransform: "uppercase" as const,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.input,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      height: 46,
    },
    inputIcon: {
      marginRight: 8,
    },
    input: {
      flex: 1,
      fontSize: 14,
      color: colors.foreground,
    },
    eyeBtn: {
      padding: 4,
    },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.destructive + "18",
      borderWidth: 1,
      borderColor: colors.destructive + "40",
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
    },
    errorText: {
      fontSize: 12,
      color: colors.destructive,
      flex: 1,
    },
    successBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      backgroundColor: colors.bullish + "18",
      borderWidth: 1,
      borderColor: colors.bullish + "40",
      borderRadius: 8,
      padding: 10,
      marginBottom: 12,
    },
    successText: {
      fontSize: 12,
      color: colors.bullish,
      flex: 1,
    },
    submitBtn: {
      backgroundColor: colors.gold,
      borderRadius: 12,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4,
    },
    submitBtnPressed: {
      opacity: 0.85,
    },
    submitBtnDisabled: {
      opacity: 0.6,
    },
    submitText: {
      fontSize: 15,
      fontWeight: "700" as const,
      color: colors.primaryForeground,
    },
    disclaimer: {
      marginTop: 20,
      fontSize: 11,
      color: colors.mutedForeground,
      textAlign: "center",
    },
  });
}
