import type { Language } from "@/apps/web/app/i18n/languages";

/**
 * Turning speech into an action. Recognition returns whatever it thinks it
 * heard: a different case, no accents, a swallowed syllable, a whole sentence
 * around the command. Matching therefore compares meaning-preserving forms and
 * accepts a small spelling slip on a phrase long enough for that to be safe.
 */

export const VOICE_ACTION_IDS = [
  "youtube",
  "upload",
  "voice",
  "summarize",
  "back",
  "next",
  "cancel",
] as const;
export type VoiceActionId = (typeof VOICE_ACTION_IDS)[number];

export type VoiceTrigger = {
  id: string;
  phrase: string;
  action: VoiceActionId;
  /** Other wordings that mean the same thing, including the other language. */
  aliases?: string[];
};

/** English labels and replies double as translation keys. */
const LABELS: Record<VoiceActionId, string> = {
  youtube: "Open the YouTube source tab",
  upload: "Open the PDF upload picker",
  voice: "Start voice chat",
  summarize: "Ask for a key-ideas summary",
  back: "Go back or undo the last step",
  next: "Go forward to the next step",
  cancel: "Cancel the current action",
};

const REPLIES: Record<VoiceActionId, string> = {
  youtube: "Opening the YouTube source tab.",
  upload: "Opening the PDF upload picker.",
  voice: "Starting voice chat.",
  summarize: "Preparing a key-ideas summary.",
  back: "Going back and undoing the last step.",
  next: "Moving forward to the next step.",
  cancel: "Cancelling the current action.",
};

/** What the interface tells the caller the action does, in one short phrase. */
const HINTS: Record<VoiceActionId, string> = {
  youtube: "switch to YouTube",
  upload: "open the PDF picker",
  voice: "try a voice action",
  summarize: "ask for a summary",
  back: "undo the last step",
  next: "continue forward",
  cancel: "stop the current action",
};

/**
 * The first wording of each action is the one the interface offers; the rest
 * are accepted silently, because a caller rarely says the suggested words
 * exactly and should never be punished for it.
 */
const PHRASES: Record<Language, Record<VoiceActionId, readonly string[]>> = {
  en: {
    youtube: ["YouTube", "you tube", "youtube link", "use a video"],
    upload: ["Upload", "upload a pdf", "open the pdf", "choose a file", "pdf"],
    voice: [
      "Let’s talk",
      "lets talk",
      "talk to it",
      "start voice",
      "voice chat",
    ],
    summarize: ["Summarize this", "summarize", "summary", "key ideas"],
    back: ["back", "go back", "undo"],
    next: ["next", "continue", "go on"],
    cancel: ["cancel", "stop", "never mind"],
  },
  fr: {
    youtube: ["YouTube", "lien youtube", "une vidéo"],
    upload: [
      "Téléverse",
      "téléverser",
      "télécharge",
      "ouvre le pdf",
      "choisis un fichier",
      "pdf",
    ],
    voice: ["Parlons-en", "parlons", "on se parle", "discussion vocale"],
    summarize: ["Résume ceci", "résume", "résumé", "idées clés"],
    back: ["retour", "reviens", "recule"],
    next: ["suivant", "continue", "prochaine étape"],
    cancel: ["annule", "annuler", "arrête", "laisse tomber"],
  },
};

/** The actions offered as default triggers, in the order they are listed. */
const DEFAULT_ACTIONS: readonly VoiceActionId[] = ["back", "next", "cancel"];

/** The actions shown as examples the caller can say straight away. */
export const EXAMPLE_ACTIONS: readonly VoiceActionId[] = [
  "youtube",
  "upload",
  "voice",
  "summarize",
  "back",
  "next",
  "cancel",
];

/** A phrase long enough that one wrong letter cannot be a different word. */
const FUZZY_FROM_LENGTH = 6;
const VERY_FORGIVING_FROM_LENGTH = 12;

