export type ConnectionStatus =
  | "idle"
  | "preparing"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended"
  | "error";

export type ConversationMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  status?: "partial" | "complete";
};

export type ConversationState = {
  status: ConnectionStatus;
  muted: boolean;
  messages: ConversationMessage[];
  error?: string;
};

export type ConversationEvent =
  | { type: "RESET" }
  | { type: "PREPARING" }
  | { type: "CONNECTING" }
  | { type: "CONNECTED" }
  | { type: "RECONNECTING" }
  | { type: "ENDED" }
  | { type: "ERROR"; message: string }
  | { type: "MUTE_CHANGED"; muted: boolean }
  | { type: "MESSAGE_STARTED"; message: ConversationMessage }
  | { type: "MESSAGE_DELTA"; id: string; text: string }
  | { type: "MESSAGE_COMPLETED"; id: string; text?: string }
  | { type: "CLEAR_ERROR" };

export const initialConversationState: ConversationState = {
  status: "idle",
  muted: false,
  messages: [],
};

export function conversationReducer(
  state: ConversationState,
  event: ConversationEvent,
): ConversationState {
  switch (event.type) {
    case "RESET":
      return { ...initialConversationState, messages: [] };
    case "PREPARING":
      return { ...state, status: "preparing", error: undefined };
    case "CONNECTING":
      return { ...state, status: "connecting", error: undefined };
    case "CONNECTED":
      return { ...state, status: "connected", error: undefined };
    case "RECONNECTING":
      return { ...state, status: "reconnecting" };
    case "ENDED":
      return { ...state, status: "ended", muted: false };
    case "ERROR":
      return { ...state, status: "error", error: event.message };
    case "CLEAR_ERROR":
      return { ...state, error: undefined };
    case "MUTE_CHANGED":
      return { ...state, muted: event.muted };
    case "MESSAGE_STARTED":
      return { ...state, messages: [...state.messages, event.message] };
    case "MESSAGE_DELTA":
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === event.id
            ? {
                ...message,
                text: `${message.text}${event.text}`,
                status: "partial",
              }
            : message,
        ),
      };
    case "MESSAGE_COMPLETED":
      return {
        ...state,
        messages: state.messages.map((message) =>
          message.id === event.id
            ? {
                ...message,
                text: event.text ?? message.text,
                status: "complete",
              }
            : message,
        ),
      };
  }
}
