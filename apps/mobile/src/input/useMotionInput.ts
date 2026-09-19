import { useEffect, useRef, useState } from "react";
import { Accelerometer, Gyroscope, type Subscription } from "expo-sensors";

export type MotionOffset = { x: number; y: number };

export function useMotionInput(enabled: boolean): MotionOffset {
  const [offset, setOffset] = useState<MotionOffset>({ x: 0, y: 0 });
  const subs = useRef<Subscription[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const accelSub = Accelerometer.addListener((data) => {
      setOffset((prev) => ({
        x: clamp((data.x ?? 0) * 5, -5, 5),
        y: prev.y,
      }));
    });

    const gyroSub = Gyroscope.addListener((data) => {
      setOffset((prev) => ({
        x: prev.x,
        y: clamp((data.y ?? 0) * 5, -5, 5),
      }));
    });

    subs.current = [accelSub, gyroSub];
    Accelerometer.setUpdateInterval(50);
    Gyroscope.setUpdateInterval(50);

    return () => {
      subs.current.forEach((s) => s.remove());
      subs.current = [];
    };
  }, [enabled]);

  return offset;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
