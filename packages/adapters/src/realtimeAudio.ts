/**
 * Everything that decides how a realtime conversation sounds: which voice
 * answers, how quickly it speaks, how the microphone is cleaned up, and how
 * the provider decides that the caller has finished a turn. It is a pure
 * function of the environment so a deployment can tune the experience without
 * a code change, and so each setting can be proven in a test.
 */

/** Voices the provider ships. Anything else must be a provisioned voice id. */
export const BUILT_IN_VOICES = [
  "alloy",
  "ash",
  "ballad",
  "cedar",
  "coral",
  "echo",
  "marin",
  "sage",
  "shimmer",
  "verse",
] as const;

/** The two voices trained for the realtime model; the rest predate it. */
const DEFAULT_VOICE = "marin";
const DEFAULT_TRANSCRIBE_MODEL = "gpt-4o-transcribe";
const SPEED_RANGE = { minimum: 0.25, maximum: 1.5, default: 1 } as const;
const EAGERNESS = ["low", "medium", "high", "auto"] as const;
const NOISE_REDUCTION = ["near_field", "far_field"] as const;

export type CustomVoice = { id: string };
export type VoiceSelection = (typeof BUILT_IN_VOICES)[number] | CustomVoice;

type TurnDetection =
  | {
      type: "semantic_vad";
      eagerness: string;
      create_response: true;
      interrupt_response: true;
    }
  | { type: "server_vad"; create_response: true; interrupt_response: true }
  | null;

export type RealtimeAudioConfig = {
  input: {
    turn_detection: TurnDetection;
    transcription: { model: string };
    noise_reduction?: { type: string };
  };
  output: { voice?: VoiceSelection; speed: number };
};

type Environment = Record<string, string | undefined>;

/**
 * A provisioned custom voice is the only way to answer in a specific person's
 * voice: the provider mints an identifier from a consent recording and a
 * sample, and it is passed as an object rather than a name.
 */
export function resolveVoice(value?: string): VoiceSelection | undefined {
  const name = value?.trim();
  if (!name) return undefined;
  if ((BUILT_IN_VOICES as readonly string[]).includes(name))
    return name as VoiceSelection;
  return /^voice_[A-Za-z0-9_-]+$/.test(name) ? { id: name } : undefined;
}

function resolveSpeed(value?: string): number {
  const speed = Number.parseFloat(value ?? "");
  if (!Number.isFinite(speed)) return SPEED_RANGE.default;
  return Math.min(SPEED_RANGE.maximum, Math.max(SPEED_RANGE.minimum, speed));
}

/**
 * Semantic detection waits for a finished thought instead of a silent gap, so
 * a caller who pauses to think is not cut off mid-question. Both modes let the
 * caller interrupt the answer, which is what makes the exchange feel live.
 */
function resolveTurnDetection(env: Environment): TurnDetection {
  const mode = env.OPENAI_REALTIME_TURN_DETECTION?.trim();
  if (mode === "none") return null;
  const floor = { create_response: true, interrupt_response: true } as const;
  if (mode === "server_vad") return { type: "server_vad", ...floor };
  const configured = env.OPENAI_REALTIME_TURN_EAGERNESS?.trim();
  return {
    type: "semantic_vad",
    eagerness: (EAGERNESS as readonly string[]).includes(configured ?? "")
      ? (configured as string)
      : "auto",
    ...floor,
  };
}

export function realtimeAudioConfig(env: Environment): RealtimeAudioConfig {
  const filter = env.OPENAI_REALTIME_NOISE_REDUCTION?.trim();
  const noiseReduction = (NOISE_REDUCTION as readonly string[]).includes(
    filter ?? "",
  )
    ? { type: filter as string }
    : filter === "off"
      ? undefined
      : { type: NOISE_REDUCTION[0] };
  return {
    input: {
      turn_detection: resolveTurnDetection(env),
      transcription: {
        model: env.OPENAI_TRANSCRIBE_MODEL?.trim() || DEFAULT_TRANSCRIBE_MODEL,
      },
      ...(noiseReduction ? { noise_reduction: noiseReduction } : {}),
    },
    output: {
      voice: resolveVoice(env.OPENAI_REALTIME_VOICE) ?? DEFAULT_VOICE,
      speed: resolveSpeed(env.OPENAI_REALTIME_VOICE_SPEED),
    },
  };
}
