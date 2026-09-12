import { test } from "node:test";
import assert from "node:assert/strict";
import { chatSocketUrl, createChatClient } from "../src/chat";
import type {
  ChatClientEvent,
  SocketLike,
} from "../../../packages/core/src/application/chatClient";

const source = {
  kind: "pdf" as const,
  sourceName: "brief.pdf",
  text: "The budget is 42.",
  characters: 17,
};

test("a deployment names where the live discussion is", () => {
  assert.equal(
    chatSocketUrl("https://ursly.io", "wss://ws.ursly.io"),
    "wss://ws.ursly.io",
  );
  assert.equal(
    chatSocketUrl("https://ursly.io", "wss://ws.ursly.io/"),
    "wss://ws.ursly.io",
  );
});

test("development derives it from the API the simulator already reaches", () => {
  assert.equal(
    chatSocketUrl("http://localhost:3000"),
    "ws://localhost:3020/ws/chat",
  );
  // Android reaches the developer's machine on its own loopback address.
  assert.equal(
    chatSocketUrl("http://10.0.2.2:3000"),
    "ws://10.0.2.2:3020/ws/chat",
  );
});

test("a deployed API with no channel named keeps the conversation on HTTP", () => {
  assert.equal(chatSocketUrl("https://ursly.io"), undefined);
  assert.equal(chatSocketUrl("not a url"), undefined);
});

/** A socket the test owns, so no device and no network are involved. */
class FakeSocket implements SocketLike {
  static last: FakeSocket | undefined;
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.onclose?.({});
  }
  open() {
    this.readyState = 1;
    this.onopen?.({});
  }
  deliver(message: unknown) {
    this.onmessage?.({ data: JSON.stringify(message) });
  }
}

test("the phone holds one discussion open and asks by id", () => {
  const events: ChatClientEvent[] = [];
  let sourceId: string | undefined;
  const client = createChatClient({
    url: "ws://localhost:3020/ws/chat",
    reference: () => ({ sourceId, source }),
    onEvent: (event) => events.push(event),
    open: (url) => new FakeSocket(url),
    setTimer: () => 0,
    keepaliveMs: 0,
  });
  client.start();
  const socket = FakeSocket.last!;
  socket.open();
  assert.deepEqual(socket.sent, [{ type: "attach", source }]);

  socket.deliver({
    type: "ready",
    sourceId: "session-1",
    context: { usedCharacters: 17, totalCharacters: 17, truncated: false },
  });
  sourceId = "session-1";
  assert.equal(client.ready, true);

  assert.equal(client.ask("ask-1", "What is the budget?"), true);
  assert.deepEqual(socket.sent.at(-1), {
    type: "ask",
    askId: "ask-1",
    question: "What is the budget?",
    sourceId: "session-1",
  });

  socket.deliver({ type: "answer.started", askId: "ask-1", messageId: "m1" });
  socket.deliver({
    type: "answer.delta",
    askId: "ask-1",
    messageId: "m1",
    text: "The budget ",
  });
  socket.deliver({
    type: "answer.completed",
    askId: "ask-1",
    messageId: "m1",
    text: "The budget is 42.",
    sourceId: "session-1",
  });
  assert.deepEqual(
    events.map((event) => event.type),
    ["connecting", "connected", "ready", "started", "delta", "completed"],
  );
});

test("a question asked with no channel open is refused, so HTTP can answer it", () => {
  const client = createChatClient({
    url: "ws://localhost:3020/ws/chat",
    reference: () => ({ source }),
    onEvent: () => {},
    open: (url) => new FakeSocket(url),
    setTimer: () => 0,
    keepaliveMs: 0,
  });
  client.start();
  assert.equal(client.ask("ask-1", "What is the budget?"), false);
});
