import type { MotionGestureId } from "../../../../packages/core/src/domain/motionGestures";

/** Shared explanatory copy, independent of the browser control component. */
export const MOTION_LEGEND: ReadonlyArray<{
  gesture: MotionGestureId;
  label: string;
  meaning: string;
}> = [
  {
    gesture: "right",
    label: "Swipe right",
    meaning: "Next question",
  },
  { gesture: "left", label: "Swipe left", meaning: "Previous question" },
  { gesture: "hold", label: "Wave in place", meaning: "Ask it" },
  { gesture: "up", label: "Swipe up", meaning: "Summarize the source" },
  { gesture: "down", label: "Swipe down", meaning: "Stop" },
];
