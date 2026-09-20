"use client";

import type { NonVerbalSignal } from "@talk/core/domain/nonVerbalTracker";
import styles from "./NonVerbalLog.module.css";

export function formatSignal(signal: NonVerbalSignal): string {
  const time = signal.at.toLocaleTimeString("en-CA", { hour12: false });
  switch (signal.kind) {
    case "gesture":
      return `${time}  Swipe ${signal.gesture} (energy: ${signal.energy.toFixed(2)})`;
    case "mood":
      return `${time}  Mood: ${signal.mood}`;
    case "movement":
      return `${time}  Movement (energy: ${signal.energy.toFixed(2)})`;
    case "distance":
      return `${time}  Distance: ${signal.estimate}`;
  }
}

interface NonVerbalLogProps {
  signals: readonly NonVerbalSignal[];
}

export function NonVerbalLog({ signals }: NonVerbalLogProps) {
  if (signals.length === 0) {
    return <p className={styles.empty}>No signals recorded</p>;
  }

  return (
    <div className={styles.log} role="log" aria-label="Non-verbal signal log">
      {[...signals].reverse().map((signal, i) => (
        <div key={`${signal.at.getTime()}-${i}`} className={styles.entry}>
          {formatSignal(signal)}
        </div>
      ))}
    </div>
  );
}
