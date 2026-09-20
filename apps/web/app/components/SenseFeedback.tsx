"use client";

import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/** Merged inputs share one contextual feedback stack above the experience. */
export function SenseFeedback({
  target,
  children,
}: {
  target?: HTMLElement | null;
  children: ReactNode;
}) {
  return target ? createPortal(children, target) : children;
}
