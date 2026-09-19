import React, { useCallback, useEffect, useMemo } from "react";
import { useVoiceInput } from "./useVoiceInput";
import { useMotionInput, type MotionOffset } from "./useMotionInput";
import { useGazeInput, type GazePosition } from "./useGazeInput";
import { screenToPlanet } from "./screenToPlanet";
import { resolveIntention, type InputSignals, type SceneAction, type GestureSignal } from "./intentionResolver";
import type { Planet } from "../scene/useGalaxyState";

export function InputController({
  planets,
  transcript,
  orbitAngle,
  onAction,
  onGestureSignal,
  onMotionOffset,
  onGazePosition,
}: {
  planets: Planet[];
  transcript: string;
  orbitAngle: number;
  onAction: (action: SceneAction) => void;
  onGestureSignal: (signal: GestureSignal) => void;
  onMotionOffset: (offset: MotionOffset) => void;
  onGazePosition?: (pos: GazePosition | null) => void;
}) {
  const voiceCommand = useVoiceInput(transcript, planets);
  const motionOffset = useMotionInput(true);

  useEffect(() => {
    onMotionOffset(motionOffset);
  }, [motionOffset, onMotionOffset]);

  const gazeHitTest = useCallback(
    (x: number, y: number) => screenToPlanet(x, y, orbitAngle),
    [orbitAngle],
  );
  const gazeSignal = useGazeInput(true, planets, gazeHitTest, onGazePosition);

  const signals: InputSignals = useMemo(
    () => ({ voiceCommand, gaze: gazeSignal }),
    [voiceCommand, gazeSignal],
  );

  const action = resolveIntention(signals);

  useEffect(() => {
    if (action) onAction(action);
  }, [action, onAction]);

  return null;
}
