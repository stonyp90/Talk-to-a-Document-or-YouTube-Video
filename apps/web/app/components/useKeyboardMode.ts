"use client";

import { useState, useCallback } from 'react';
import type { VoiceActionId } from '@talk/core/domain/voiceCommands';

type SlashCommand = { action: VoiceActionId; argument?: string };

const SLASH_COMMANDS: Record<string, VoiceActionId> = {
  '/upload': 'upload',
  '/summarize': 'summarize',
  '/back': 'back',
  '/youtube': 'youtube',
  '/search': 'search',
  '/clear': 'stop',
  '/settings': 'open',
  '/files': 'open',
};

export function useKeyboardMode() {
  const [enabled, setEnabled] = useState(false);

  const parseSlashcommand = useCallback((input: string): SlashCommand | null => {
    const trimmed = input.trim();
    if (!trimmed.startsWith('/')) return null;

    const spaceIdx = trimmed.indexOf(' ');
    const commandPart = spaceIdx === -1 ? trimmed : trimmed.slice(0, spaceIdx);
    const argumentPart = spaceIdx === -1 ? undefined : trimmed.slice(spaceIdx + 1).trim() || undefined;

    const action = SLASH_COMMANDS[commandPart];
    if (!action) return null;

    return { action, argument: argumentPart };
  }, []);

  return { enabled, setEnabled, parseSlashcommand };
}
