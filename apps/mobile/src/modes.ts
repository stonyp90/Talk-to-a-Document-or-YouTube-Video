import type { TranslationKey } from "./i18n";

/** Input preferences share one workspace on native and web. */
export type EntryMode = "human" | "text";
export type ModeId = EntryMode | "brain";

export type Mode = {
  id: ModeId;
  label: TranslationKey;
  short: TranslationKey;
  detail?: TranslationKey;
  available: boolean;
};

export const MODES: readonly Mode[] = [
  { id: "human", label: "Sense", short: "Sense", available: true },
  {
    id: "text",
    label: "Keyboard to action",
    short: "Keyboard",
    detail: "Legacy",
    available: true,
  },
  {
    id: "brain",
    label: "Brain to action",
    short: "Brain",
    detail: "Beta",
    available: false,
  },
];

export const DEFAULT_MODE: EntryMode = "human";
/** Keep existing preferences while migrating the separate voice/motion modes. */
export const MODE_STORAGE_KEY = "ursly-mode-v1";

export function parseSavedMode(value: string | null | undefined): EntryMode {
  return value === "text" ? "text" : DEFAULT_MODE;
}

const NOTICES: Record<ModeId, TranslationKey> = {
  human: "Sense: speak, move, or type in one experience.",
  text: "Keyboard to action: everything works by typing and clicking.",
  brain: "Brain to action is not available yet.",
};

export function chooseMode(
  current: EntryMode,
  id: ModeId,
): { mode: EntryMode; notice: TranslationKey } {
  const chosen = MODES.find((mode) => mode.id === id);
  if (!chosen?.available || id === "brain")
    return { mode: current, notice: NOTICES.brain };
  return { mode: id, notice: NOTICES[id] };
}
