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
    upload: ["Upload", "upload a pdf", "open the pdf", "choose a file"],
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
    ],
    voice: ["Parlons-en", "parlons", "on se parle", "discussion vocale"],
    summarize: ["Résume ceci", "résume", "résumé", "idées clés"],
    back: ["retour", "reviens", "recule"],
    next: ["suivant", "continue", "prochaine étape"],
    cancel: ["annule", "annuler", "arrête", "laisse tomber"],
  },
};

/**
 * The actions, in the order they are offered. ONE list: what the interface
 * advertises and what the microphone is armed for are the same set, so the
 * panel can never again quote a word nothing is listening for.
 */
export const EXAMPLE_ACTIONS: readonly VoiceActionId[] = VOICE_ACTION_IDS;
const DEFAULT_ACTIONS: readonly VoiceActionId[] = VOICE_ACTION_IDS;

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

/**
 * One normalized word, and where in the ORIGINAL speech it came from. The
 * argument after a keyword has to be handed back exactly as it was spoken —
 * "Édith Piaf", not "edith piaf" — so matching happens on the normalized
 * form while the raw offsets travel alongside it.
 */
type Word = { text: string; from: number; to: number };

function words(spoken: string): Word[] {
  const found: Word[] = [];
  const pattern = /\S+/g;
  let token: RegExpExecArray | null;
  while ((token = pattern.exec(spoken)) !== null) {
    // One raw token can normalize to several words ("P.D.F." → "p d f") or
    // to none at all (a lone dash), so each keeps the same raw span.
    for (const text of normalizeSpoken(token[0]).split(" ").filter(Boolean))
      found.push({
        text,
        from: token.index,
        to: token.index + token[0].length,
      });
  }
  return found;
}

/** The window a wording occupies in the speech, or undefined when absent. */
function windowOf(
  spoken: Word[],
  candidate: string,
): { first: Word; last: Word } | undefined {
  const wanted = candidate.split(" ").filter(Boolean);
  if (wanted.length === 0) return undefined;
  const at = (start: number) => ({
    first: spoken[start],
    last: spoken[start + wanted.length - 1],
  });
  for (let start = 0; start + wanted.length <= spoken.length; start += 1) {
    const window = spoken.slice(start, start + wanted.length);
    if (window.every((word, index) => word.text === wanted[index]))
      return at(start);
  }
  const limit = slipsAllowed(candidate);
  if (limit === 0) return undefined;
  for (let start = 0; start + wanted.length <= spoken.length; start += 1) {
    const heard = spoken
      .slice(start, start + wanted.length)
      .map((word) => word.text)
      .join(" ");
    if (distanceWithin(heard, candidate, limit)) return at(start);
  }
  return undefined;
}

/**
 * A trigger that was heard, plus whatever was said after it. "YouTube
 * Pennywise" is the youtube action carrying the argument "Pennywise"; the
 * argument is empty when the caller said the keyword on its own.
 */
export type VoiceMatch = VoiceTrigger & { argument: string };

/**
 * The triggers present in a piece of speech, in the order they were spoken, so
 * "cancel, then next" runs the cancellation first.
 */
export function matchTriggers(
  transcript: string,
  triggers: readonly VoiceTrigger[],
): VoiceMatch[] {
  const spoken = words(transcript);
  if (spoken.length === 0) return [];
  return triggers
    .map((trigger, index) => {
      const windows = [trigger.phrase, ...(trigger.aliases ?? [])]
        .map((wording) => windowOf(spoken, normalizeSpoken(wording)))
        .filter((found): found is NonNullable<typeof found> => Boolean(found));
      if (windows.length === 0) return undefined;
      // The earliest wording wins, and the argument is what follows it.
      const [best] = windows.sort((a, b) => a.first.from - b.first.from);
      return { trigger, index, position: best.first.from, after: best.last.to };
    })
    .filter((found): found is NonNullable<typeof found> => found !== undefined)
    .sort(
      (left, right) =>
        left.position - right.position || left.index - right.index,
    )
    .map(({ trigger, after }) => ({
      ...trigger,
      argument: transcript
        .slice(after)
        .replace(/^[\s,.;:!?—–-]+/, "")
        .trim(),
    }));
}
