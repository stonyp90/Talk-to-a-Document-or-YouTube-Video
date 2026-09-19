import React, { useCallback, useEffect, useState } from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import { MessageStream } from "../ui/MessageStream";
import { VoiceOrb } from "../ui/VoiceOrb";
import { palette } from "../design";
import { useConversation } from "../conversation/useConversation";
import { useConversationVoice } from "../conversation/useConversationVoice";

type Message = { id: string; role: "user" | "assistant"; text: string };

export function ConversationOverlay({
  planetName,
  onClose,
}: {
  planetName: string;
  onClose: () => void;
}) {
  const { messages, addUserMessage } = useConversation(planetName);
  const [listening, setListening] = useState(false);

  const handleUserSpeech = useCallback(
    (text: string) => {
      const lower = text.toLowerCase();
      if (lower.includes("go back") || lower.includes("close")) {
        onClose();
        return;
      }
      addUserMessage(text);
    },
    [onClose, addUserMessage],
  );

  const { startListening, stopListening } = useConversationVoice(
    true,
    handleUserSpeech,
  );

  const toggleListening = useCallback(() => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
    setListening((prev) => !prev);
  }, [listening, startListening, stopListening]);

  useEffect(() => {
    return () => stopListening();
  }, [stopListening]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{planetName}</Text>
        <Pressable onPress={onClose} hitSlop={12}>
          <Text style={styles.closeBtn}>✕</Text>
        </Pressable>
      </View>
      <MessageStream messages={messages} />
      <View style={styles.footer}>
        <VoiceOrb listening={listening} onPress={toggleListening} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(13,15,18,0.85)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  title: { color: palette.paper, fontSize: 20, fontWeight: "600" },
  closeBtn: { color: palette.muted, fontSize: 20, padding: 4 },
  footer: { alignItems: "center", padding: 16 },
});
