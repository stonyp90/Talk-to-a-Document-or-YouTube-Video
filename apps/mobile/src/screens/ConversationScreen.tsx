import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, StyleSheet, Text, Pressable } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MessageStream } from "../ui/MessageStream";
import { VoiceOrb } from "../ui/VoiceOrb";
import { palette } from "../design";
import { useConversation } from "../conversation/useConversation";
import { useConversationVoice } from "../conversation/useConversationVoice";
import { generateReply } from "../conversation/generateReply";
import { useSpeech } from "../conversation/useSpeech";

const SPEED_KEY = "ursly-voice-speed-v1";

export function ConversationOverlay({
  planetName,
  onClose,
}: {
  planetName: string;
  onClose: () => void;
}) {
  const { messages, addUserMessage, addAssistantMessage } = useConversation(planetName);
  const [listening, setListening] = useState(false);
  const [speed, setSpeed] = useState(1.0);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { speak, stop: stopSpeaking } = useSpeech(speed);

  useEffect(() => {
    let mounted = true;
    void AsyncStorage.getItem(SPEED_KEY).then((value) => {
      if (!mounted || value === null) return;
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) setSpeed(Math.min(1.5, Math.max(0.5, parsed)));
    });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
      stopSpeaking();
    };
  }, [stopSpeaking]);

  const handleUserSpeech = useCallback(
    (text: string) => {
      const lower = text.toLowerCase();
      if (lower.includes("go back") || lower.includes("close")) {
        stopSpeaking();
        onClose();
        return;
      }
      addUserMessage(text);
      const reply = generateReply(planetName, text);
      replyTimer.current = setTimeout(() => {
        addAssistantMessage(reply);
        speak(reply);
      }, 800);
    },
    [onClose, addUserMessage, addAssistantMessage, planetName, speak, stopSpeaking],
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
