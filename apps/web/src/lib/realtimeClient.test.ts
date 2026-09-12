import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RealtimeClient } from "./realtimeClient";

class FakeChannel {
  readyState = "connecting";
  onmessage?: (event: { data: string }) => void;
  onopen?: () => void;
  onclose?: () => void;
  onerror?: () => void;
  send = vi.fn();
  close = vi.fn(() => {
    this.readyState = "closed";
    this.onclose?.();
  });
  emit(event: object) {
    this.onmessage?.({ data: JSON.stringify(event) });
  }
  open() {
    this.readyState = "open";
    this.onopen?.();
  }
}
class FakePeer {
  static instances: FakePeer[] = [];
  channel = new FakeChannel();
  connectionState = "new";
  onconnectionstatechange?: () => void;
  ontrack?: (event: { streams: unknown[] }) => void;
  addTrack = vi.fn();
  createDataChannel = vi.fn(() => this.channel);
  createOffer = vi.fn(async () => ({ type: "offer", sdp: "offer-sdp" }));
  setLocalDescription = vi.fn(async () => undefined);
  setRemoteDescription = vi.fn(async () => undefined);
  close = vi.fn(() => this.state("closed"));
  constructor() {
    FakePeer.instances.push(this);
  }
  state(state: string) {
    this.connectionState = state;
    this.onconnectionstatechange?.();
  }
}
const source = {
  kind: "pdf" as const,
  sourceName: "demo.pdf",
  text: "Hello",
  characters: 5,
};
const track = { enabled: true, stop: vi.fn() };
const stream = { getTracks: () => [track], getAudioTracks: () => [track] };
const output = {
  autoplay: false,
  srcObject: null,
  play: vi.fn(async () => undefined),
  pause: vi.fn(),
  remove: vi.fn(),
};
/** Document-level listeners the client waits on when playback is blocked. */
const gestures = new Map<string, () => void>();
const getUserMedia = vi.fn();
const request = vi.fn();
const events = vi.fn();
let client: RealtimeClient;
const peer = () => FakePeer.instances.at(-1)!;
async function connected() {
  await client.connect();
  peer().state("connected");
  peer().channel.open();
  events.mockClear();
}

