/**
 * The spoken vocabulary and the rules that decide what was asked for.
 *
 * Speech arrives as a sentence, not as a keyword: people say "go back please"
 * and "peux-tu résumer ça", and the recognizer mis-hears short words on the
 * way. The interface used to keep its phrases inline, in English only, and
 * compare them whole, so French dictation never triggered anything even though
 * the recognizer was listening in fr-CA. The vocabulary belongs here instead —
 * away from React, storage and the recognizer — so both languages and every
 * client share one definition of what counts as a command, and so whatever was
 * not a command can be handed on as a question.
 */

export type VoiceActionId =
  | "youtube"
  | "upload"
  | "voice"
  | "summarize"
  | "ask"
  | "stop"
  | "back"
  | "next"
  | "cancel";

export type VoiceLanguage = "en" | "fr";

export type VoiceTrigger = {
  id: string;
  phrase: string;
  action: VoiceActionId;
};

export type CommandMatch = {
  trigger: VoiceTrigger;
  position: number;
  confidence: "exact" | "near";
};

/**
 * The order every list of actions follows, from the sources a reader adds to
 * the commands that undo them. It also breaks ties between two commands heard
 * at the same instant, so it must stay stable.
 */
export const VOICE_ACTIONS: readonly VoiceActionId[] = [
  "youtube",
  "upload",
  "voice",
  "summarize",
  "ask",
  "stop",
  "back",
  "next",
  "cancel",
];

/**
 * Below this length a phrase is too short to be forgiving about. "Backlog" is
 * "back" plus three letters, and "je lisais le backlog hier" is not a request
 * to go back — a command that fires on a word nobody said costs more than one
 * that waits to be repeated.
 */
const NEAR_MISS_MIN_PHRASE_LENGTH = 6;
/** One mis-heard letter is a recognizer slip; two is a different word. */
const NEAR_MISS_MAX_EDITS = 1;
/** How much a spoken ending may add to a phrase: "résumer", "cancelled". */
const NEAR_MISS_MAX_ENDING = 3;
/** Short dictation is usually an aside; a question is worth a few words. */
const MIN_QUESTION_WORDS = 3;

