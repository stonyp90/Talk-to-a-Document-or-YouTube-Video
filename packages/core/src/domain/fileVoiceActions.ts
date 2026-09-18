import type { VoiceLanguage } from "./voiceCommands";
import { type VoiceActionId, type VoiceTrigger } from "./voiceCommands";

export const FILE_NAVIGATION_ACTIONS: readonly VoiceActionId[] = [
  "open",
  "select",
  "search",
];

const EN_PHRASES: Record<"open" | "select" | "search", string[]> = {
  open: ["open", "open file", "open folder", "go into"],
  select: ["select", "choose", "pick"],
  search: ["search", "find", "look for"],
};

const FR_PHRASES: Record<"open" | "select" | "search", string[]> = {
  open: ["ouvrir", "ouvre", "entrer dans"],
  select: ["sélectionner", "choisir", "sélectionne"],
  search: ["chercher", "rechercher", "trouver"],
};

export function fileDefaultPhrases(
  language: VoiceLanguage,
): Record<"open" | "select" | "search", string[]> {
  return language === "fr"
    ? { ...FR_PHRASES }
    : { ...EN_PHRASES };
}

export function fileDefaultTriggers(
  language: VoiceLanguage,
): VoiceTrigger[] {
  const phrases = fileDefaultPhrases(language);
  return FILE_NAVIGATION_ACTIONS.map(
    (action): VoiceTrigger => ({
      id: `file-${action}`,
      phrase: phrases[action as keyof typeof phrases][0],
      action,
    }),
  );
}
