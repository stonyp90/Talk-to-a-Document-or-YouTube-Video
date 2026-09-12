import { createServer, type IncomingMessage, type Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import {
  encodeServerMessage,
  type ServerMessage,
} from "../../../packages/core/src/domain/chat";
import type {
  ChatFrameOptions,
  ChatSend,
} from "../../../packages/core/src/application/chat";
import { chatChannel, socketSettings } from "./composition";
import { createAskAllowance, isAllowedOrigin } from "./policy";

type Channel = {
  handle(
    frame: string | unknown,
    send: ChatSend,
    options?: ChatFrameOptions,
  ): Promise<void>;
};

export type ChatServerOptions = Partial<ReturnType<typeof socketSettings>> & {
  channel?: Channel;
};

export type RunningChatServer = {
  port: number;
  close(): Promise<void>;
};

/**
 * The live channel as a long-lived Node process: one socket per reader, held
 * open for the whole discussion. It is the transport used in development and
 * in the local stack; production carries the same protocol over a managed
 * gateway, and both drive the same application channel.
 */
export async function startChatServer(
  options: ChatServerOptions = {},
): Promise<RunningChatServer> {
  const settings = { ...socketSettings(), ...options };
  const channel = options.channel ?? chatChannel();
  const http = createServer((request, response) => {
    if (request.url?.startsWith("/health")) {
      response.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      response.end(
        JSON.stringify({
          ok: true,
          service: "chat",
          mode: process.env.PROVIDER_MODE ?? "mock",
          path: settings.path,
        }),
      );
      return;
    }
    response.writeHead(404, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ error: "Not found", code: "NOT_FOUND" }));
  });

  const sockets = new WebSocketServer({
    noServer: true,
    maxPayload: settings.maxFrameBytes,
  });

  http.on("upgrade", (request, socket, head) => {
    const path = (request.url ?? "").split("?")[0];
    const refuse = (status: string) => {
      socket.write(`HTTP/1.1 ${status}\r\nConnection: close\r\n\r\n`);
      socket.destroy();
    };
    if (path !== settings.path) return refuse("404 Not Found");
    if (!isAllowedOrigin(originOf(request), settings.allowedOrigins))
      return refuse("403 Forbidden");
    sockets.handleUpgrade(request, socket, head, (connection) =>
      sockets.emit("connection", connection, request),
    );
  });

  sockets.on("connection", (connection: WebSocket) => {
    const allowance = createAskAllowance({
      limit: settings.askLimit,
      windowMs: settings.askWindowMs,
      disabled: settings.rateLimitDisabled,
    });
    const send = (message: ServerMessage) => {
      if (connection.readyState === connection.OPEN)
        connection.send(encodeServerMessage(message));
    };
    let alive = true;
    connection.on("pong", () => {
      alive = true;
    });
    const heartbeat = setInterval(() => {
      if (!alive) return connection.terminate();
      alive = false;
      connection.ping();
    }, settings.heartbeatMs);

    // Only a question spends the allowance, and the application is what knows
    // a frame is one, so the budget is handed in rather than guessed at here.
    connection.on("message", (raw) => {
      void channel.handle(raw.toString(), send, {
        allowAsk: () => allowance.take(Date.now()),
      });
    });
    connection.on("close", () => clearInterval(heartbeat));
    connection.on("error", () => connection.close());
  });

  await new Promise<void>((resolve) =>
    http.listen(settings.port, settings.host, resolve),
  );
  const address = http.address();
  return {
    port: typeof address === "object" && address ? address.port : settings.port,
    close: () => closeServer(http, sockets),
  };
}

const originOf = (request: IncomingMessage): string | undefined => {
  const origin = request.headers.origin;
  return Array.isArray(origin) ? origin[0] : origin;
};

async function closeServer(
  http: Server,
  sockets: WebSocketServer,
): Promise<void> {
  for (const connection of sockets.clients) connection.terminate();
  await new Promise<void>((resolve) => sockets.close(() => resolve()));
  // A socket that was refused, or a health check still held open, would keep
  // the server from ever finishing its close.
  http.closeAllConnections();
  await new Promise<void>((resolve) => http.close(() => resolve()));
}
