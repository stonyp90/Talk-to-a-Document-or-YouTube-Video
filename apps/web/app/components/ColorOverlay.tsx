"use client";

import type { NonVerbalSignal } from "@talk/core/domain/nonVerbalTracker";
import styles from "./ColorOverlay.module.css";

export function signalToColor(signal: NonVerbalSignal): string {
  switch (signal.kind) {
    case "movement":
      return signal.energy > 0.4 ? "orange" : "blue";
    case "mood":
      if (signal.mood === "frustrated") return "red";
      if (signal.mood === "curious") return "cyan";
      return "blue";
    case "distance":
      return signal.estimate === "close" ? "warm" : "cool";
    case "gesture":
      return signal.energy > 0.4 ? "orange" : "blue";
    default:
      return "blue";
  }
}

const COLOR_MAP: Record<string, string> = {
  blue: "var(--plasma-cyan, #00f0ff)",
  orange: "var(--accent-glow)",
  red: "var(--danger)",
  warm: "var(--accent)",
  cool: "var(--plasma-cyan, #00f0ff)",
  cyan: "var(--plasma-cyan, #00f0ff)",
};

interface ColorOverlayProps {
  signals: NonVerbalSignal[];
}

export function ColorOverlay({ signals }: ColorOverlayProps) {
  if (signals.length === 0) return null;

  const latest = signals[signals.length - 1];
  const colorName = signalToColor(latest);
  const color = COLOR_MAP[colorName] || COLOR_MAP.blue;

  return (
    <div
      className={styles.overlay}
      style={{ "--overlay-color": color } as React.CSSProperties}
      aria-hidden="true"
    />
  );
}
