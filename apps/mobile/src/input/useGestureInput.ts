import { Gesture } from "react-native-gesture-handler";
import type { GestureSignal } from "./intentionResolver";

type PlanetHitTest = (x: number, y: number) => string | null;

export function useGestureInput(
  planetHitTest: PlanetHitTest,
  onSignal: (signal: GestureSignal) => void,
) {
  const tap = Gesture.Tap().onEnd((event) => {
    const planetId = planetHitTest(event.x, event.y);
    if (planetId) {
      onSignal({ type: "tap-planet", planetId });
    } else {
      onSignal({ type: "tap-empty" });
    }
  });

  const pan = Gesture.Pan()
    .minDistance(10)
    .onUpdate((event) => {
      onSignal({ type: "orbit", delta: event.translationX * 0.005 });
    });

  const pinch = Gesture.Pinch().onUpdate((event) => {
    onSignal({ type: "zoom", factor: event.scale });
  });

  return Gesture.Simultaneous(tap, Gesture.Simultaneous(pan, pinch));
}
