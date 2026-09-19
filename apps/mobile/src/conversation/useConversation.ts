import { useState, useCallback } from "react";

export type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

let counter = 0;
function nextId() {
  return `msg-${++counter}`;
}

const GREETINGS: Record<string, string> = {
  Discover: "What would you like to explore?",
  Design: "Ready to design. What are we working on?",
  Plan: "Let's plan it out. What's the goal?",
  Build: "Let's build. What do you need?",
  Test: "Testing mode. What should we verify?",
  Deploy: "Ready to ship. What's the target?",
  Monitor: "Watching. What metrics matter?",
  Learn: "What do you want to learn about?",
  Iterate: "What should we improve?",
};

export function useConversation(planetName: string) {
  const [messages, setMessages] = useState<Message[]>(() => [
    { id: nextId(), role: "assistant", text: GREETINGS[planetName] ?? `Hello. I'm ${planetName}.` },
  ]);

  const addUserMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text }]);
  }, []);

  const addAssistantMessage = useCallback((text: string) => {
    setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text }]);
  }, []);

  return { messages, addUserMessage, addAssistantMessage };
}
