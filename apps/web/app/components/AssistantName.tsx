"use client";

import { useState } from "react";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  DEFAULT_ASSISTANT_NAME,
  MAX_ASSISTANT_NAME_CHARACTERS,
} from "@/packages/core/src/domain/voiceControls";

const PRESETS = ["Aria", "Nova", "Sage", "Echo"];

export function AssistantName({
  value,
  onChange,
}: {
  value: string;
  onChange: (name: string) => void;
}) {
  const { t } = useLanguage();
  const [draft, setDraft] = useState(value);

  const save = () => {
    const trimmed = draft.trim();
    if (trimmed) onChange(trimmed);
  };

  const reset = () => {
    setDraft(DEFAULT_ASSISTANT_NAME);
    onChange(DEFAULT_ASSISTANT_NAME);
  };

  return (
    <div className="assistant-name">
      <p className="assistant-name-hint">{t("Give your assistant a name")}</p>

      <div className="assistant-name-presets">
        {PRESETS.map((name) => (
          <button
            key={name}
            type="button"
            className="assistant-name-preset"
            onClick={() => {
              setDraft(name);
              onChange(name);
            }}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="assistant-name-input">
        <input
          type="text"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={t("Custom name")}
          maxLength={MAX_ASSISTANT_NAME_CHARACTERS}
        />
        <button
          type="button"
          className="assistant-name-save"
          onClick={save}
          disabled={!draft.trim() || draft.trim() === value}
        >
          {t("Save")}
        </button>
        {value !== DEFAULT_ASSISTANT_NAME && (
          <button
            type="button"
            className="assistant-name-reset"
            onClick={reset}
          >
            {t("Reset")}
          </button>
        )}
      </div>
    </div>
  );
}
