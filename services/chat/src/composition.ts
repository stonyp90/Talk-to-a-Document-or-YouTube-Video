// The live channel's assembly point: inbound socket -> use cases -> outbound
// ports. It mirrors the HTTP composition root in apps/web and shares its
// application and adapters; only the transport in front of it differs.
import { createChatChannel } from "../../../packages/core/src/application/chat";
import { createConversation } from "../../../packages/core/src/application/conversation";
import { createSessions } from "../../../packages/core/src/application/sessions";
import { resolveContextBudget } from "../../../packages/core/src/domain/context";
import { createConversationAdapter } from "../../../packages/adapters/src/openai";
import { createConfiguredSessionStore } from "../../../packages/adapters/src/sessionStore";
import { getOpenAiKey } from "../../../packages/adapters/src/secrets";

/** Configuration is read here and nowhere in the core. */
export const contextBudget = () =>
  resolveContextBudget(process.env.CONTEXT_CHARACTER_BUDGET);

/**
 * Built once per process. A warm container answers the next question without
 * rebuilding the provider client or reopening the conversation store.
 */
let channel: ReturnType<typeof createChatChannel> | undefined;

export function chatChannel(): ReturnType<typeof createChatChannel> {
  if (channel) return channel;
  const budget = contextBudget();
  channel = createChatChannel({
    sessions: createSessions(createConfiguredSessionStore()),
    conversation: createConversation(
      createConversationAdapter({ getKey: getOpenAiKey }, budget),
      budget,
    ),
    contextBudget: budget,
  });
  return channel;
}

/** Where the socket listens, and what it will accept, as configuration. */
export const socketSettings = () => ({
  port: Number(process.env.CHAT_PORT ?? 3020),
  host: process.env.CHAT_HOST ?? "0.0.0.0",
  path: process.env.CHAT_SOCKET_PATH ?? "/ws/chat",
  /** Origins a browser may open this socket from; empty means any. */
  allowedOrigins: (
    process.env.CHAT_ALLOWED_ORIGINS ??
    process.env.APP_ORIGIN ??
    ""
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  maxFrameBytes: Number(process.env.CHAT_MAX_FRAME_BYTES ?? 4_000_000),
  /** Questions one connection may ask per window, before it is told to wait. */
  askLimit: Number(process.env.CHAT_ASK_LIMIT ?? 30),
  askWindowMs: Number(process.env.CHAT_ASK_WINDOW_MS ?? 60_000),
  heartbeatMs: Number(process.env.CHAT_HEARTBEAT_MS ?? 30_000),
  rateLimitDisabled: process.env.RATE_LIMIT_DISABLED === "true",
});
