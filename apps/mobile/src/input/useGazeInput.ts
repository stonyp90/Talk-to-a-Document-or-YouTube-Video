import { useRef, useEffect, useState } from "react";
import {
  createSimulatedFaceDetector,
} from "../faceTracking";
import type { GazeSignal } from "./intentionResolver";
import type { Planet } from "../scene/useGalaxyState";

const DWELL_THRESHOLD_MS = 1500;

export function useGazeInput(
  enabled: boolean,
  _planets: Planet[],
  screenToPlanet: (gazeX: number, gazeY: number) => string | null,
): GazeSignal | undefined {
  const detector = useRef(createSimulatedFaceDetector());
  const dwellStart = useRef<number | null>(null);
  const lastPlanet = useRef<string | null>(null);
  const [signal, setSignal] = useState<GazeSignal | undefined>();

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      const detection = detector.current.detect();
      if (!detection) return;

      const gazeX = detection.landmarks.noseTip.x;
      const gazeY = detection.landmarks.noseTip.y;
      const planetId = screenToPlanet(gazeX, gazeY);

      if (planetId && planetId === lastPlanet.current) {
        const elapsed = Date.now() - (dwellStart.current ?? Date.now());
        if (elapsed >= DWELL_THRESHOLD_MS) {
          setSignal({ type: "dwell-select", planetId });
        } else {
          setSignal({ type: "looking-at", planetId });
        }
      } else {
        dwellStart.current = planetId ? Date.now() : null;
        lastPlanet.current = planetId;
        setSignal(planetId ? { type: "looking-at", planetId } : undefined);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [enabled, _planets, screenToPlanet]);

  return signal;
}
