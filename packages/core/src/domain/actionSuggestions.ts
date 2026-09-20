import type { VoiceActionId } from './voiceCommands';

export type SuggestionContext = {
  sourceType: 'pdf' | 'youtube' | null;
  conversationState: 'idle' | 'active';
  lastAction: VoiceActionId | null;
  idleMs: number;
};

export type Suggestion = {
  action: VoiceActionId;
  label: string;
};

const IDLE_FADE_MS = 10_000;
const MAX_SUGGESTIONS = 3;

export function generateSuggestions(ctx: SuggestionContext): Suggestion[] {
  if (ctx.idleMs > IDLE_FADE_MS) return [];

  const suggestions: Suggestion[] = [];

  if (!ctx.sourceType) {
    suggestions.push({ action: 'upload', label: 'Upload file' });
    suggestions.push({ action: 'youtube', label: 'YouTube video' });
  }

  if (ctx.sourceType) {
    suggestions.push({ action: 'summarize', label: 'Summarize' });
    suggestions.push({ action: 'search', label: 'Search' });
  }

  if (ctx.conversationState === 'active') {
    suggestions.push({ action: 'back', label: 'Go back' });
  }

  if (ctx.sourceType) {
    suggestions.push({ action: 'open', label: 'Files' });
  }

  const filtered = suggestions.filter(s => s.action !== ctx.lastAction);
  return filtered.slice(0, MAX_SUGGESTIONS);
}
