"use client";

import styles from "./DistanceRing.module.css";

interface DistanceRingProps {
  estimate: "close" | "medium" | "far" | null;
}

export function DistanceRing({ estimate }: DistanceRingProps) {
  if (!estimate) return null;

  return (
    <div
      className={`${styles.ring} ${styles[estimate]}`}
      aria-hidden="true"
    />
  );
}
