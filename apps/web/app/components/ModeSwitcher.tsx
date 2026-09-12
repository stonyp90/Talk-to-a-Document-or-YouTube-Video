"use client";

import { type KeyboardEvent } from "react";
import { Icon, type IconName } from "./Icon";
import { useLanguage } from "../i18n/LanguageProvider";

/** The ways a person can drive Ursly, in the order they are offered. */
export type EntryMode = "voice" | "text" | "motion";
type ModeId = EntryMode;

type Mode = {
  id: ModeId;
  label: string;
  /** What fits on a phone; the full label stays the accessible name. */
  short: string;
  detail: string;
  icon: IconName;
  /** The previous generation of input: kept and supported, no longer the door. */
  legacy?: boolean;
};

/**
 * Read left to right, this is the argument: you speak today, you will move
 * tomorrow, and the keyboard is what the internet used to ask of you. The
 * order is the message, so it is fixed here and nowhere else.
 */
const MODES: readonly Mode[] = [
  {
    id: "voice",
    label: "Voice to action",
    short: "Voice",
    detail: "",
    icon: "voice",
  },
  {
    id: "motion",
    label: "Motion to action",
    short: "Motion",
    detail: "Beta",
    icon: "motion",
  },
  {
    id: "text",
    label: "Keyboard to action",
    short: "Keyboard",
    detail: "Legacy",
    icon: "document",
    legacy: true,
  },
];

/** The modes in the order they are drawn, which is the order the keys walk. */
const SELECTABLE = MODES.map((mode) => mode.id);

/**
 * A segmented control with radio semantics: one mode is always selected and the
 * arrow keys move between them. Motion is marked beta because it reads a hand
 * from a camera rather than a model, which is enough for five movements and
 * honest about being no more than that.
 */
export function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: EntryMode;
  onChange: (mode: EntryMode) => void;
}) {
  const { t } = useLanguage();

  function move(from: EntryMode, step: 1 | -1) {
    const index = SELECTABLE.indexOf(from);
    const next =
      SELECTABLE[(index + step + SELECTABLE.length) % SELECTABLE.length];
    onChange(next);
    document.getElementById(`mode-${next}`)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: ModeId) {
    const origin: EntryMode = current;
    if (["ArrowRight", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      move(origin, 1);
    } else if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      move(origin, -1);
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(SELECTABLE[0]);
      document.getElementById(`mode-${SELECTABLE[0]}`)?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      const last = SELECTABLE[SELECTABLE.length - 1];
      onChange(last);
      document.getElementById(`mode-${last}`)?.focus();
    }
  }

  return (
    <div
      className="modes"
      role="radiogroup"
      aria-label={t("Control mode")}
    >
      {MODES.map((item) => {
        const checked = item.id === mode;
        return (
          <button
            key={item.id}
            id={`mode-${item.id}`}
            type="button"
            role="radio"
            className={`mode mode-${item.id}${item.legacy ? " mode-legacy" : ""}`}
            aria-checked={checked}
            aria-label={t(item.label)}
            tabIndex={checked ? 0 : -1}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => onKeyDown(event, item.id)}
          >
            <Icon name={item.icon} />
            <span className="mode-label">
              <span className="mode-label-full">{t(item.label)}</span>
              <span className="mode-label-short">{t(item.short)}</span>
            </span>
            {item.detail && (
              <small className="mode-detail">{t(item.detail)}</small>
            )}
          </button>
        );
      })}
    </div>
  );
}
