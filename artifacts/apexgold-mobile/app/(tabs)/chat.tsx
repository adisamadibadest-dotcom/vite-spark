import React, { useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";
import { sendChatMessage } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "What's the current XAU/USD bias?",
  "Best setup for gold today?",
  "Key support and resistance levels?",
  "Explain FVG in SMC",
];

export default function ChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const s = styles(colors);
  const flatRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || sending) return;
    setInput("");
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMsg: Message = { id: Date.now().toString(), role: "user", content };
    const currentMessages = [...messages, userMsg];
    setMessages(currentMessages);
    setSending(true);

    try {
      const history = currentMessages.slice(-9, -1).map((m) => ({ role: m.role, content: m.content }));
      const reply = await sendChatMessage(content, history);
      setMessages((prev) => [...prev, { id: (Date.now() + 1).toString(), role: "assistant", content: reply }]);
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "Sorry, I couldn't reach the server. Please try again.",
      }]);
    } finally {
      setSending(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom;

  const renderItem = ({ item }: { item: Message }) => (
    <View style={[s.bubble, item.role === "user" ? s.userBubble : s.aiBubble]}>
      {item.role === "assistant" && (
        <View style={s.aiAvatar}>
          <Ionicons name="flash" size={10} color={colors.primaryForeground} />
        </View>
      )}
      <View style={[s.bubbleInner, item.role === "user" ? s.userBubbleInner : s.aiBubbleInner]}>
        <Text style={[s.bubbleText, item.role === "user" ? s.userText : s.aiText]}>{item.content}</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={[s.root, { paddingTop: topPad }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Empty state / suggestions */}
      {messages.length === 0 && (
        <View style={s.emptyState}>
          <View style={s.emptyIcon}>
            <Ionicons name="flash" size={28} color={colors.gold} />
          </View>
          <Text style={s.emptyTitle}>ApexGold AI</Text>
          <Text style={s.emptySubtitle}>Ask anything about XAU/USD — structure, bias, levels, setups</Text>
          <View style={s.suggestions}>
            {SUGGESTIONS.map((q) => (
              <Pressable key={q} style={s.suggestion} onPress={() => send(q)}>
                <Text style={s.suggestionText}>{q}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        inverted={messages.length > 0}
        contentContainerStyle={[s.list, { paddingTop: 8 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        scrollEnabled={!!messages.length}
        ListHeaderComponent={
          sending ? (
            <View style={[s.bubble, s.aiBubble]}>
              <View style={s.aiAvatar}>
                <Ionicons name="flash" size={10} color={colors.primaryForeground} />
              </View>
              <View style={[s.bubbleInner, s.aiBubbleInner, { paddingVertical: 12, paddingHorizontal: 16 }]}>
                <ActivityIndicator size="small" color={colors.gold} />
              </View>
            </View>
          ) : null
        }
      />

      {/* Input bar */}
      <View style={[s.inputBar, { paddingBottom: bottomPad + 8 }]}>
        <TextInput
          style={s.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask about XAU/USD…"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={500}
          returnKeyType="send"
          onSubmitEditing={() => send()}
          blurOnSubmit
        />
        <Pressable
          style={[s.sendBtn, (!input.trim() || sending) && s.sendBtnDisabled]}
          onPress={() => send()}
          disabled={!input.trim() || sending}
          testID="chat-send"
        >
          <Ionicons name="arrow-up" size={18} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function styles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    list: { paddingHorizontal: 16, paddingBottom: 8, flexGrow: 0 },
    emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
    emptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.gold + "20", borderWidth: 1, borderColor: colors.gold + "40", alignItems: "center", justifyContent: "center", marginBottom: 16 },
    emptyTitle: { fontSize: 20, fontWeight: "700" as const, color: colors.foreground, marginBottom: 6 },
    emptySubtitle: { fontSize: 14, color: colors.mutedForeground, textAlign: "center", lineHeight: 20, marginBottom: 24 },
    suggestions: { width: "100%" as unknown as number, gap: 8 },
    suggestion: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
    suggestionText: { fontSize: 13, color: colors.foreground },
    bubble: { flexDirection: "row", marginVertical: 4, paddingHorizontal: 16 },
    userBubble: { justifyContent: "flex-end" },
    aiBubble: { justifyContent: "flex-start", alignItems: "flex-end", gap: 8 },
    aiAvatar: { width: 24, height: 24, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginBottom: 4 },
    bubbleInner: { maxWidth: "78%" as unknown as number, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 14 },
    userBubbleInner: { backgroundColor: colors.gold, borderBottomRightRadius: 4 },
    aiBubbleInner: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
    bubbleText: { fontSize: 14, lineHeight: 20 },
    userText: { color: colors.primaryForeground },
    aiText: { color: colors.foreground },
    inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 10, paddingHorizontal: 16, paddingTop: 10, backgroundColor: colors.background, borderTopWidth: 1, borderTopColor: colors.border },
    input: { flex: 1, backgroundColor: colors.input, borderWidth: 1, borderColor: colors.border, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 14, fontSize: 14, color: colors.foreground, maxHeight: 100 },
    sendBtn: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
    sendBtnDisabled: { opacity: 0.4 },
  });
}
