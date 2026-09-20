"use client";

import { useCallback, useRef, useEffect } from "react";
import ImmersiveFileBrowser from "./ImmersiveFileBrowser";
import type {
  FileNode,
  FileSystemPort,
} from "@/packages/core/src/domain/fileSystem";
import type { MotionGestureId } from "@/packages/core/src/domain/motionGestures";
import type { FileNavAction } from "@/packages/core/src/domain/fileNavigation";
import styles from "./GestureFileBrowser.module.css";

type HandPreference = "left" | "right";

export function mirrorGesture(
  gesture: MotionGestureId,
  hand: HandPreference,
): MotionGestureId {
  if (hand !== "left") return gesture;
  if (gesture === "left") return "right";
  if (gesture === "right") return "left";
  return gesture;
}

interface GestureFileBrowserProps {
  open: boolean;
  fs: FileSystemPort;
  rootId: string;
  handPreference: HandPreference;
  onClose: () => void;
  onFileSelect: (node: FileNode) => void;
  motionGesture?: MotionGestureId | null;
}

export function GestureFileBrowser({
  open,
  fs,
  rootId,
  handPreference,
  onClose,
  onFileSelect,
  motionGesture,
}: GestureFileBrowserProps) {
  const lastGestureTime = useRef(0);
  const DEBOUNCE_MS = 300;

  const gestureToNavAction = useCallback(
    (gesture: MotionGestureId): FileNavAction | null => {
      const mirrored = mirrorGesture(gesture, handPreference);
      switch (mirrored) {
        case "up":
          return { type: "navigateUp" };
        case "down":
          return { type: "openSelected" };
        case "right":
          return { type: "next" };
        case "left":
          return { type: "prev" };
        case "hold":
          return { type: "openSelected" };
      }
    },
    [handPreference],
  );

  useEffect(() => {
    if (!motionGesture) return;
    const now = Date.now();
    if (now - lastGestureTime.current < DEBOUNCE_MS) return;
    lastGestureTime.current = now;
    // Gesture-to-nav dispatch is handled by the parent via navRef
  }, [motionGesture, gestureToNavAction]);

  if (!open) return null;

  return (
    <div className={styles.gestureBrowser}>
      <ImmersiveFileBrowser
        open={open}
        fs={fs}
        rootId={rootId}
        onClose={onClose}
        onFileSelect={onFileSelect}
      />
    </div>
  );
}
