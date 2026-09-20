"use client";

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

/**
 * Maps a motion gesture (after hand-mirroring) to a file navigation action.
 * Exported for testability and for use by integration code (Task 22).
 */
export function gestureToNavAction(
  gesture: MotionGestureId,
  handPreference: HandPreference,
): FileNavAction | null {
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
}

/**
 * Debounce window in milliseconds. Two gestures within this window collapse
 * into the first; the second is dropped.
 */
export const GESTURE_DEBOUNCE_MS = 300;

/**
 * Returns true if a gesture at `now` should be accepted given the last
 * accepted gesture timestamp. Pure function for testability.
 */
export function isGestureAccepted(
  now: number,
  lastAcceptedAt: number,
): boolean {
  return now - lastAcceptedAt >= GESTURE_DEBOUNCE_MS;
}

interface GestureFileBrowserProps {
  open: boolean;
  fs: FileSystemPort;
  rootId: string;
  handPreference: HandPreference;
  onClose: () => void;
  onFileSelect: (node: FileNode) => void;
  motionGesture?: MotionGestureId | null;
  gaze?: { x: number; y: number } | null;
}

/**
 * Wraps ImmersiveFileBrowser with gesture-aware input.
 *
 * Converts motion gestures (MotionGestureId) to file navigation actions
 * via gestureToNavAction and dispatches them through ImmersiveFileBrowser's
 * motionGesture prop.
 */
export function GestureFileBrowser({
  open,
  fs,
  rootId,
  handPreference,
  onClose,
  onFileSelect,
  motionGesture,
  gaze,
}: GestureFileBrowserProps) {
  const navAction =
    motionGesture != null
      ? gestureToNavAction(motionGesture, handPreference)
      : null;

  if (!open) return null;

  return (
    <div className={styles.gestureBrowser}>
      <ImmersiveFileBrowser
        open={open}
        fs={fs}
        rootId={rootId}
        onClose={onClose}
        onFileSelect={onFileSelect}
        motionGesture={navAction}
        gaze={gaze}
      />
    </div>
  );
}
