import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { WebSocket } from "ws";
import { startChatServer, type RunningChatServer } from "./server";
import { createChatChannel } from "../../../packages/core/src/application/chat";
import { createSessions } from "../../../packages/core/src/application/sessions";
import { createMemorySessionStore } from "../../../packages/adapters/src/sessionStore";
import type { ServerMessage } from "../../../packages/core/src/domain/chat";
import type { ConversationPort } from "../../../packages/core/src/application/ports";

const source = {
  kind: "pdf" as const,
  sourceName: "brief.pdf",
  text: "The budget is 42.",
  characters: 17,
};

const conversation: ConversationPort = {
  async createRealtimeSession() {
    throw new Error("not used");
  },
  async createRealtimeCallAnswer() {
    throw new Error("not used");
  },
  async answerTextQuestion() {
    return "The budget is 42.";
  },
  async *streamTextAnswer() {
    yield* ["The ", "budget ", "is 42."];
  },
};

const channel = () =>
  createChatChannel({
    sessions: createSessions(createMemorySessionStore()),
    conversation,
  });

let running: RunningChatServer;

/** Opens a client socket and collects every frame the server sends back. */
async function connect(options: { origin?: string } = {}) {
  const socket = new WebSocket(`ws://127.0.0.1:${running.port}/ws/chat`, {
    origin: options.origin ?? "http://localhost:3000",
  });
  const received: ServerMessage[] = [];
  socket.on("message", (raw) => received.push(JSON.parse(raw.toString())));
  await new Promise<void>((resolve, reject) => {
    socket.once("open", resolve);
    socket.once("error", reject);
  });
  return {
    socket,
    received,
    send: (message: unknown) => socket.send(JSON.stringify(message)),
    /** Waits for the frame a step depends on rather than for a fixed delay. */
    async until(type: string, count = 1, timeoutMs = 4000) {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        const matching = received.filter((message) => message.type === type);
        if (matching.length >= count) return matching[count - 1];
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      throw new Error(`No ${type} frame arrived: ${JSON.stringify(received)}`);
    },
  };
}

beforeEach(async () => {
  running = await startChatServer({
    port: 0,
    host: "127.0.0.1",
    channel: channel(),
    allowedOrigins: ["http://localhost:3000"],
  });
});

afterEach(async () => {
  await running.close();
  vi.unstubAllEnvs();
});

it("holds one socket open for a whole discussion", async () => {
  const client = await connect();
  client.send({ type: "attach", source });
  const ready = (await client.until("ready")) as { sourceId: string };
  expect(ready.sourceId).toBeTruthy();

  client.send({
    type: "ask",
    askId: "ask-1",
    sourceId: ready.sourceId,
    question: "What is the budget?",
  });
  const completed = await client.until("answer.completed");
  expect(completed).toMatchObject({
    askId: "ask-1",
    text: "The budget is 42.",
  });
  expect(
    client.received.filter((message) => message.type === "answer.delta"),
  ).toHaveLength(3);

  // The same socket carries the follow-up; nothing is sent again but the id.
  client.send({
    type: "ask",
    askId: "ask-2",
    sourceId: ready.sourceId,
    question: "Who approved it?",
  });
  expect(await client.until("answer.completed", 2)).toMatchObject({
    askId: "ask-2",
  });
  expect(
    client.received.filter((message) => message.type === "answer.completed"),
  ).toHaveLength(2);
  client.socket.close();
});

it("answers a keepalive so an idle discussion is not dropped", async () => {
  const client = await connect();
  client.send({ type: "ping" });
  expect(await client.until("pong")).toEqual({ type: "pong" });
  client.socket.close();
});

it("reports a bad frame and keeps the discussion open", async () => {
  const client = await connect();
  client.socket.send("not json");
  await client.until("error");
  client.send({ type: "ping" });
  expect(await client.until("pong")).toEqual({ type: "pong" });
  client.socket.close();
});

it("refuses a socket opened from an origin the deployment did not name", async () => {
  await expect(connect({ origin: "https://evil.example" })).rejects.toThrow();
});

it("refuses a socket opened on another path", async () => {
  const socket = new WebSocket(`ws://127.0.0.1:${running.port}/anything-else`, {
    origin: "http://localhost:3000",
  });
  await expect(
    new Promise((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    }),
  ).rejects.toThrow();
});

it("tells a reader who asks too fast to wait, without dropping them", async () => {
  await running.close();
  running = await startChatServer({
    port: 0,
    host: "127.0.0.1",
    channel: channel(),
    allowedOrigins: ["http://localhost:3000"],
    askLimit: 1,
    askWindowMs: 60_000,
  });
  const client = await connect();
  client.send({ type: "attach", source });
  const ready = (await client.until("ready")) as { sourceId: string };
  for (const askId of ["ask-1", "ask-2"])
    client.send({
      type: "ask",
      askId,
      sourceId: ready.sourceId,
      question: "What is the budget?",
    });
  const refused = (await client.until("error")) as { code: string };
  expect(refused.code).toBe("RATE_LIMITED");
  client.socket.close();
});

it("serves a health check the local stack can wait on", async () => {
  const response = await fetch(`http://127.0.0.1:${running.port}/health`);
  expect(response.ok).toBe(true);
  expect(await response.json()).toMatchObject({ ok: true, service: "chat" });
});
