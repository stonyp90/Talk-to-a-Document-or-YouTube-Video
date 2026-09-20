import type { TiltAction } from "./senseSession";

export type SenseTestInput =
  { type: "voice"; text: string } | { type: "motion"; action: TiltAction };

/** Deterministic injection port. Its UI adapter is limited to explicit development builds. */
export function createSenseTestBus() {
  const listeners = new Set<(input: SenseTestInput) => void>();
  return {
    subscribe(listener: (input: SenseTestInput) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    emit(input: SenseTestInput) {
      for (const listener of listeners) listener(input);
    },
  };
}
