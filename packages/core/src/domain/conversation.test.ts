import { describe, expect, it } from "vitest";
import { conversationReducer, initialConversationState } from "./conversation";

describe("conversation reducer", () => {
  it("models connection lifecycle", () => {
    let state = conversationReducer(initialConversationState, {
      type: "PREPARING",
    });
    state = conversationReducer(state, { type: "CONNECTING" });
    state = conversationReducer(state, { type: "CONNECTED" });
    expect(state.status).toBe("connected");
  });

  it("retains transcript while connection recovers", () => {
    let state = conversationReducer(initialConversationState, {
      type: "MESSAGE_STARTED",
      message: { id: "m1", role: "user", text: "Hello", status: "complete" },
    });
    state = conversationReducer(state, { type: "RECONNECTING" });
    expect(state.status).toBe("reconnecting");
    expect(state.messages[0].text).toBe("Hello");
  });

  it("accumulates partial assistant transcript events", () => {
    let state = conversationReducer(initialConversationState, {
      type: "MESSAGE_STARTED",
      message: { id: "m2", role: "assistant", text: "", status: "partial" },
    });
    state = conversationReducer(state, {
      type: "MESSAGE_DELTA",
      id: "m2",
      text: "Hi",
    });
    state = conversationReducer(state, {
      type: "MESSAGE_DELTA",
      id: "m2",
      text: " there",
    });
    expect(state.messages[0].text).toBe("Hi there");
  });

  it("toggles microphone mute state", () => {
    const state = conversationReducer(initialConversationState, {
      type: "MUTE_CHANGED",
      muted: true,
    });
    expect(state.muted).toBe(true);
  });
});