/** A run of letters, digits or elision marks: one spoken word. */
const WORD_PATTERN = /[\p{L}\p{N}'’ʼ]+/gu;

/**
 * Phrases are stored already folded — "televerse", "precedent" — because that
 * is the shape `normalizeSpeech` compares against, and a stored phrase that
 * cannot round-trip through it would silently never match.
 *
 * The French is not a translation of the English list. A recognizer hears one
 * short burst, so each action carries the ways a person actually says it in
 * Quebec French, in both registers: the interface vouvoies its reader, but a
 * command thrown at a microphone comes out either way.
 */
const PHRASES: Record<VoiceLanguage, Record<VoiceActionId, string[]>> = {
  en: {
    youtube: ["youtube", "video", "open youtube"],
    upload: ["upload", "upload a pdf", "open the file picker", "choose a pdf"],
    voice: ["let's talk", "start voice chat", "talk to it", "voice chat"],
    summarize: ["summarize this", "summarise this", "summary", "key ideas"],
    ask: ["ask", "send it", "send that", "go ahead"],
    stop: ["stop", "stop talking", "stop listening", "be quiet"],
    back: ["back", "go back", "previous", "undo"],
    next: ["next", "continue", "carry on", "go forward"],
    cancel: ["cancel", "never mind", "forget it"],
  },
  // Written the way a reader would write them, accents and all. Matching folds
  // both sides, so the spelling here is free to be the one shown on screen.
  fr: {
    youtube: ["youtube", "vidéo", "ouvre youtube", "ouvrez youtube"],
    upload: [
      "téléverse",
      "téléverser un PDF",
      "choisis un PDF",
      "téléversez",
      "choisissez un PDF",
    ],
    voice: [
      "on se parle",
      "parle-moi",
      "discussion vocale",
      "parlez-moi",
      "on jase",
    ],
    summarize: ["résume", "résume ça", "idées clés", "résumez"],
    ask: ["envoie", "vas-y", "demande", "envoyez", "allez-y"],
    stop: ["arrête", "tais-toi", "stop", "arrêtez", "taisez-vous"],
    back: ["retour", "reviens", "précédent", "annule ça", "revenez"],
    next: ["suivant", "continue", "la suite", "continuez"],
    cancel: ["annule", "laisse tomber", "oublie ça", "annulez"],
  },
};

/**
 * Folds speech down to what two phrasings have in common: accents disappear so
 * "résume" reaches an ASCII phrase, hyphens become spaces so "tais-toi" and
 * "tais toi" are the same command, and elision marks are dropped so a reader
 * never has to say "let's" the way the recognizer spelled it.
 */
export function normalizeSpeech(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’ʼ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** The phrases recognised for each action, as a copy the caller may edit. */
export function defaultPhrases(
  language: VoiceLanguage,
): Record<VoiceActionId, string[]> {
  const source = PHRASES[language] ?? PHRASES.en;
  return Object.fromEntries(
    VOICE_ACTIONS.map((action) => [action, [...source[action]]]),
  ) as Record<VoiceActionId, string[]>;
}

/**
 * The set a reader starts from, one trigger per action. The first phrase of
 * each list is the one worth showing: the others exist for the microphone.
 */
/** The language a bilingual speaker is most likely to slip into. */
function otherLanguage(language: VoiceLanguage): VoiceLanguage {
  return language === "fr" ? "en" : "fr";
}

export function defaultTriggers(language: VoiceLanguage): VoiceTrigger[] {
  const phrases = defaultPhrases(language);
  return VOICE_ACTIONS.map((action) => ({
    id: `default-${action}`,
    phrase: phrases[action][0],
    action,
  }));
}

type SpokenWord = {
  normalized: string;
  /** Where the word starts in the normalized transcript. */
  position: number;
  /** Where the word starts and ends in the transcript as it was spoken. */
  start: number;
  end: number;
};

function spokenWords(transcript: string): SpokenWord[] {
  const words: SpokenWord[] = [];
  let position = 0;
  for (const found of transcript.matchAll(WORD_PATTERN)) {
    const normalized = normalizeSpeech(found[0]);
    if (!normalized) continue;
    const start = found.index;
    words.push({ normalized, position, start, end: start + found[0].length });
    position += normalized.length + 1;
  }
  return words;
}

function phraseWords(phrase: string): string[] {
  const normalized = normalizeSpeech(phrase);
  return normalized ? normalized.split(" ") : [];
}

function editDistance(left: string, right: string): number {
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const current = [row];
    for (let column = 1; column <= right.length; column += 1) {
      const substitution =
        previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1);
      current[column] = Math.min(
        substitution,
        previous[column] + 1,
        current[column - 1] + 1,
      );
    }
    previous = current;
  }
  return previous[right.length];
}

/**
 * Whether a spoken word is the phrase, badly heard.
 *
 * One slip is forgiven and no more. A longer word may only extend the
 * phrase's ending — "cancelled", "résumer", "uploader" — because an extra
 * letter anywhere else usually makes a different, real word: a single edit
 * turns "back" into "black", which means nothing like it. A shorter or equally
 * long word may differ by one edit as long as it starts the same way, which
 * covers the swallowed consonants a recognizer produces ("bak") without
 * reaching across the vocabulary.
 */
function isNearMiss(spoken: string, phrase: string): boolean {
  if (phrase.length < NEAR_MISS_MIN_PHRASE_LENGTH) return false;
  if (spoken === phrase) return false;
  if (spoken.startsWith(phrase))
    return spoken.length - phrase.length <= NEAR_MISS_MAX_ENDING;
  if (spoken.length > phrase.length) return false;
  if (spoken[0] !== phrase[0]) return false;
  return editDistance(spoken, phrase) <= NEAR_MISS_MAX_EDITS;
}

type Hearing = {
  position: number;
  index: number;
  length: number;
  confidence: "exact" | "near";
};

function hear(words: SpokenWord[], phrase: string): Hearing | null {
  const wanted = phraseWords(phrase);
  if (wanted.length === 0) return null;

  for (let index = 0; index + wanted.length <= words.length; index += 1) {
    const spoken = wanted.every(
      (word, offset) => words[index + offset].normalized === word,
    );
    if (spoken)
      return {
        position: words[index].position,
        index,
        length: wanted.length,
        confidence: "exact",
      };
  }

  // Tolerance is for one mis-heard word, not for a mis-heard sentence.
  if (wanted.length > 1) return null;
  for (let index = 0; index < words.length; index += 1)
    if (isNearMiss(words[index].normalized, wanted[0]))
      return {
        position: words[index].position,
        index,
        length: 1,
        confidence: "near",
      };
  return null;
}

