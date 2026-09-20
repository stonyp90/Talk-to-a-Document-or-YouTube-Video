// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFeedback } from './useFeedback';

describe('useFeedback', () => {
  it('starts with empty events', () => {
    const { result } = renderHook(() => useFeedback());
    expect(result.current.events).toEqual([]);
  });

  it('adds info event', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.emitInfo('Test message');
    });
    expect(result.current.events).toHaveLength(1);
    expect(result.current.events[0].message).toBe('Test message');
  });

  it('dismisses event', () => {
    const { result } = renderHook(() => useFeedback());
    act(() => {
      result.current.emitInfo('Test');
    });
    const eventId = result.current.events[0].timestamp.getTime();
    act(() => {
      result.current.dismissEvent(eventId);
    });
    expect(result.current.events).toHaveLength(0);
  });
});
