import {
  ChatClient,
  type ChatClientEvent,
  type ChatClientOptions,
  type SocketLike,
} from "../../../packages/core/src/application/chatClient";

export type { ChatClientEvent, SocketLike };

/**
 * The native app's socket, handed to the client every client shares.
 *
 * Holding a discussion open is the same on a phone as in a browser, so all of
 * it lives in the core. What is native here is the same two things: where the
 * channel is, and what a socket is made of. React Native ships a `WebSocket`,
 * so the second one costs nothing.
 */

/** Where the channel listens beside the API while a developer runs both. */
const DEVELOPMENT_PORT = 3020;
const DEVELOPMENT_PATH = "/ws/chat";
/** The hosts a simulator reaches the developer's own machine on. */
const LOOPBACK = ["localhost", "127.0.0.1", "10.0.2.2", "0.0.0.0"];

/**
 * The address to dial, or nothing at all.
 *
 * A deployment names it, because production serves the socket from its own
 * host. Development does not have to: the channel runs beside the API on the
 * machine the simulator is already talking to, so it is derived from the API
 * address rather than configured twice and then allowed to disagree. Anything
 * else returns nothing, and the conversation stays on the request path.
 */
export function chatSocketUrl(
  apiOrigin: string,
  override?: string,
): string | undefined {
  const configured = override?.trim();
  if (configured) return configured.replace(/\/$/, "");
  try {
    const api = new URL(apiOrigin);
    if (!LOOPBACK.includes(api.hostname)) return undefined;
    return `ws://${api.hostname}:${DEVELOPMENT_PORT}${DEVELOPMENT_PATH}`;
  } catch {
    return undefined;
  }
}

export type MobileChatOptions = Omit<ChatClientOptions, "open"> &
  Partial<Pick<ChatClientOptions, "open">>;

export function createChatClient(options: MobileChatOptions): ChatClient {
  return new ChatClient({
    ...options,
    open:
      options.open ??
      ((url: string) => new WebSocket(url) as unknown as SocketLike),
  });
}
