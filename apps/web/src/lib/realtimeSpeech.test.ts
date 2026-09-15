import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { createRealtimeSpeechListener } from "./realtimeSpeech";

class Peer {
  static instances: Peer[] = [];
  connectionState = "connected";
  channel = {
    onopen: null as null | (() => void),
    onmessage: null as null | ((event: { data: string }) => void),
    onclose: null as null | (() => void),
    onerror: null as null | (() => void),
  };
  onconnectionstatechange: null | (() => void) = null;
  constructor() {
    Peer.instances.push(this);
  }
  addTrack() {}
  createDataChannel() {
    return this.channel;
  }
  async createOffer() {
    return { sdp: "offer" };
  }
  async setLocalDescription() {}
  async setRemoteDescription() {
    this.channel.onopen?.();
  }
  close() {
    this.connectionState = "closed";
    this.onconnectionstatechange?.();
  }
  emit(data: unknown) {
    this.channel.onmessage?.({ data: JSON.stringify(data) });
  }
}
const track = { stop: vi.fn() };
beforeEach(() => {
  Peer.instances = [];
  track.stop.mockClear();
  vi.stubGlobal("RTCPeerConnection", Peer);
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track] }),
    },
  });
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          clientSecret: "temporary",
          expiresAt: Date.now() + 60000,
        }),
      )
      .mockResolvedValueOnce(new Response("answer")),
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it("delivers final commands once, in audio order even when completion arrives out of order", async () => {
  const onPhrase = vi.fn();
  const onListeningChange = vi.fn();
  const listener = createRealtimeSpeechListener({
    language: "en-US",
    onPhrase,
    onListeningChange,
  });
  listener.start();
  await vi.waitFor(() => expect(onListeningChange).toHaveBeenCalledWith(true));
  const peer = Peer.instances[0];
  peer.emit({ type: "input_audio_buffer.committed", item_id: "one" });
  peer.emit({ type: "input_audio_buffer.committed", item_id: "two" });
  peer.emit({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "two",
    transcript: "next",
  });
  expect(onPhrase).not.toHaveBeenCalled();
  peer.emit({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "one",
    transcript: "upload",
  });
  peer.emit({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "one",
    transcript: "upload",
  });
  expect(onPhrase.mock.calls.map((call) => call[0])).toEqual([
    { text: "upload", final: true },
    { text: "next", final: true },
  ]);
  listener.stop();
  peer.emit({
    type: "conversation.item.input_audio_transcription.completed",
    item_id: "three",
    transcript: "cancel",
  });
  expect(onPhrase).toHaveBeenCalledTimes(2);
  expect(track.stop).toHaveBeenCalledOnce();
});
it("releases a microphone granted after Stop without issuing a credential", async () => {
  let grant!: (value: unknown) => void;
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: () =>
        new Promise((resolve) => {
          grant = resolve;
        }),
    },
  });
  const listener = createRealtimeSpeechListener({
    language: "en",
    onPhrase: vi.fn(),
  });
  listener.start();
  listener.stop();
  grant({ getTracks: () => [track] });
  await vi.waitFor(() => expect(track.stop).toHaveBeenCalled());
  expect(fetch).not.toHaveBeenCalled();
});
it("reports microphone denial and closes a stalled connection at its deadline", async () => {
  const onError = vi.fn();
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getUserMedia: vi
        .fn()
        .mockRejectedValue(new DOMException("Denied", "NotAllowedError")),
    },
  });
  const listener = createRealtimeSpeechListener({
    language: "en",
    onPhrase: vi.fn(),
    onError,
  });
  listener.start();
  await vi.waitFor(() => expect(onError).toHaveBeenCalledWith("denied"));
  expect(listener.listening()).toBe(false);
  vi.useFakeTimers();
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: () => new Promise(() => {}) },
  });
  listener.start();
  await vi.advanceTimersByTimeAsync(20001);
  expect(onError).toHaveBeenCalledWith("failed");
  expect(listener.listening()).toBe(false);
});
