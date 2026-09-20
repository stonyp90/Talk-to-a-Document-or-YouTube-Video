/**
 * What a caller can change about the assistant by simply asking for it. The
 * model hears the request in whatever words the caller uses and answers with
 * one of these calls; nothing here listens for a keyword.
 */

/** The speeds a realtime voice can be played at without being refused. */
export const VOICE_SPEED_RANGE = {
  minimum: 0.25,
  maximum: 1.5,
  default: 1,
} as const;

export const DEFAULT_ASSISTANT_NAME = "Sense to Action";
export const MAX_ASSISTANT_NAME_CHARACTERS = 30;

/** What the caller already chose before the voice session starts. */
export type VoicePreferences = { speed?: number; assistantName?: string };

/** What the caller seems to feel, so the interface can show it was noticed. */
export const CALLER_MOODS = [
  "calm",
  "joyful",
  "curious",
  "hesitant",
  "frustrated",
  "angry",
  "urgent",
] as const;
export type CallerMood = (typeof CALLER_MOODS)[number];

export type VoiceControlAction =
  | { kind: "voice-output"; enabled: boolean }
  | { kind: "voice-speed"; speed: number }
  | { kind: "assistant-name"; name: string }
  | { kind: "mood"; mood: CallerMood };

export type VoiceControlTool = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, Record<string, unknown>>;
    required: string[];
    additionalProperties: false;
  };
};

export const VOICE_CONTROL_TOOLS: readonly VoiceControlTool[] = [
  {
    name: "set_voice_output",
    description:
      "Turn the spoken voice off or back on. Call with enabled=false the moment the caller wants you to stop talking, be quiet, answer in writing, or just give them the text, however they phrase it and in any language. Call with enabled=true when they want to hear you again.",
    parameters: {
      type: "object",
      properties: { enabled: { type: "boolean" } },
      required: ["enabled"],
      additionalProperties: false,
    },
  },
  {
    name: "set_voice_speed",
    description: `Change how fast you speak. 1 is the normal pace; the allowed range is ${VOICE_SPEED_RANGE.minimum} to ${VOICE_SPEED_RANGE.maximum}. When the caller asks for more than the maximum, use the maximum.`,
    parameters: {
      type: "object",
      properties: {
        speed: {
          type: "number",
          minimum: VOICE_SPEED_RANGE.minimum,
          maximum: VOICE_SPEED_RANGE.maximum,
        },
      },
      required: ["speed"],
      additionalProperties: false,
    },
  },
  {
    name: "set_assistant_name",
    description:
      "Rename yourself when the caller gives you a name or asks to call you something else.",
    parameters: {
      type: "object",
      properties: {
        name: { type: "string", maxLength: MAX_ASSISTANT_NAME_CHARACTERS },
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  {
    name: "express_mood",
    description:
      "Show on screen the mood you hear in the caller: their words, their tone, their pace. Call it only when that mood clearly changes, never on every turn.",
    parameters: {
      type: "object",
      properties: { mood: { type: "string", enum: [...CALLER_MOODS] } },
      required: ["mood"],
      additionalProperties: false,
    },
  },
];

/**
 * A name is spoken back to the caller and placed in the instructions, so it is
 * reduced to what a name can be: letters, digits, spaces, hyphens, apostrophes.
 */
export function sanitizeAssistantName(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const name = value
    .replace(/[^\p{L}\p{N}\s'-]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_ASSISTANT_NAME_CHARACTERS)
    .trim();
  return name || undefined;
}

export function clampVoiceSpeed(speed: number): number {
  return Math.min(
    VOICE_SPEED_RANGE.maximum,
    Math.max(VOICE_SPEED_RANGE.minimum, speed),
  );
}

/** The part of the spoken prompt that gives the assistant a name and its controls. */
export function voiceControlGuidance(assistantName?: string): string[] {
  const name = sanitizeAssistantName(assistantName) ?? DEFAULT_ASSISTANT_NAME;
  return [
    `Your name is ${name}. When the caller asks who they are talking to, answer with that name in one short sentence.`,
    "The caller controls you by talking. Judge what they mean, whatever words or language they use, and act at the moment they mean it; do not wait for a particular keyword.",
    "When they want you to stop speaking, be quiet, write instead of talk, or hand them the text, call set_voice_output with enabled=false at once. Never answer such a request by talking, and never read aloud something they asked to receive in writing. Call it with enabled=true when they want your voice back.",
    "When they want you faster or slower, call set_voice_speed, then carry on at the new pace without commenting on it. When they give you a name, call set_assistant_name.",
    "Mirror how the caller talks. Recognise regional speech and slang for what it is, Quebec joual, rural or redneck English, street talk, swearing used as punctuation, and answer in the same register without mocking it, correcting it or asking them to rephrase. When they switch language mid-conversation, switch with them and keep the same personality.",
    "Match your tone to theirs: brisk when they are in a hurry, steady and brief when they are irritated, warm when they are pleased. When they are angry at you, do not apologise at length; fix the thing. When their mood clearly changes, call express_mood so the screen shows it.",
    "While your voice is off your answers are read, not heard: you may write fuller sentences, and still no markdown headings.",
  ];
}

/** Turns a tool call from the model into an action, or nothing if it is not one of ours. */
export function parseVoiceControl(
  tool: string,
  rawArguments: string,
): VoiceControlAction | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawArguments);
  } catch {
    return undefined;
  }
  if (!parsed || typeof parsed !== "object") return undefined;
  const args = parsed as Record<string, unknown>;
  if (tool === "set_voice_output" && typeof args.enabled === "boolean")
    return { kind: "voice-output", enabled: args.enabled };
  if (
    tool === "set_voice_speed" &&
    typeof args.speed === "number" &&
    Number.isFinite(args.speed)
  )
    return { kind: "voice-speed", speed: clampVoiceSpeed(args.speed) };
  if (
    tool === "express_mood" &&
    (CALLER_MOODS as readonly unknown[]).includes(args.mood)
  )
    return { kind: "mood", mood: args.mood as CallerMood };
  if (tool === "set_assistant_name") {
    const name = sanitizeAssistantName(args.name);
    if (name) return { kind: "assistant-name", name };
  }
  return undefined;
}
