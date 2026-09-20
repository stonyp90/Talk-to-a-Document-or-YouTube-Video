import type { MotionGestureId } from './motionGestures';

export type NonVerbalSignal =
  | { kind: 'gesture'; gesture: MotionGestureId; energy: number; at: Date }
  | { kind: 'mood'; mood: string; at: Date }
  | { kind: 'movement'; energy: number; at: Date }
  | { kind: 'distance'; estimate: 'close' | 'medium' | 'far'; at: Date };

type Listener = (signal: NonVerbalSignal) => void;

const MAX_LOG = 500;

export function createNonVerbalTracker() {
  const listeners: Listener[] = [];
  const log: NonVerbalSignal[] = [];

  function emit(signal: NonVerbalSignal) {
    log.push(signal);
    if (log.length > MAX_LOG) log.shift();
    listeners.forEach(l => l(signal));
  }

  return {
    on(listener: Listener) { listeners.push(listener); },
    off(listener: Listener) {
      const idx = listeners.indexOf(listener);
      if (idx >= 0) listeners.splice(idx, 1);
    },
    recordMotion(reading: { gesture?: MotionGestureId; energy: number; moving: boolean }) {
      if (reading.gesture) {
        emit({ kind: 'gesture', gesture: reading.gesture, energy: reading.energy, at: new Date() });
      } else if (reading.moving) {
        emit({ kind: 'movement', energy: reading.energy, at: new Date() });
      }
    },
    recordMood(mood: string) {
      emit({ kind: 'mood', mood, at: new Date() });
    },
    recordDistance(estimate: 'close' | 'medium' | 'far') {
      emit({ kind: 'distance', estimate, at: new Date() });
    },
    getLog(): readonly NonVerbalSignal[] { return log; },
    clearLog() { log.length = 0; },
  };
}
