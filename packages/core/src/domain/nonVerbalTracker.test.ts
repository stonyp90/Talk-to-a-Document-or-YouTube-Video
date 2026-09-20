import { describe, it, expect } from 'vitest';
import { createNonVerbalTracker, NonVerbalSignal } from './nonVerbalTracker';

describe('NonVerbalTracker', () => {
  it('emits gesture events', () => {
    const tracker = createNonVerbalTracker();
    const events: NonVerbalSignal[] = [];
    tracker.on(event => events.push(event));

    tracker.recordMotion({
      gesture: 'right',
      energy: 0.42,
      moving: true,
    });

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('gesture');
  });

  it('emits mood events', () => {
    const tracker = createNonVerbalTracker();
    const events: NonVerbalSignal[] = [];
    tracker.on(event => events.push(event));

    tracker.recordMood('frustrated');

    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('mood');
  });

  it('caps session log at 500 entries', () => {
    const tracker = createNonVerbalTracker();
    for (let i = 0; i < 510; i++) {
      tracker.recordMotion({ gesture: 'right', energy: 0.3, moving: true });
    }
    expect(tracker.getLog().length).toBe(500);
  });

  it('removes listener', () => {
    const tracker = createNonVerbalTracker();
    const events: NonVerbalSignal[] = [];
    const listener = (e: NonVerbalSignal) => events.push(e);
    tracker.on(listener);
    tracker.off(listener);

    tracker.recordMotion({ gesture: 'left', energy: 0.2, moving: true });
    expect(events).toHaveLength(0);
  });
});
