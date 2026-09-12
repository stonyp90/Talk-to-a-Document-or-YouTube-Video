import { describe, expect, it } from "vitest";
import {
  MINIMUM_SAMPLE_SECONDS,
  PRESET_VOICE,
  canApprove,
  decideVoiceConsent,
  isDecisionPending,
  keepsRecording,
  microphoneIsOpen,
  voiceSource,
} from "./voiceConsent";

const listening = (seconds: number) =>
  decideVoiceConsent(decideVoiceConsent(PRESET_VOICE, { type: "lend" }), {
    type: "recorded",
    seconds,
  });

const kept = (seconds = 12) =>
  decideVoiceConsent(listening(seconds), {
    type: "approve",
    sampleId: "sample-1",
  });

/**
 * These are the rules a microphone is not allowed to have an opinion about.
 * Recording a person is the one thing Ursly does that cannot be undone by
 * apologising afterwards, so the order of consent, capture and retention is
 * settled here, in a file that has never seen an audio buffer.
 */
describe("lending a voice", () => {
  it("answers in the preset voice until someone decides otherwise", () => {
    expect(voiceSource(PRESET_VOICE)).toBe("preset");
    expect(microphoneIsOpen(PRESET_VOICE)).toBe(false);
    expect(keepsRecording(PRESET_VOICE)).toBe(false);
  });

  it("opens the microphone only on an explicit opt-in", () => {
    expect(microphoneIsOpen(PRESET_VOICE)).toBe(false);
    const after = decideVoiceConsent(PRESET_VOICE, { type: "lend" });
    expect(microphoneIsOpen(after)).toBe(true);
    expect(isDecisionPending(after)).toBe(true);
  });

  it("refuses to enrol a voice because of something said out loud", () => {
    for (const phrase of [
      "learn my voice",
      "lend my voice",
      "I consent to you using my voice",
    ]) {
      const after = decideVoiceConsent(PRESET_VOICE, { type: "spoken", phrase });
      expect(after).toEqual(PRESET_VOICE);
      expect(microphoneIsOpen(after)).toBe(false);
    }
  });

  it("leaves a pending decision pending, however long it is left", () => {
    const waited = listening(600);
    expect(isDecisionPending(waited)).toBe(true);
    expect(keepsRecording(waited)).toBe(false);
    expect(voiceSource(waited)).toBe("preset");
  });

  it("keeps the recording only once the speaker approves it", () => {
    const before = listening(12);
    expect(keepsRecording(before)).toBe(false);
    const after = kept();
    expect(keepsRecording(after)).toBe(true);
    expect(voiceSource(after)).toBe("lent");
    expect(isDecisionPending(after)).toBe(false);
    expect(microphoneIsOpen(after)).toBe(false);
  });

  it("holds nothing back when the speaker declines", () => {
    const after = decideVoiceConsent(listening(12), { type: "decline" });
    expect(keepsRecording(after)).toBe(false);
    expect(microphoneIsOpen(after)).toBe(false);
    expect(after.stage).toBe("preset");
    expect(after.stage === "preset" && after.lastOutcome).toBe("discarded");
  });

  it("will not approve a sample the provider would reject as too short", () => {
    expect(canApprove(listening(MINIMUM_SAMPLE_SECONDS - 1))).toBe(false);
    expect(canApprove(listening(MINIMUM_SAMPLE_SECONDS))).toBe(true);
    const refused = decideVoiceConsent(listening(2), {
      type: "approve",
      sampleId: "sample-1",
    });
    expect(keepsRecording(refused)).toBe(false);
    expect(isDecisionPending(refused)).toBe(true);
  });

  it("forgets a kept sample in a single step", () => {
    const after = decideVoiceConsent(kept(), { type: "forget" });
    expect(keepsRecording(after)).toBe(false);
    expect(voiceSource(after)).toBe("preset");
    expect(after.stage === "preset" && after.lastOutcome).toBe("deleted");
  });

  it("ignores approval and deletion that no recording is waiting on", () => {
    expect(
      decideVoiceConsent(PRESET_VOICE, { type: "approve", sampleId: "x" }),
    ).toEqual(PRESET_VOICE);
    expect(decideVoiceConsent(PRESET_VOICE, { type: "forget" })).toEqual(
      PRESET_VOICE,
    );
    expect(decideVoiceConsent(PRESET_VOICE, { type: "decline" })).toEqual(
      PRESET_VOICE,
    );
  });

  it("starts a fresh recording when a lent voice is replaced", () => {
    const again = decideVoiceConsent(kept(), { type: "lend" });
    expect(microphoneIsOpen(again)).toBe(true);
    expect(keepsRecording(again)).toBe(false);
    expect(again.stage === "listening" && again.seconds).toBe(0);
  });

  it("reports the captured length so the interface can count it out loud", () => {
    const fresh = listening(0);
    expect(fresh.stage === "listening" && fresh.seconds).toBe(0);
    const grown = decideVoiceConsent(listening(3), {
      type: "recorded",
      seconds: 9,
    });
    expect(grown.stage === "listening" && grown.seconds).toBe(9);
    const sample = kept(9);
    expect(sample.stage === "kept" && sample.seconds).toBe(9);
    expect(sample.stage === "kept" && sample.sampleId).toBe("sample-1");
  });
});
