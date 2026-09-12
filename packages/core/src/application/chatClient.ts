import type { IngestedSource } from "../domain/ingestion";
import type { ChatContextUsage, ServerMessage } from "../domain/chat";

/**
 * The client half of the live discussion, for every client.
 *
 * One socket is opened for a source and held for the whole conversation: the
 * extraction crosses the network once, every later question is a short frame
 * carrying an id, and the answer arrives in fragments as the model writes it
 * rather than in one block when it has finished. A dropped connection is
 * reopened and re-attached behind the reader's back, and a question asked
 * while it is down is still answered over the request/response API, so the
 * discussion degrades rather than stops.
 *
 * The socket itself is supplied by the caller. A browser hands over a
 * `WebSocket`, a native app hands over its own, and a test hands over neither,
 * which is why none of the three appears in this file.
 */

export type ChatClientEvent =
  | { type: "ready"; sourceId: string; context: ChatContextUsage }
  | { type: "connecting" }
  | { type: "connected" }
  | { type: "reconnecting" }
  | { type: "closed" }
  | { type: "started"; askId: string; messageId: string }
  | { type: "delta"; askId: string; messageId: string; text: string }
  | {
      type: "completed";
      askId: string;
      messageId: string;
      text: string;
      sourceId: string;
    }
  | { type: "failed"; askId?: string; code: string; message: string };