beforeEach(() => {
  vi.clearAllMocks();
  FakePeer.instances = [];
  track.enabled = true;
  getUserMedia.mockResolvedValue(stream);
  request.mockResolvedValue({ ok: true, text: async () => "answer-sdp" });
  vi.stubGlobal("RTCPeerConnection", FakePeer);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  gestures.clear();
  vi.stubGlobal("document", {
    createElement: () => output,
    addEventListener: (name: string, listener: () => void) =>
      gestures.set(name, listener),
    removeEventListener: (name: string) => gestures.delete(name),
  });
  vi.stubGlobal("window", globalThis);
  vi.stubGlobal("fetch", request);
  client = new RealtimeClient(source, events, "live", "ephemeral-secret");
});
afterEach(() => {
  client.stop();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Realtime WebRTC client", () => {
  it("releases resources when the peer never finishes connecting", async () => {
    vi.useFakeTimers();
    await client.connect();
    vi.advanceTimersByTime(30000);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(events).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "error",
        error: expect.stringMatching(/timed out/i),
      }),
    );
  });
  it("does not time out an established connection", async () => {
    vi.useFakeTimers();
    await connected();
    vi.advanceTimersByTime(30000);
    expect(track.stop).not.toHaveBeenCalled();
  });
  it("posts raw SDP directly with the supplied ephemeral bearer", async () => {
    await client.connect();
    expect(request).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/calls",
      expect.objectContaining({
        method: "POST",
        body: "offer-sdp",
        headers: {
          Authorization: "Bearer ephemeral-secret",
          "Content-Type": "application/sdp",
        },
      }),
    );
    expect(peer().setRemoteDescription).toHaveBeenCalledWith({
      type: "answer",
      sdp: "answer-sdp",
    });
    expect(events).not.toHaveBeenCalledWith({ type: "connected" });
    peer().state("connected");
    peer().channel.open();
    peer().channel.emit({ type: "session.created" });
    expect(
      events.mock.calls.filter(([e]) => e.type === "connected"),
    ).toHaveLength(1);
  });
  it("requires a secret in live mode before acquiring the microphone", async () => {
    client = new RealtimeClient(source, events, "live");
    await expect(client.connect()).rejects.toThrow(/secret|token/i);
    expect(getUserMedia).not.toHaveBeenCalled();
  });
  it("creates an assistant item before GA deltas and finalizes by item id", async () => {
    await connected();
    peer().channel.emit({
      type: "response.output_audio_transcript.delta",
      item_id: "a1",
      response_id: "r1",
      delta: "Hello",
    });
    peer().channel.emit({
      type: "response.output_audio_transcript.done",
      item_id: "a1",
      transcript: "Hello!",
    });
    expect(events.mock.calls.map(([e]) => e)).toEqual([
      {
        type: "message-started",
        message: { id: "a1", role: "assistant", text: "", status: "partial" },
      },
      { type: "message-delta", id: "a1", text: "Hello" },
      { type: "message-completed", id: "a1", text: "Hello!" },
    ]);
  });
  it("handles output item creation and done without deltas without duplicate starts", async () => {
    await connected();
    peer().channel.emit({
      type: "response.output_item.added",
      item: { id: "a1", type: "message", role: "assistant" },
    });
    peer().channel.emit({
      type: "response.output_audio_transcript.done",
      item_id: "a1",
      transcript: "Answer",
    });
    expect(
      events.mock.calls.filter(([e]) => e.type === "message-started"),
    ).toHaveLength(1);
    expect(events).toHaveBeenLastCalledWith({
      type: "message-completed",
      id: "a1",
      text: "Answer",
    });
  });
  it("renders input transcription deltas and authoritative completion once", async () => {
    await connected();
    peer().channel.emit({
      type: "conversation.item.input_audio_transcription.delta",
      item_id: "u1",
      delta: "Hi",
    });
    peer().channel.emit({
      type: "conversation.item.input_audio_transcription.completed",
      item_id: "u1",
      transcript: "Hi there",
    });
    expect(events.mock.calls.map(([e]) => e.type)).toEqual([
      "message-started",
      "message-delta",
      "message-completed",
    ]);
    expect(events).toHaveBeenLastCalledWith({
      type: "message-completed",
      id: "u1",
      text: "Hi there",
    });
  });
  it("shows a typed user item with the same id sent to the API", async () => {
    await connected();
    client.sendText("Explain");
    const sent = JSON.parse(peer().channel.send.mock.calls[0][0]);
    expect(sent.item.id).toMatch(/^[a-f0-9]{32}$/);
    expect(sent.item).toMatchObject({
      id: expect.any(String),
      role: "user",
      content: [{ type: "input_text", text: "Explain" }],
    });
    expect(events).toHaveBeenCalledWith({
      type: "message-started",
      message: {
        id: sent.item.id,
        role: "user",
        text: "Explain",
        status: "complete",
      },
    });
    expect(JSON.parse(peer().channel.send.mock.calls[1][0]).type).toBe(
      "response.create",
    );
  });
  it("reports transient disconnection and recovery; releases resources on failure", async () => {
    await connected();
    peer().state("disconnected");
    peer().state("connected");
    expect(events.mock.calls.map(([e]) => e.type)).toEqual([
      "reconnecting",
      "connected",
    ]);
    peer().state("failed");
    expect(events).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "error" }),
    );
    expect(track.stop).toHaveBeenCalledOnce();
    expect(peer().close).toHaveBeenCalledOnce();
  });
  it("cleans up an unsuccessful SDP handshake without exposing provider response", async () => {
    request.mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "ephemeral-secret",
    });
    await expect(client.connect()).rejects.toThrow(/connection/i);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(peer().channel.close).toHaveBeenCalledOnce();
    expect(JSON.stringify(events.mock.calls)).not.toContain("ephemeral-secret");
  });
  it("releases a microphone that arrives after stop and never negotiates", async () => {
    let resolve!: (value: typeof stream) => void;
    getUserMedia.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const pending = client.connect();
    client.stop();
    resolve(stream);
    await pending;
    expect(track.stop).toHaveBeenCalledOnce();
    expect(request).not.toHaveBeenCalled();
    expect(events).toHaveBeenLastCalledWith({ type: "ended" });
  });
  it("starts blocked audio on the next tap instead of ending a working call", async () => {
    output.play.mockRejectedValueOnce(new Error("NotAllowedError"));
    await connected();
    peer().ontrack?.({ streams: [stream] });
    await Promise.resolve();
    expect(events).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
    gestures.get("pointerdown")?.();
    await Promise.resolve();
    expect(output.play).toHaveBeenCalledTimes(2);
    expect(events).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });
  it("explains blocked audio when no gesture ever arrives", async () => {
    vi.useFakeTimers();
    output.play.mockRejectedValueOnce(new Error("NotAllowedError"));
    await connected();
    peer().ontrack?.({ streams: [stream] });
    await vi.advanceTimersByTimeAsync(10000);
    expect(events).toHaveBeenLastCalledWith(
      expect.objectContaining({
        type: "error",
        error: expect.stringMatching(/playback was blocked/i),
        retryable: true,
      }),
    );
  });
  it("stops idempotently, detaches audio, and ignores late events", async () => {
    await connected();
    const late = peer().channel.onmessage;
    client.setMuted(true);
    expect(track.enabled).toBe(false);
    client.setMuted(false);
    expect(track.enabled).toBe(true);
    client.stop();
    client.stop();
    late?.({ data: JSON.stringify({ type: "session.created" }) });
    expect(track.stop).toHaveBeenCalledOnce();
    expect(output.pause).toHaveBeenCalledOnce();
    expect(output.srcObject).toBeNull();
    expect(events.mock.calls.map(([e]) => e.type)).toEqual(["ended"]);
  });
  it("finishes interrupted captions and ignores late deltas without sending WebSocket truncation", async () => {
    await connected();
    peer().channel.emit({
      type: "response.output_audio_transcript.delta",
      item_id: "a1",
      delta: "Partial",
    });
    peer().channel.emit({
      type: "input_audio_buffer.speech_started",
      item_id: "u1",
    });
    peer().channel.emit({
      type: "response.output_audio_transcript.delta",
      item_id: "a1",
      delta: " stale",
    });
    expect(events).toHaveBeenCalledWith({
      type: "message-completed",
      id: "a1",
    });
    // The caller taking the floor is announced so the interface can show it.
    expect(events).toHaveBeenLastCalledWith({
      type: "activity",
      activity: "listening",
    });
    // No delta may arrive after the caption is closed.
    expect(
      events.mock.calls.filter(([e]) => e.type === "message-delta"),
    ).toHaveLength(1);
    expect(peer().channel.send).not.toHaveBeenCalled();
  });
  it("handles malformed events and channel errors without leaking resources", async () => {
    await connected();
    expect(() =>
      peer().channel.onmessage?.({ data: "invalid json" }),
    ).not.toThrow();
    peer().channel.onerror?.();
    expect(track.stop).toHaveBeenCalledOnce();
    expect(events).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });
  it("cancels all scheduled mock events when stopped", async () => {
    vi.useFakeTimers();
    client = new RealtimeClient(source, events, "mock");
    await client.connect();
    client.sendText("Hi");
    client.stop();
    events.mockClear();
    vi.runAllTimers();
    expect(events).not.toHaveBeenCalled();
  });
  it("allows recovery before the deadline and fails a sustained disconnect", async () => {
    vi.useFakeTimers();
    await connected();
    peer().state("disconnected");
    vi.advanceTimersByTime(10000);
    peer().state("connected");
    vi.advanceTimersByTime(20000);
    expect(track.stop).not.toHaveBeenCalled();
    peer().state("disconnected");
    vi.advanceTimersByTime(15000);
    expect(track.stop).toHaveBeenCalledOnce();
    expect(events).toHaveBeenLastCalledWith(
      expect.objectContaining({ type: "error" }),
    );
  });
  it("aborts SDP on source reset and ignores an answer delivered after stop", async () => {
    let resolve!: (value: object) => void;
    request.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const pending = client.connect();
    await vi.waitFor(() => expect(request).toHaveBeenCalled());
    const signal = request.mock.calls[0][1].signal as AbortSignal;
    client.stop();
    expect(signal.aborted).toBe(true);
    resolve({ ok: true, text: async () => "late-sdp" });
    await pending;
    expect(peer().setRemoteDescription).not.toHaveBeenCalled();
    expect(events).toHaveBeenLastCalledWith({ type: "ended" });
  });
  it("reports microphone permission denial and permits a new attempt", async () => {
    getUserMedia.mockRejectedValueOnce(
      new DOMException("Denied", "NotAllowedError"),
    );
    await expect(client.connect()).rejects.toThrow(/permission/i);
    expect(request).not.toHaveBeenCalled();
    await connected();
    expect(peer().channel.readyState).toBe("open");
  });
  it("finishes text output and cancelled responses and handles provider errors", async () => {
    await connected();
    peer().channel.emit({
      type: "response.output_text.delta",
      item_id: "text1",
      delta: "Answer",
    });
    peer().channel.emit({
      type: "response.done",
      response: { status: "cancelled", output: [{ id: "text1" }] },
    });
    expect(events).toHaveBeenLastCalledWith({
      type: "message-completed",
      id: "text1",
    });
    peer().channel.emit({
      type: "error",
      error: { message: "ephemeral-secret" },
    });
    expect(track.stop).toHaveBeenCalledOnce();
    expect(JSON.stringify(events.mock.calls)).not.toContain("ephemeral-secret");
  });
});
