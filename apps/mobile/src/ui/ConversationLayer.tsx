import React, { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import * as Speech from "expo-speech";
import { palette as c } from "../design";
import type { Turn } from "../client";

export function ConversationLayer({
  turns,
  visible,
  onClose,
  onSend,
  busy,
  sourceName,
  assistantName = "Assistant",
}: {
  turns: Turn[];
  visible: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
  busy: boolean;
  sourceName: string;
  assistantName?: string;
}) {
  const [text, setText] = useState("");
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const opacity = useSharedValue(0);
  const slideY = useSharedValue(40);
  const lastSpokenIndex = useRef<string>("");

  opacity.value = withTiming(visible ? 1 : 0, { duration: 300 });
  slideY.value = withTiming(visible ? 0 : 40, { duration: 300 });

  useEffect(() => {
    if (busy) return;
    const lastAssistant = turns
      .map((t, i) => ({ t, i }))
      .reverse()
      .find(({ t }) => t.role === "assistant");
    if (!lastAssistant || !lastAssistant.t.text.trim()) return;
    const key = `${lastAssistant.i}:${lastAssistant.t.text.length}`;
    if (lastSpokenIndex.current === key) return;
    lastSpokenIndex.current = key;
    Speech.stop();
    Speech.speak(lastAssistant.t.text, {
      language: "en-US",
      rate: 0.95,
    });
  }, [turns, busy]);

  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: slideY.value }],
  }));

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    onSend(trimmed);
    setText("");
  };

  if (!visible) return null;

  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
      <View style={styles.backdrop} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.header}>
          <View style={styles.headerInfo}>
            <Text style={styles.headerLabel}>CONVERSATION</Text>
            <Text style={styles.headerSource} numberOfLines={1}>
              {sourceName}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close conversation"
            onPress={onClose}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>×</Text>
          </Pressable>
        </View>

        <View style={styles.messages}>
          {turns.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Ask anything about this video
              </Text>
              <Text style={styles.emptyHint}>
                Answers stay grounded in the source
              </Text>
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              onContentSizeChange={() =>
                scrollRef.current?.scrollToEnd({ animated: true })
              }
              keyboardShouldPersistTaps="handled"
            >
              {turns.map((turn) => (
                <View
                  key={turn.id}
                  style={[
                    styles.bubble,
                    turn.role === "user"
                      ? styles.userBubble
                      : styles.assistantBubble,
                  ]}
                >
                  <Text style={styles.author}>
                    {turn.role === "user" ? "You" : assistantName}
                  </Text>
                  <Text selectable style={styles.bubbleText}>
                    {turn.text}
                  </Text>
                </View>
              ))}
              {busy && (
                <View style={[styles.bubble, styles.assistantBubble]}>
                  <View style={styles.typing}>
                    <View style={styles.dot} />
                    <View style={[styles.dot, styles.dot2]} />
                    <View style={[styles.dot, styles.dot3]} />
                  </View>
                </View>
              )}
            </ScrollView>
          )}
        </View>

        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder="Ask about this video…"
            placeholderTextColor="rgba(255, 255, 255, 0.35)"
            editable={!busy}
            multiline
            returnKeyType="send"
            blurOnSubmit={false}
            onSubmitEditing={handleSend}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            onPress={handleSend}
            disabled={busy || !text.trim()}
            style={[
              styles.sendButton,
              (!text.trim() || busy) && styles.sendButtonDisabled,
            ]}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(13, 15, 18, 0.75)",
  },
  container: {
    flex: 1,
    paddingTop: 60,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
  },
  headerInfo: { flex: 1, gap: 2 },
  headerLabel: {
    color: c.coral,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  headerSource: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  closeText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 22,
    lineHeight: 24,
  },
  messages: {
    flex: 1,
    minHeight: 0,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 10,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 16,
    fontWeight: "500",
  },
  emptyHint: {
    color: "rgba(255, 255, 255, 0.35)",
    fontSize: 13,
  },
  bubble: {
    borderRadius: 18,
    padding: 12,
    maxWidth: "82%",
    borderWidth: 1,
    gap: 4,
  },
  userBubble: {
    alignSelf: "flex-end",
    backgroundColor: "rgba(244, 119, 98, 0.18)",
    borderColor: "rgba(244, 119, 98, 0.25)",
  },
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  author: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  bubbleText: {
    color: "rgba(255, 255, 255, 0.9)",
    fontSize: 14,
    lineHeight: 21,
  },
  typing: {
    flexDirection: "row",
    gap: 4,
    paddingVertical: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.4)",
  },
  dot2: { opacity: 0.6 },
  dot3: { opacity: 0.3 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    margin: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    padding: 6,
  },
  input: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
    minHeight: 40,
    maxHeight: 100,
    padding: 10,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 16,
    backgroundColor: c.coral,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    opacity: 0.4,
  },
  sendIcon: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
  },
});
