import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "ursly-voice-speed-v1";
const MIN = 0.5;
const MAX = 1.5;
const STEP = 0.1;
const DEFAULT = 1.0;

let cached: number | undefined;

function read(): number {
  if (cached !== undefined) return cached;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw !== null) {
        const parsed = Number.parseFloat(raw);
        if (Number.isFinite(parsed)) {
          cached = Math.min(MAX, Math.max(MIN, parsed));
          return cached;
        }
      }
    } catch {
      /* Storage denied or unavailable. */
    }
  }
  cached = DEFAULT;
  return cached;
}

function write(value: number): void {
  const clamped = Math.min(MAX, Math.max(MIN, Math.round(value / STEP) * STEP));
  cached = clamped;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      /* Storage denied or unavailable. */
    }
  }
  window.dispatchEvent(new Event("ursly-voice-speed-change"));
}

function subscribe(notify: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) {
      cached = undefined;
      notify();
    }
  };
  const onCustom = () => {
    cached = undefined;
    notify();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener("ursly-voice-speed-change", onCustom);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener("ursly-voice-speed-change", onCustom);
  };
}

export function useVoiceSpeed(): {
  speed: number;
  setSpeed: (s: number) => void;
  min: number;
  max: number;
  step: number;
} {
  const speed = useSyncExternalStore(subscribe, read, () => DEFAULT);
  const setSpeed = useCallback((s: number) => write(s), []);
  return { speed, setSpeed, min: MIN, max: MAX, step: STEP };
}
