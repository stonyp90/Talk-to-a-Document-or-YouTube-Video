"use client";

import type { VoiceActionId } from "@talk/core/domain/voiceCommands";
import type { Suggestion } from "@talk/core/domain/actionSuggestions";
import styles from "./SuggestionStrip.module.css";

interface SuggestionStripProps {
  suggestions: Suggestion[];
  onAction: (action: VoiceActionId) => void;
}

export function SuggestionStrip({ suggestions, onAction }: SuggestionStripProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className={styles.strip}>
      {suggestions.map((s) => (
        <button
          key={s.action}
          className={styles.chip}
          onClick={() => onAction(s.action)}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
