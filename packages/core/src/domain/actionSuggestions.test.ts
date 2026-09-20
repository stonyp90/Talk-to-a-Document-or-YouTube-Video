import { describe, it, expect } from 'vitest';
import { generateSuggestions, type SuggestionContext } from './actionSuggestions';

describe('generateSuggestions', () => {
  it('returns upload-related suggestions when no source loaded', () => {
    const ctx: SuggestionContext = {
      sourceType: null,
      conversationState: 'idle',
      lastAction: null,
      idleMs: 0,
    };
    const suggestions = generateSuggestions(ctx);
    const ids = suggestions.map(s => s.action);
    expect(ids).toContain('upload');
    expect(ids).toContain('youtube');
  });

  it('returns summarize when source is loaded', () => {
    const ctx: SuggestionContext = {
      sourceType: 'pdf',
      conversationState: 'idle',
      lastAction: null,
      idleMs: 0,
    };
    const suggestions = generateSuggestions(ctx);
    const ids = suggestions.map(s => s.action);
    expect(ids).toContain('summarize');
  });

  it('returns back when in conversation', () => {
    const ctx: SuggestionContext = {
      sourceType: 'pdf',
      conversationState: 'active',
      lastAction: null,
      idleMs: 0,
    };
    const suggestions = generateSuggestions(ctx);
    const ids = suggestions.map(s => s.action);
    expect(ids).toContain('back');
  });

  it('returns empty when idle > 10s', () => {
    const ctx: SuggestionContext = {
      sourceType: null,
      conversationState: 'idle',
      lastAction: null,
      idleMs: 15000,
    };
    const suggestions = generateSuggestions(ctx);
    expect(suggestions).toHaveLength(0);
  });

  it('limits to 3 suggestions', () => {
    const ctx: SuggestionContext = {
      sourceType: 'pdf',
      conversationState: 'active',
      lastAction: 'summarize',
      idleMs: 0,
    };
    const suggestions = generateSuggestions(ctx);
    expect(suggestions.length).toBeLessThanOrEqual(3);
  });
});
