export type VoiceTriggerLike = {
  id: string;
  phrase: string;
};

export function normalizeVoiceText(value: string) {
  return value
    .toLocaleLowerCase()
    .replace(/[-–—]/g, "")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findVoiceTriggerMatches<T extends VoiceTriggerLike>(
  transcript: string,
  triggers: T[],
) {
  const spoken = normalizeVoiceText(transcript);
  return triggers
    .map((trigger, index) => {
      const phrase = normalizeVoiceText(trigger.phrase);
      if (!phrase) return null;
      const match = spoken.match(
        new RegExp(`(?:^|\\s)${escaped(phrase)}(?=$|\\s)`),
      );
      return match
        ? { trigger, index, position: match.index ?? Number.MAX_SAFE_INTEGER }
        : null;
    })
    .filter(
      (item): item is { trigger: T; index: number; position: number } =>
        item !== null,
    )
    .sort(
      (left, right) =>
        left.position - right.position || left.index - right.index,
    )
    .map(({ trigger }) => trigger);
}
