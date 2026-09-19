import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { MessageStream } from "../ui/MessageStream";
import { VoiceOrb } from "../ui/VoiceOrb";
import { palette } from "../design";

type Message = { id: string; role: "user" | "assistant"; text: string };

export function ConversationScreen({
  planetName,
  messages,
  listening,
  onBack,
}: {
  planetName: string;
  messages: Message[];
  listening: boolean;
  onBack: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{planetName}</Text>
      </View>
      <MessageStream messages={messages} />
      <View style={styles.footer}>
        <VoiceOrb listening={listening} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(13,15,18,0.75)",
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  title: { color: palette.paper, fontSize: 20, fontWeight: "600" },
  footer: { alignItems: "center", padding: 16 },
});
