import assert from "node:assert/strict";
import {
  PRESET_VOICE,
  decideVoiceConsent,
  isDecisionPending,
  keepsRecording,
  microphoneIsOpen,
  voiceSource,
  type VoiceConsent,
} from "../../packages/core/src/domain/voiceConsent";
import type { Step, World } from "./steps";

/**
 * Consent is checked where it is decided. The rules below never touch a
 * microphone, which is the point: if a recording could only be kept because a
 * component happened to be mounted, the guarantee would be a coincidence.
 */
export function registerVoiceConsentChecks(step: Step) {
  const states = new WeakMap<World, VoiceConsent>();

  const consent = (self: World): VoiceConsent =>
    states.get(self) ?? PRESET_VOICE;
  const apply = (
    self: World,
    ...events: Parameters<typeof decideVoiceConsent>[1][]
  ) => {
    states.set(self, events.reduce(decideVoiceConsent, consent(self)));
  };

  step("a person who has never lent their voice", function () {
    states.set(this, PRESET_VOICE);
  });

  step("a person who is recording a sample", function () {
    apply(this, { type: "lend" });
  });

  step("a person who has approved a recording", function () {
    apply(
      this,
      { type: "lend" },
      { type: "recorded", seconds: 12 },
      { type: "approve", sampleId: "lent-voice" },
    );
  });

  step('they say "learn my voice" out loud', function () {
    apply(this, { type: "spoken", phrase: "learn my voice" });
  });

  step("they choose to lend their voice", function () {
    apply(this, { type: "lend" });
  });

  for (const seconds of [2, 12, 600])
    step(`they have spoken for ${seconds} seconds`, function () {
      apply(this, { type: "recorded", seconds });
    });

  step("they approve the recording", function () {
    apply(this, { type: "approve", sampleId: "lent-voice" });
  });

  step("they decline the recording", function () {
    apply(this, { type: "decline" });
  });

  step("they delete their voice sample", function () {
    apply(this, { type: "forget" });
  });

  step("Ursly answers in its preset voice", function () {
    assert.equal(voiceSource(consent(this)), "preset");
  });

  step("Ursly can answer in the voice they lent", function () {
    assert.equal(voiceSource(consent(this)), "lent");
  });

  step("the microphone is closed", function () {
    assert.equal(microphoneIsOpen(consent(this)), false);
  });

  step("the microphone is recording", function () {
    assert.equal(microphoneIsOpen(consent(this)), true);
  });

  step("no recording of their voice is kept", function () {
    assert.equal(keepsRecording(consent(this)), false);
  });

  step("the recording is kept", function () {
    assert.equal(keepsRecording(consent(this)), true);
  });

  step("they are asked to approve or decline the recording", function () {
    assert.equal(isDecisionPending(consent(this)), true);
  });

  step("the interface says the recording was discarded", function () {
    const state = consent(this);
    assert.equal(state.stage, "preset");
    assert.equal(state.stage === "preset" && state.lastOutcome, "discarded");
  });
}
