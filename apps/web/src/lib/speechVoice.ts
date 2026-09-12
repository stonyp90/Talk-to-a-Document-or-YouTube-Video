/**
 * Which installed voice reads a confirmation back. Browsers ship several
 * voices per language whose quality varies enormously: the small "compact"
 * voices sound robotic, while the premium and neural ones sound close to a
 * person. The browser default is whichever came first, so the voice is chosen
 * deliberately instead.
 */

export type SpeakableVoice = {
  name: string;
  lang: string;
  localService?: boolean;
  default?: boolean;
};

/** A reply that is confirming an action is clearer a little below full speed. */
export const SPEECH_DELIVERY = { rate: 0.95, pitch: 1, volume: 1 } as const;

/** Names vendors give to their better voices. */
const PREFERRED_NAMES = [
  "premium",
  "enhanced",
  "neural",
  "natural",
  "siri",
] as const;
/** The stripped-down voices, kept only as a last resort. */
const REDUCED_NAMES = ["compact", "eloquence"] as const;

function tag(value: string): string {
  return value.trim().toLowerCase().replace(/_/g, "-");
}

function score(voice: SpeakableVoice, locale: string): number {
  const wanted = tag(locale);
  const spoken = tag(voice.lang);
  let points = spoken === wanted ? 100 : 50;
  const name = voice.name.toLowerCase();
  if (PREFERRED_NAMES.some((preferred) => name.includes(preferred)))
    points += 20;
  if (REDUCED_NAMES.some((reduced) => name.includes(reduced))) points -= 10;
  if (voice.localService !== false) points += 5;
  if (voice.default) points += 1;
  return points;
}

/**
 * The best voice for a locale, or nothing at all when the language is missing,
 * in which case the browser default is left alone rather than replaced by a
 * voice speaking the wrong language.
 */
export function selectSpeechVoice<Voice extends SpeakableVoice>(
  voices: readonly Voice[],
  locale: string,
): Voice | undefined {
  const language = tag(locale).split("-")[0];
  const candidates = voices.filter(
    (voice) => tag(voice.lang).split("-")[0] === language,
  );
  if (candidates.length === 0) return undefined;
  // Name breaks a tie, so the same browser always answers in the same voice.
  return [...candidates].sort(
    (left, right) =>
      score(right, locale) - score(left, locale) ||
      left.name.localeCompare(right.name),
  )[0];
}
