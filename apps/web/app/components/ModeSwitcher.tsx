"use client";

import { type KeyboardEvent } from "react";
import { Icon, type IconName } from "./Icon";
import { useLanguage } from "../i18n/LanguageProvider";

/** Voice and motion remain accepted for previously saved preferences. */
export type EntryMode = "human" | "text" | "voice" | "motion";
type ModeId = "human" | "text";

type Mode = {
  id: ModeId;
  label: string;
  /** What fits on a phone; the full label stays the accessible name. */
  short: string;
  icon: IconName;
  detail?: string;
};

/** Human senses share one experience; keyboard input is always available. */
const MODES: readonly Mode[] = [
  {
    id: "human",
    label: "Sense",
    short: "Sense",
    icon: "voice",
  },
  {
    id: "text",
    label: "Keyboard to action",
    short: "Keyboard",
    icon: "keyboard",
    detail: "Legacy",
  },
];

const BRAIN_MODE = {
  label: "Brain to action",
  short: "Brain",
  icon: "brain" as IconName,
  detail: "Beta",
};

/** The modes in the order they are drawn, which is the order the keys walk. */
const SELECTABLE = MODES.map((mode) => mode.id);

/** A shared input preference with radio semantics and keyboard navigation. */
export function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: EntryMode;
  onChange: (mode: EntryMode) => void;
}) {
  const { t } = useLanguage();
  const selectedMode: ModeId = mode === "text" ? "text" : "human";

  function move(from: ModeId, step: 1 | -1) {
    const index = SELECTABLE.indexOf(from);
    const next =
      SELECTABLE[(index + step + SELECTABLE.length) % SELECTABLE.length];
    onChange(next);
    document.getElementById(`mode-${next}`)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: ModeId) {
    if (["ArrowRight", "ArrowDown"].includes(event.key)) {
      event.preventDefault();
      move(current, 1);
    } else if (["ArrowLeft", "ArrowUp"].includes(event.key)) {
      event.preventDefault();
      move(current, -1);
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
    <div className="modes" role="radiogroup" aria-label={t("Control mode")}>
      {MODES.map((item) => {
        const checked = item.id === selectedMode;
        return (
          <button
            key={item.id}
            id={`mode-${item.id}`}
            type="button"
            role="radio"
            className={`mode mode-${item.id}`}
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
      <button
        type="button"
        className="mode mode-brain mode-unavailable"
        aria-label={t(BRAIN_MODE.label)}
        aria-disabled="true"
        onClick={() => undefined}
      >
        <Icon name={BRAIN_MODE.icon} />
        <span className="mode-label">
          <span className="mode-label-full">{t(BRAIN_MODE.label)}</span>
          <span className="mode-label-short">{t(BRAIN_MODE.short)}</span>
        </span>
        <small className="mode-detail">{t(BRAIN_MODE.detail)}</small>
      </button>
    </div>
  );
}