/** The little of a WebSocket this client uses, so a test can stand in for one. */
export type SocketLike = {
  readyState: number;
  send(data: string): void;
  close(): void;
  onopen: ((event: unknown) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
};

export type ChatClientOptions = {
  url: string;
  /** What to attach on every (re)connection: an id, the source, or both. */
  reference: () => { sourceId?: string; source?: IngestedSource };
  onEvent: (event: ChatClientEvent) => void;
  /** How this client opens a socket: `new WebSocket(url)` in every real app. */
  open: (url: string) => SocketLike;
  /** How long to wait before reopening, doubling up to the ceiling. */
  retryDelayMs?: number;
  maxRetryDelayMs?: number;
  maxRetries?: number;
  keepaliveMs?: number;
  setTimer?: (run: () => void, ms: number) => number;
  clearTimer?: (handle: number) => void;
};

const OPEN = 1;

export class ChatClient {
  private socket: SocketLike | null = null;
  private attempts = 0;
  private retry: number | null = null;
  private keepalive: number | null = null;
  private stopped = false;
  private attached = false;
  /** Questions asked and not yet answered, so none is silently lost. */
  private readonly pending = new Map<string, string>();
  private resend = false;

  constructor(private readonly options: ChatClientOptions) {}

  get ready(): boolean {
    return this.attached && this.socket?.readyState === OPEN;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  /**
   * Sends a question, naming the conversation by id alone. The source itself
   * crossed the network when the discussion opened and does not cross it again.
   */
  ask(askId: string, question: string): boolean {
    if (!this.ready) return false;
    const sent = this.send({
      type: "ask",
      askId,
      question,
      sourceId: this.options.reference().sourceId,
    });
    if (sent) this.pending.set(askId, question);
    return sent;
  }

  close(): void {
    this.stopped = true;
    this.clearTimers();
    this.attached = false;
    this.pending.clear();
    const socket = this.socket;
    this.socket = null;
    if (socket) {
      // The reader ended the discussion; a close handler would only schedule
      // a reconnection nobody asked for.
      socket.onclose = null;
      socket.close();
    }
    this.options.onEvent({ type: "closed" });
  }

  private get timers() {
    return {
      set:
        this.options.setTimer ??
        ((run: () => void, ms: number) =>
          setTimeout(run, ms) as unknown as number),
      clear:
        this.options.clearTimer ?? ((handle: number) => clearTimeout(handle)),
    };
  }

  private clearTimers(): void {
    if (this.retry !== null) this.timers.clear(this.retry);
    if (this.keepalive !== null) this.timers.clear(this.keepalive);
    this.retry = null;
    this.keepalive = null;
  }

  private send(message: Record<string, unknown>): boolean {
    if (this.socket?.readyState !== OPEN) return false;
    try {
      this.socket.send(JSON.stringify(message));
      return true;
    } catch {
      return false;
    }
  }

  private connect(): void {
    if (this.stopped || this.socket) return;
    this.options.onEvent(
      this.attempts === 0 ? { type: "connecting" } : { type: "reconnecting" },
    );
    let socket: SocketLike;
    try {
      socket = this.options.open(this.options.url);
    } catch {
      this.scheduleRetry();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      this.attempts = 0;
      // The server knows nothing about this connection until it is told which
      // conversation it belongs to, so every open re-attaches.
      this.send({ type: "attach", ...this.options.reference() });
      this.scheduleKeepalive();
    };
    socket.onmessage = (event) => this.receive(event.data);
    socket.onerror = () => socket.close();
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.attached = false;
      this.clearTimers();
      // An answer that was still arriving is gone with the connection. Saying
      // so is kinder than a bubble that never finishes.
      for (const askId of this.pending.keys())
        this.options.onEvent({
          type: "failed",
          askId,
          code: "DISCONNECTED",
          message: "That answer was interrupted. Ask again.",
        });
      this.pending.clear();
      if (this.stopped) return void this.options.onEvent({ type: "closed" });
      this.scheduleRetry();
    };
  }

  private scheduleKeepalive(): void {
    const every = this.options.keepaliveMs ?? 240_000;
    if (!every) return;
    this.keepalive = this.timers.set(() => {
      if (this.send({ type: "ping" })) this.scheduleKeepalive();
    }, every);
  }

  private scheduleRetry(): void {
    const base = this.options.retryDelayMs ?? 1000;
    const ceiling = this.options.maxRetryDelayMs ?? 15_000;
    const limit = this.options.maxRetries ?? Infinity;
    if (this.attempts >= limit)
      return void this.options.onEvent({ type: "closed" });
    const delay = Math.min(base * 2 ** this.attempts, ceiling);
    this.attempts += 1;
    this.retry = this.timers.set(() => {
      this.retry = null;
      this.connect();
    }, delay);
  }

  private receive(data: unknown): void {
    let message: ServerMessage;
    try {
      message = JSON.parse(String(data)) as ServerMessage;
    } catch {
      return;
    }
    switch (message.type) {
      case "ready": {
        this.attached = true;
        this.options.onEvent({ type: "connected" });
        this.options.onEvent({
          type: "ready",
          sourceId: message.sourceId,
          context: message.context,
        });
        // The caller has just learned the new id; the questions that were
        // refused for want of it can be asked again against it.
        if (this.resend) {
          this.resend = false;
          const waiting = [...this.pending];
          this.pending.clear();
          for (const [askId, question] of waiting) this.ask(askId, question);
        }
        return;
      }
      case "answer.started":
        return this.options.onEvent({
          type: "started",
          askId: message.askId,
          messageId: message.messageId,
        });
      case "answer.delta":
        return this.options.onEvent({
          type: "delta",
          askId: message.askId,
          messageId: message.messageId,
          text: message.text,
        });
      case "answer.completed":
        this.pending.delete(message.askId);
        return this.options.onEvent({
          type: "completed",
          askId: message.askId,
          messageId: message.messageId,
          text: message.text,
          sourceId: message.sourceId,
        });
      case "error":
        // A source the server has forgotten is recoverable rather than fatal:
        // attach again with the whole extraction and ask the same question.
        if (message.code === "SOURCE_EXPIRED" && message.askId) {
          this.resend = true;
          this.send({ type: "attach", ...this.options.reference() });
          return;
        }
        if (message.askId) this.pending.delete(message.askId);
        return this.options.onEvent({
          type: "failed",
          askId: message.askId,
          code: message.code,
          message: message.message,
        });
      case "pong":
        return;
    }
  }
}
