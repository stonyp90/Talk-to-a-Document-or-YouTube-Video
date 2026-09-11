import { describe, expect, it } from "vitest";
import { realtimeAudioConfig, resolveVoice } from "./realtimeAudio";

describe("the voice the assistant speaks with", () => {
  it("uses a built-in voice by name", () => {
    expect(resolveVoice("cedar")).toBe("cedar");
  });

  it("passes a provisioned custom voice as an identifier, which is how a cloned voice is selected", () => {
    expect(resolveVoice("voice_68b1cdef")).toEqual({ id: "voice_68b1cdef" });
  });

  it("keeps an unknown plain word out of the request rather than failing a call", () => {
    expect(resolveVoice("mon-ami")).toBeUndefined();
    expect(resolveVoice("")).toBeUndefined();
    expect(resolveVoice(undefined)).toBeUndefined();
  });
});

describe("realtime audio configuration", () => {
  it("defaults to semantic turn detection, noise reduction and a natural voice", () => {
    const audio = realtimeAudioConfig({});
    expect(audio.input.turn_detection).toEqual({
      type: "semantic_vad",
      eagerness: "auto",
      create_response: true,
      interrupt_response: true,
    });
    expect(audio.input.noise_reduction).toEqual({ type: "near_field" });
    expect(audio.input.transcription).toEqual({ model: "gpt-4o-transcribe" });
    expect(audio.output).toEqual({ voice: "marin", speed: 1 });
  });

  it("takes every setting from the environment, so a deployment can tune it", () => {
    const audio = realtimeAudioConfig({
      OPENAI_REALTIME_VOICE: "voice_abc123",
      OPENAI_REALTIME_VOICE_SPEED: "1.15",
      OPENAI_REALTIME_TURN_DETECTION: "server_vad",
      OPENAI_REALTIME_TURN_EAGERNESS: "high",
      OPENAI_REALTIME_NOISE_REDUCTION: "far_field",
      OPENAI_TRANSCRIBE_MODEL: "gpt-4o-mini-transcribe",
    });
    expect(audio.output).toEqual({
      voice: { id: "voice_abc123" },
      speed: 1.15,
    });
    expect(audio.input.turn_detection).toEqual({
      type: "server_vad",
      create_response: true,
      interrupt_response: true,
    });
    expect(audio.input.noise_reduction).toEqual({ type: "far_field" });
    expect(audio.input.transcription).toEqual({
      model: "gpt-4o-mini-transcribe",
    });
  });

  it("keeps eagerness only where it means something", () => {
    const server = realtimeAudioConfig({
      OPENAI_REALTIME_TURN_DETECTION: "server_vad",
      OPENAI_REALTIME_TURN_EAGERNESS: "low",
    });
    expect(server.input.turn_detection).not.toHaveProperty("eagerness");
  });

  it("lets a deployment turn the microphone filter off entirely", () => {
    const audio = realtimeAudioConfig({
      OPENAI_REALTIME_NOISE_REDUCTION: "off",
    });
    expect(audio.input).not.toHaveProperty("noise_reduction");
  });

  it("clamps a speed the provider would refuse and ignores a meaningless one", () => {
    expect(
      realtimeAudioConfig({ OPENAI_REALTIME_VOICE_SPEED: "4" }).output.speed,
    ).toBe(1.5);
    expect(
      realtimeAudioConfig({ OPENAI_REALTIME_VOICE_SPEED: "0.1" }).output.speed,
    ).toBe(0.25);
    expect(
      realtimeAudioConfig({ OPENAI_REALTIME_VOICE_SPEED: "fast" }).output.speed,
    ).toBe(1);
  });

  it("falls back to semantic detection when the configured mode is unknown", () => {
    expect(
      realtimeAudioConfig({ OPENAI_REALTIME_TURN_DETECTION: "magic" }).input
        .turn_detection,
    ).toMatchObject({ type: "semantic_vad" });
  });

  it("can hand the floor over manually, for a push-to-talk client", () => {
    expect(
      realtimeAudioConfig({ OPENAI_REALTIME_TURN_DETECTION: "none" }).input
        .turn_detection,
    ).toBeNull();
  });
});