export function actionLabel(action: VoiceActionId): string {
  return LABELS[action];
}
export function actionReply(action: VoiceActionId): string {
  return REPLIES[action];
}
export function actionHint(action: VoiceActionId): string {
  return HINTS[action];
}

/**
 * Case, accents and punctuation all vary between engines and between callers,
 * and none of them change which command was meant.
 */
export function normalizeSpoken(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Mark}+/gu, "")
    .toLocaleLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function otherLanguage(language: Language): Language {
  return language === "fr" ? "en" : "fr";
}

export type SpokenExample = {
  action: VoiceActionId;
  phrase: string;
  hint: string;
  aliases: string[];
};

/** Every action with the wording to offer in this language and what else counts. */
export function spokenExamples(language: Language): SpokenExample[] {
  return EXAMPLE_ACTIONS.map((action) => {
    const [phrase, ...extras] = PHRASES[language][action];
    return {
      action,
      phrase,
      hint: HINTS[action],
      aliases: [...extras, ...PHRASES[otherLanguage(language)][action]],
    };
  });
}

/**
 * The triggers a first-time caller starts with. They are in the interface
 * language, and they still answer the other language, because a bilingual
 * caller switches language mid-sentence without thinking about it.
 */
export function defaultTriggers(language: Language): VoiceTrigger[] {
  return DEFAULT_ACTIONS.map((action) => {
    const [phrase, ...extras] = PHRASES[language][action];
    return {
      id: `default-${action}`,
      phrase,
      action,
      aliases: [...extras, ...PHRASES[otherLanguage(language)][action]],
    };
  });
}

function distanceWithin(left: string, right: string, limit: number): boolean {
  if (Math.abs(left.length - right.length) > limit) return false;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1)
      current[column] = Math.min(
        previous[column] + 1,
        current[column - 1] + 1,
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1),
      );
    previous = current;
    if (Math.min(...current) > limit) return false;
  }
  return previous[right.length] <= limit;
}

function slipsAllowed(candidate: string): number {
  if (candidate.length >= VERY_FORGIVING_FROM_LENGTH) return 2;
  return candidate.length >= FUZZY_FROM_LENGTH ? 1 : 0;
}

type Word = { text: string; at: number };

function words(normalized: string): Word[] {
  const found: Word[] = [];
  const pattern = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized)) !== null)
    found.push({ text: match[0], at: match.index });
  return found;
}

/** Where a wording occurs in the speech, or -1 when it does not. */
function positionOf(spoken: Word[], candidate: string): number {
  const wanted = candidate.split(" ").filter(Boolean);
  if (wanted.length === 0) return -1;
  for (let start = 0; start + wanted.length <= spoken.length; start += 1) {
    const window = spoken.slice(start, start + wanted.length);
    if (window.every((word, index) => word.text === wanted[index]))
      return window[0].at;
  }
  const limit = slipsAllowed(candidate);
  if (limit === 0) return -1;
  for (let start = 0; start + wanted.length <= spoken.length; start += 1) {
    const window = spoken.slice(start, start + wanted.length);
    const heard = window.map((word) => word.text).join(" ");
    if (distanceWithin(heard, candidate, limit)) return window[0].at;
  }
  return -1;
}

/**
 * The triggers present in a piece of speech, in the order they were spoken, so
 * "cancel, then next" runs the cancellation first.
 */
export function matchTriggers(
  transcript: string,
  triggers: readonly VoiceTrigger[],
): VoiceTrigger[] {
  const spoken = words(normalizeSpoken(transcript));
  if (spoken.length === 0) return [];
  return triggers
    .map((trigger, index) => {
      const positions = [trigger.phrase, ...(trigger.aliases ?? [])]
        .map((wording) => positionOf(spoken, normalizeSpoken(wording)))
        .filter((position) => position >= 0);
      return positions.length > 0
        ? { trigger, index, position: Math.min(...positions) }
        : undefined;
    })
    .filter((found): found is NonNullable<typeof found> => found !== undefined)
    .sort(
      (left, right) =>
        left.position - right.position || left.index - right.index,
    )
    .map(({ trigger }) => trigger);
}
