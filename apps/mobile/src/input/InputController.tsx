import React, { useMemo } from "react";
import { useVoiceInput } from "./useVoiceInput";
import { useMotionInput } from "./useMotionInput";
import { useGazeInput } from "./useGazeInput";
import { resolveIntention, type InputSignals, type SceneAction, type GestureSignal } from "./intentionResolver";
import type { Planet } from "../scene/useGalaxyState";

export function InputController({
  planets,
  transcript,
  onAction,
  onGestureSignal,
}: {
  planets: Planet[];
  transcript: string;
  onAction: (action: SceneAction) => void;
  onGestureSignal: (signal: GestureSignal) => void;
}) {
  const voiceCommand = useVoiceInput(transcript);
  const _motionOffset = useMotionInput(true);
  const gazeSignal = useGazeInput(true, planets, screenToPlanet);

  const signals: InputSignals = useMemo(
    () => ({ voiceCommand, gaze: gazeSignal }),
    [voiceCommand, gazeSignal],
  );

  const action = resolveIntention(signals);
  if (action) onAction(action);

  return null;
}

function screenToPlanet(_gazeX: number, _gazeY: number): string | null {
  return null;
}
