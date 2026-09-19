import React from "react";
import { ScrollView, Text, StyleSheet, View } from "react-native";
import { palette } from "../design";

type Message = { id: string; role: "user" | "assistant"; text: string };

export function MessageStream({ messages }: { messages: Message[] }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {messages.map((msg) => (
        <View
          key={msg.id}
          style={[styles.bubble, msg.role === "user" ? styles.userBubble : styles.assistantBubble]}
        >
          <Text style={[styles.text, msg.role === "user" ? styles.userText : styles.assistantText]}>
            {msg.text}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: "80%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  userBubble: { alignSelf: "flex-end", backgroundColor: "rgba(244,119,98,0.2)" },
  assistantBubble: { alignSelf: "flex-start" },
  text: { fontSize: 15, lineHeight: 22 },
  userText: { color: "#FFFDF9" },
  assistantText: { color: palette.paper },
});
