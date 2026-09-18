"use client";

import { useEffect, useRef, useState } from "react";

type GazeDwellConfig = {
  gaze: { x: number; y: number } | null;
  itemCount: number;
  columns: number;
  dwellMs: number;
  onDwell?: (index: number) => void;
};

type GazeDwellResult = {
  hoveredIndex: number;
  progress: number;
};

export function useGazeDwell(config: GazeDwellConfig): GazeDwellResult {
  const { gaze, itemCount, columns, dwellMs, onDwell } = config;
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const dwellStart = useRef<number | null>(null);
  const lastIndex = useRef(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!gaze || itemCount === 0) {
      setHoveredIndex(-1);
      setProgress(0);
      dwellStart.current = null;
      lastIndex.current = -1;
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const rows = Math.ceil(itemCount / columns);
    const col = Math.floor(gaze.x * columns);
    const row = Math.floor(gaze.y * rows);
    const idx = row * columns + col;
    const clampedIdx = idx >= itemCount ? -1 : idx;

    if (clampedIdx !== lastIndex.current) {
      lastIndex.current = clampedIdx;
      dwellStart.current = clampedIdx >= 0 ? Date.now() : null;
      setHoveredIndex(clampedIdx);
      setProgress(0);
      if (timerRef.current) clearTimeout(timerRef.current);
    }

    if (clampedIdx >= 0 && dwellStart.current !== null) {
      const tick = () => {
        const elapsed = Date.now() - (dwellStart.current ?? 0);
        const p = Math.min(elapsed / dwellMs, 1);
        setProgress(p);
        if (p >= 1) {
          onDwell?.(clampedIdx);
          dwellStart.current = Date.now();
          timerRef.current = setTimeout(tick, 50);
        } else {
          timerRef.current = setTimeout(tick, 50);
        }
      };
      timerRef.current = setTimeout(tick, 50);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [gaze, itemCount, columns, dwellMs, onDwell]);

  return { hoveredIndex, progress };
}