type Candidate = { match: CommandMatch; index: number; length: number };

function beatsCurrent(candidate: Hearing, current: Hearing): boolean {
  if (candidate.confidence !== current.confidence)
    return candidate.confidence === "exact";
  if (candidate.position !== current.position)
    return candidate.position < current.position;
  // "resume" and "resume ca" both start where the reader started speaking; the
  // longer phrase is the one they finished, and the one dictation must remove.
  return candidate.length > current.length;
}

export function matchCommands(
  transcript: string,
  triggers: VoiceTrigger[],
  options: { language?: VoiceLanguage; includeDefaults?: boolean } = {},
): CommandMatch[] {
  const language = options.language ?? "en";
  const includeDefaults = options.includeDefaults ?? true;
  const words = spokenWords(transcript);
  if (words.length === 0) return [];
  // A bilingual speaker switches language mid-sentence without thinking about
  // it, so the other language's wordings are accepted too. The interface
  // language is listed first, which is what settles a tie between them.
  const phrases = defaultPhrases(language);
  const alternates = defaultPhrases(otherLanguage(language));

  const candidates: Candidate[] = [];
  for (const action of VOICE_ACTIONS) {
    // A saved phrase adds to the built-in ones rather than replacing them:
    // whichever action a reader has customised, every action keeps working.
    const spoken: Array<{ id: string; phrase: string }> = triggers.filter(
      (trigger) => trigger.action === action,
    );
    if (includeDefaults)
      for (const phrase of [...phrases[action], ...alternates[action]])
        spoken.push({ id: `default-${action}`, phrase });

    let best: { hearing: Hearing; id: string; phrase: string } | null = null;
    for (const { id, phrase } of spoken) {
      const hearing = hear(words, phrase);
      if (!hearing) continue;
      if (!best || beatsCurrent(hearing, best.hearing))
        best = { hearing, id, phrase };
    }
    if (!best) continue;
    candidates.push({
      match: {
        trigger: { id: best.id, phrase: best.phrase, action },
        position: best.hearing.position,
        confidence: best.hearing.confidence,
      },
      index: best.hearing.index,
      length: best.hearing.length,
    });
  }

  // One stretch of speech can only mean one thing. "annule ça" is the cancel
  // phrase inside a back phrase, so the longer claim takes the words and the
  // shorter one is dropped instead of firing a second action nobody asked for.
  const claimed: Candidate[] = [];
  for (const candidate of [...candidates].sort(
    (left, right) =>
      right.length - left.length ||
      left.match.position - right.match.position ||
      VOICE_ACTIONS.indexOf(left.match.trigger.action) -
        VOICE_ACTIONS.indexOf(right.match.trigger.action),
  ))
    if (
      !claimed.some(
        (taken) =>
          candidate.index < taken.index + taken.length &&
          taken.index < candidate.index + candidate.length,
      )
    )
      claimed.push(candidate);

  return claimed
    .map((candidate) => candidate.match)
    .sort(
      (left, right) =>
        left.position - right.position ||
        VOICE_ACTIONS.indexOf(left.trigger.action) -
          VOICE_ACTIONS.indexOf(right.trigger.action),
    );
}

/**
 * What is left of the transcript once the commands are taken out of it — the
 * question the reader asked while asking for it to be sent. The spoken text is
 * cut, not rebuilt, so accents, casing and the question mark all survive.
 */
export function dictationText(
  transcript: string,
  matches: CommandMatch[],
): string {
  const words = spokenWords(transcript);
  const removed = new Set<number>();
  for (const match of matches) {
    const index = words.findIndex((word) => word.position === match.position);
    if (index < 0) continue;
    const length =
      match.confidence === "near"
        ? 1
        : phraseWords(match.trigger.phrase).length;
    for (let offset = 0; offset < length; offset += 1)
      removed.add(index + offset);
  }

  let kept = "";
  let cursor = 0;
  for (const [index, word] of words.entries()) {
    if (!removed.has(index)) continue;
    kept += `${transcript.slice(cursor, word.start)} `;
    cursor = word.end;
  }
  kept += transcript.slice(cursor);

  const dictation = kept
    .replace(/\s+/g, " ")
    .replace(/^[^\p{L}\p{N}]+/u, "")
    .trim();
  return normalizeSpeech(dictation) ? dictation : "";
}

