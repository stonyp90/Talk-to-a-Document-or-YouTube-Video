import {
  ChatClient,
  type ChatClientEvent,
  type ChatClientOptions,
  type SocketLike,
} from "@/packages/core/src/application/chatClient";

/**
 * The browser's socket, handed to the client every client shares.
 *
 * Holding a discussion open — attaching, reconnecting, re-asking a question the
 * server forgot — is the same everywhere and lives in the core. The two things
 * that are a browser's own business live here: where the channel is, and what a
 * socket is made of.
 */

export type ChatSocketEvent = ChatClientEvent;
export type { SocketLike };
export type ChatSocketOptions = Omit<ChatClientOptions, "open"> &
  Partial<Pick<ChatClientOptions, "open">>;

/**
 * Where the live channel is. It is configured rather than derived, because the
 * socket is served by its own endpoint in every environment: another port in
 * development, another host in production.
 */
export function chatSocketUrl(
  configured: string | undefined = process.env.NEXT_PUBLIC_CHAT_SOCKET_URL,
): string | undefined {
  const value = configured?.trim();
  return value ? value : undefined;
}

export class ChatSocket extends ChatClient {
  constructor(options: ChatSocketOptions) {
    super({
      ...options,
      open:
        options.open ??
        ((url: string) => new WebSocket(url) as unknown as SocketLike),
    });
  }
}
