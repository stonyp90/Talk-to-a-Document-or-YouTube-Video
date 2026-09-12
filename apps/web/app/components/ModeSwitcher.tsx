"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { Icon, type IconName } from "./Icon";
import { useLanguage } from "../i18n/LanguageProvider";

/** The ways a person can drive Ursly. Motion is announced, not yet offered. */
export type EntryMode = "voice" | "text";
type ModeId = EntryMode | "motion";

type Mode = {
  id: ModeId;
  label: string;
  /** What fits on a phone; the full label stays the accessible name. */
  short: string;
  detail: string;
  icon: IconName;
  available: boolean;
};

const MODES: readonly Mode[] = [
  {
    id: "voice",
    label: "Voice to action",
    short: "Voice",
    detail: "",
    icon: "voice",
    available: true,
  },
  {
    id: "text",
    label: "Keyboard to action",
    short: "Keyboard",
    detail: "",
    icon: "document",
    available: true,
  },
  {
    id: "motion",
    label: "Motion to action",
    short: "Motion",
    detail: "Beta",
    icon: "motion",
    available: false,
  },
];

const SELECTABLE = MODES.filter((mode) => mode.available).map(
  (mode) => mode.id as EntryMode,
);

/**
 * A segmented control with radio semantics: one mode is always selected, the
 * arrow keys move between the modes that exist today, and the beta mode stays
 * focusable so keyboard and screen-reader users learn what is coming without
 * being able to select something that does not work yet.
 */
export function ModeSwitcher({
  mode,
  onChange,
}: {
  mode: EntryMode;
  onChange: (mode: EntryMode) => void;
}) {
  const { t } = useLanguage();
  const tooltipId = useId();
  const [explaining, setExplaining] = useState(false);

  function move(from: EntryMode, step: 1 | -1) {
    const index = SELECTABLE.indexOf(from);
    const next =
      SELECTABLE[(index + step + SELECTABLE.length) % SELECTABLE.length];
    onChange(next);
    document.getElementById(`mode-${next}`)?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, current: ModeId) {
    const origin: EntryMode = current === "motion" ? mode : current;
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
      data-explaining={explaining}
    >
      {MODES.map((item) => {
        const checked = item.id === mode;
        return (
          <button
            key={item.id}
            id={`mode-${item.id}`}
            type="button"
            role="radio"
            className={`mode mode-${item.id}`}
            aria-checked={checked}
            aria-label={t(item.label)}
            aria-disabled={item.available ? undefined : true}
            aria-describedby={item.available ? undefined : tooltipId}
            tabIndex={checked ? 0 : -1}
            onClick={() => {
              if (item.available) onChange(item.id as EntryMode);
              else setExplaining((current) => !current);
            }}
            onBlur={() => setExplaining(false)}
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
      <span id={tooltipId} role="tooltip" className="mode-tooltip">
        {t(
          "Motion to action is not available yet. We are working on it. Voice and keyboard are ready today.",
        )}
      </span>
    </div>
  );
}
