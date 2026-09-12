/**
 * Lending a voice is the only thing Ursly does that records a person on
 * purpose, and a recording is not the kind of mistake an apology undoes. So
 * the order of events is settled here rather than in a component: the
 * microphone opens after the person asks for it in the interface and never
 * before, the sample it makes is thrown away unless they say to keep it, and a
 * kept sample can be forgotten in one step.
 *
 * Nothing spoken out loud moves any of this along. A phrase is a command to
 * the assistant, never a signature, and the interface it is spoken into cannot
 * tell a decision from a quotation.
 */

/** The floor the voice provider accepts before a sample is worth keeping. */
export const MINIMUM_SAMPLE_SECONDS = 5;

/** Whose voice an answer is spoken in: Ursly's own, or one it was lent. */
export type VoiceSource = "preset" | "lent";

export type VoiceConsent =
  | {
      stage: "preset";
      /** Why there is no sample, when the interface needs to say so. */
      lastOutcome?: "discarded" | "deleted";
    }
  | { stage: "listening"; seconds: number }
  | { stage: "kept"; sampleId: string; seconds: number };

/** Where everyone starts, and where declining and deleting both lead back to. */
export const PRESET_VOICE: VoiceConsent = { stage: "preset" };

export type VoiceConsentEvent =
  /** The person pressed the control that asks Ursly to learn their voice. */
  | { type: "lend" }
  /** How much speech the microphone has captured so far. */
  | { type: "recorded"; seconds: number }
  | { type: "approve"; sampleId: string }
  | { type: "decline" }
  | { type: "forget" }
  /** Something the person said out loud, offered here only to be refused. */
  | { type: "spoken"; phrase: string };

export function decideVoiceConsent(
  state: VoiceConsent,
  event: VoiceConsentEvent,
): VoiceConsent {
  switch (event.type) {
    case "lend":
      // Pressing it again while it is already listening would throw away the
      // speech captured so far, which is not what a second press means.
      return state.stage === "listening"
        ? state
        : { stage: "listening", seconds: 0 };
    case "recorded":
      return state.stage === "listening"
        ? { stage: "listening", seconds: event.seconds }
        : state;
    case "approve":
      // A sample the provider would refuse is worse than none: it reads as a
      // kept voice that never works. The decision stays open instead.
      return canApprove(state) && state.stage === "listening"
        ? {
            stage: "kept",
            sampleId: event.sampleId,
            seconds: state.seconds,
          }
        : state;
    case "decline":
      return state.stage === "listening"
        ? { stage: "preset", lastOutcome: "discarded" }
        : state;
    case "forget":
      return state.stage === "kept"
        ? { stage: "preset", lastOutcome: "deleted" }
        : state;
    case "spoken":
      return state;
  }
}

export function voiceSource(state: VoiceConsent): VoiceSource {
  return state.stage === "kept" ? "lent" : "preset";
}

/** The one question asked before any audio is held on to. */
export function keepsRecording(state: VoiceConsent): boolean {
  return state.stage === "kept";
}

/**
 * True for exactly as long as the toast must stay on screen. Time alone never
 * makes this false: a decision left unmade is still a decision to be made.
 */
export function isDecisionPending(state: VoiceConsent): boolean {
  return state.stage === "listening";
}

export function microphoneIsOpen(state: VoiceConsent): boolean {
  return state.stage === "listening";
}

export function canApprove(state: VoiceConsent): boolean {
  return state.stage === "listening" && state.seconds >= MINIMUM_SAMPLE_SECONDS;
}
