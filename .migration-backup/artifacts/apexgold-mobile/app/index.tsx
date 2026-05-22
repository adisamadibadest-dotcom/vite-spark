import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

export default function Index() {
  const { session, loading } = useAuth();
  const colors = useColors();

  useEffect(() => {
    if (loading) return;
    if (session) {
      router.replace("/(tabs)/market");
    } else {
      router.replace("/auth");
    }
  }, [session, loading]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}