/** Whether the leftover dictation is a question rather than a stray word. */
export function isLikelyQuestion(text: string): boolean {
  if (text.trimEnd().endsWith("?")) return true;
  const normalized = normalizeSpeech(text);
  return normalized
    ? normalized.split(" ").length >= MIN_QUESTION_WORDS
    : false;
}

/**
 * Actions whose meaning is completed by whatever else was said. "YouTube" on
 * its own opens the tab; "YouTube, Daft Punk Around the World" is a search, and
 * nobody is going to read a video address out loud one character at a time.
 */
export const ARGUMENT_ACTIONS: readonly VoiceActionId[] = ["youtube"];

export function takesSpokenArgument(action: VoiceActionId): boolean {
  return ARGUMENT_ACTIONS.includes(action);
}

/**
 * Filler a speaker puts between the command and what they actually want.
 * Articles are deliberately absent: "the Beatles" and "Le Roi Lion" are titles,
 * and a search engine copes with an article far better than with a missing word.
 */
const ARGUMENT_LEAD_IN =
  /^(?:for|about|search(?:\s+for)?|find|play|open|pour|sur|a\s+propos\s+de|cherche[rz]?|trouve[rz]?|ouvre[zr]?|joue[rz]?)\b\s*/iu;

/**
 * The words that complete an action, with the speaker's connective stripped.
 * "YouTube, search for Miles Davis" and "YouTube Miles Davis" ask for the same
 * thing, and the search should not see the difference.
 */
export function spokenArgument(leftover: string): string {
  let text = leftover.trim();
  // A speaker often stacks two of these: "search for the …".
  for (let pass = 0; pass < 2; pass++) {
    const trimmed = text.replace(ARGUMENT_LEAD_IN, "").trim();
    if (trimmed === text) break;
    text = trimmed;
  }
  return normalizeSpeech(text) ? text : "";
}

/**
 * Actions whose built-in wording is only a default. "Summarize this" is the
 * canned request; "summarize this in three points" is the speaker writing their
 * own, and answering the canned one instead would ignore what they asked for.
 */
const PHRASED_ACTIONS: readonly VoiceActionId[] = ["summarize"];

export function carriesOwnPhrasing(action: VoiceActionId): boolean {
  return PHRASED_ACTIONS.includes(action);
}

/**
 * The words people wrap a command in. "Can you go back please" is one
 * instruction, not an instruction plus the question "can you please" — and
 * "peux-tu résumer ça" is not a request to think about "peux-tu ça". Once a
 * command has taken its words, what is left only counts as dictation if
 * something was actually said.
 */
const FILLER_WORDS = new Set([
  // English
  "a",
  "an",
  "the",
  "and",
  "so",
  "then",
  "now",
  "just",
  "ok",
  "okay",
  "hey",
  "please",
  "can",
  "could",
  "would",
  "will",
  "you",
  "i",
  "we",
  "do",
  "did",
  "for",
  "to",
  "me",
  "us",
  "it",
  "this",
  "that",
  "one",
  "go",
  "let",
  "lets",
  "well",
  "yeah",
  "yes",
  "no",
  "thanks",
  "thank",
  // French
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "de",
  "du",
  "et",
  "puis",
  "donc",
  "alors",
  "maintenant",
  "juste",
  "ok",
  "bon",
  "bien",
  "oui",
  "non",
  "merci",
  "peux",
  "peut",
  "pouvez",
  "tu",
  "vous",
  "je",
  "on",
  "nous",
  "me",
  "moi",
  "ca",
  "cela",
  "ce",
  "cette",
  "est",
  "ce que",
  "que",
  "qui",
  "pour",
  "a",
  "s'il",
  "sil",
  "plait",
  "stp",
  "svp",
]);

/**
 * Whether what is left after a command is worth sending on its own. A leftover
 * made only of the words people pad a request with is padding, not a question.
 */
export function isSpokenContent(text: string): boolean {
  const normalized = normalizeSpeech(text);
  if (!normalized) return false;
  const content = normalized
    .split(" ")
    .filter((word) => word && !FILLER_WORDS.has(word));
  return content.length >= MIN_SPOKEN_CONTENT_WORDS;
}

/** Below this, the leftover is padding around a command rather than a request. */
const MIN_SPOKEN_CONTENT_WORDS = 2;
