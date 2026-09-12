"use client";

import { useSyncExternalStore } from "react";

/** Nothing ever changes: the answer flips once, when React takes over. */
const NEVER_CHANGES = () => () => {};

/**
 * Whether React has attached its listeners to this page yet.
 *
 * A page is on screen before its script runs, and on a slow connection that
 * gap is seconds long. A control that only works through React is dead in
 * that gap, so it says so — `disabled` — rather than swallowing the tap.
 * False on the server and through hydration, true immediately after.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    NEVER_CHANGES,
    () => true,
    () => false,
  );
}
