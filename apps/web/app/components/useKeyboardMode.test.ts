// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKeyboardMode } from './useKeyboardMode';

describe('useKeyboardMode', () => {
  it('starts disabled', () => {
    const { result } = renderHook(() => useKeyboardMode());
    expect(result.current.enabled).toBe(false);
  });

  it('can be enabled', () => {
    const { result } = renderHook(() => useKeyboardMode());
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
  });

  it('parses /upload command', () => {
    const { result } = renderHook(() => useKeyboardMode());
    const cmd = result.current.parseSlashcommand('/upload');
    expect(cmd).toEqual({ action: 'upload', argument: undefined });
  });

  it('parses /youtube with argument', () => {
    const { result } = renderHook(() => useKeyboardMode());
    const cmd = result.current.parseSlashcommand('/youtube https://youtube.com/watch?v=abc');
    expect(cmd).toEqual({ action: 'youtube', argument: 'https://youtube.com/watch?v=abc' });
  });

  it('returns null for unknown command', () => {
    const { result } = renderHook(() => useKeyboardMode());
    const cmd = result.current.parseSlashcommand('/unknown');
    expect(cmd).toBeNull();
  });

  it('returns null for non-command text', () => {
    const { result } = renderHook(() => useKeyboardMode());
    const cmd = result.current.parseSlashcommand('hello world');
    expect(cmd).toBeNull();
  });
});
