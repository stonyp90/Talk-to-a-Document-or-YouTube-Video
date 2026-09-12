import { beforeEach, describe, expect, it } from "vitest";
import {
  ChatClient,
  type ChatClientEvent,
  type SocketLike,
} from "./chatClient";
import type { IngestedSource } from "../domain/ingestion";

const source: IngestedSource = {
  kind: "pdf",
  sourceName: "brief.pdf",
  text: "The budget is 42.",
  characters: 17,
};

/** A socket under the test's control, recording everything written to it. */
class FakeSocket implements SocketLike {
  static opened: FakeSocket[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  onopen: ((event: unknown) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;

  constructor(readonly url: string) {
    FakeSocket.opened.push(this);
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

describe("the client half of a live discussion", () => {
  let events: ChatClientEvent[];
  let timers: Array<() => void>;
  let sourceId: string | undefined;

  const client = (over: { maxRetries?: number } = {}) =>
    new ChatClient({
      url: "ws://localhost:3020/ws/chat",
      reference: () => ({ sourceId, source }),
      onEvent: (event) => events.push(event),
      open: (url) => new FakeSocket(url),
      setTimer: (run) => timers.push(run),
      keepaliveMs: 0,
      ...over,
    });

  const latest = () => FakeSocket.opened.at(-1)!;
  const ready = (id = "session-1") =>
    latest().deliver({
      type: "ready",
      sourceId: id,
      context: { usedCharacters: 17, totalCharacters: 17, truncated: false },
    });

  beforeEach(() => {
    events = [];
    timers = [];
    sourceId = undefined;
    FakeSocket.opened = [];
  });

  it("names the conversation as soon as the socket opens", () => {
    client().start();
    latest().open();
    expect(latest().sent).toEqual([{ type: "attach", source }]);
    expect(events).toEqual([{ type: "connecting" }]);
  });

  it("is only ready once the server has confirmed the conversation", () => {
    const socket = client();
    socket.start();
    latest().open();
    expect(socket.ready).toBe(false);
    ready();
    expect(socket.ready).toBe(true);
    expect(events.map((event) => event.type)).toEqual([
      "connecting",
      "connected",
      "ready",
    ]);
  });

  it("sends a question as an id and a question, never the source again", () => {
    const socket = client();
    socket.start();
    latest().open();
    ready();
    sourceId = "session-1";
    expect(socket.ask("ask-1", "What is the budget?")).toBe(true);
    expect(latest().sent.at(-1)).toEqual({
      type: "ask",
      askId: "ask-1",
      question: "What is the budget?",
      sourceId: "session-1",
    });
  });

  it("reports an answer as it forms and again when it is whole", () => {
    const socket = client();
    socket.start();
    latest().open();
    ready();
    socket.ask("ask-1", "What is the budget?");
    events = [];
    latest().deliver({
      type: "answer.started",
      askId: "ask-1",
      messageId: "m1",
    });
    latest().deliver({
      type: "answer.delta",
      askId: "ask-1",
      messageId: "m1",
      text: "The ",
    });
    latest().deliver({
      type: "answer.completed",
      askId: "ask-1",
      messageId: "m1",
      text: "The budget is 42.",
      sourceId: "session-1",
    });
    expect(events.map((event) => event.type)).toEqual([
      "started",
      "delta",
      "completed",
    ]);
  });

  it("refuses to send a question before the conversation is open", () => {
    const socket = client();
    socket.start();
    expect(socket.ask("ask-1", "What is the budget?")).toBe(false);
  });

  it("reopens a dropped connection and names the conversation again", () => {
    const socket = client();
    socket.start();
    latest().open();
    ready();
    sourceId = "session-1";
    latest().close();
    expect(timers).toHaveLength(1);
    timers[0]();
    expect(events.at(-1)).toEqual({ type: "reconnecting" });
    latest().open();
    expect(latest().sent).toEqual([
      { type: "attach", sourceId: "session-1", source },
    ]);
    expect(socket.ready).toBe(false);
    ready();
    expect(socket.ready).toBe(true);
  });

  it("says so when an answer is lost with the connection", () => {
    const socket = client();
    socket.start();
    latest().open();
    ready();
    socket.ask("ask-1", "What is the budget?");
    events = [];
    latest().close();
    expect(events[0]).toEqual({
      type: "failed",
      askId: "ask-1",
      code: "DISCONNECTED",
      message: expect.stringContaining("interrupted"),
    });
  });

  it("attaches again and re-asks when the server has forgotten the source", () => {
    const socket = client();
    socket.start();
    latest().open();
    ready();
    sourceId = "session-1";
    socket.ask("ask-1", "What is the budget?");
    events = [];
    latest().deliver({
      type: "error",
      askId: "ask-1",
      code: "SOURCE_EXPIRED",
      message: "Send it again.",
    });
    expect(latest().sent.at(-1)).toEqual({
      type: "attach",
      sourceId: "session-1",
      source,
    });
    expect(events.some((event) => event.type === "failed")).toBe(false);
    sourceId = "session-2";
    ready("session-2");
    expect(latest().sent.at(-1)).toEqual({
      type: "ask",
      askId: "ask-1",
      question: "What is the budget?",
      sourceId: "session-2",
    });
  });

  it("passes on a failure the reader has to act on", () => {
    const socket = client();
    socket.start();
    latest().open();
    ready();
    socket.ask("ask-1", "What is the budget?");
    events = [];
    latest().deliver({
      type: "error",
      askId: "ask-1",
      code: "RATE_LIMITED",
      message: "Wait a moment.",
    });
    expect(events).toEqual([
      {
        type: "failed",
        askId: "ask-1",
        code: "RATE_LIMITED",
        message: "Wait a moment.",
      },
    ]);
  });

  it("stops trying once the reader has closed the discussion", () => {
    const socket = client();
    socket.start();
    latest().open();
    ready();
    socket.close();
    expect(events.at(-1)).toEqual({ type: "closed" });
    expect(timers).toHaveLength(0);
  });

  it("gives up after the configured number of attempts", () => {
    const socket = client({ maxRetries: 1 });
    socket.start();
    latest().close();
    timers[0]();
    latest().close();
    expect(events.at(-1)).toEqual({ type: "closed" });
  });
});
