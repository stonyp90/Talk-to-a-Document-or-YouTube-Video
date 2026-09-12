import type { TranslationKey } from "./i18n";

/** The ways a person drives Ursly: the same three as the web's control menu. */
export type EntryMode = "voice" | "text";
export type ModeId = EntryMode | "motion";

export type Mode = {
  id: ModeId;
  /** The full accessible name. */
  label: TranslationKey;
  /** What fits under a glyph on a phone. */
  short: TranslationKey;
  detail?: TranslationKey;
  available: boolean;
};

export const MODES: readonly Mode[] = [
  { id: "voice", label: "Voice to action", short: "Voice", available: true },
  { id: "text", label: "Keyboard to action", short: "Keyboard", available: true },
  {
    id: "motion",
    label: "Motion to action",
    short: "Motion",
    detail: "Beta",
    available: false,
  },
];

/** Voice first, on every device, until a person chooses otherwise. */
export const DEFAULT_MODE: EntryMode = "voice";
/** The same key as the web, so the choice reads the same way everywhere. */
export const MODE_STORAGE_KEY = "ursly-mode-v1";

export function parseSavedMode(value: string | null | undefined): EntryMode {
  return value === "text" ? "text" : DEFAULT_MODE;
}

const NOTICES: Record<ModeId, TranslationKey> = {
  voice: "Voice to action: say a command, or use the controls as usual.",
  text: "Keyboard to action: everything works by typing and clicking.",
  motion:
    "Motion to action is not available yet. We are working on it. Voice and keyboard are ready today.",
};

/**
 * A mode that does not exist yet explains itself and leaves the current one
 * in place; one that does switches and says what changed.
 */
export function chooseMode(
  current: EntryMode,
  id: ModeId,
): { mode: EntryMode; notice: TranslationKey } {
  const chosen = MODES.find((mode) => mode.id === id);
  if (!chosen?.available) return { mode: current, notice: NOTICES.motion };
  return { mode: chosen.id as EntryMode, notice: NOTICES[chosen.id] };
}
