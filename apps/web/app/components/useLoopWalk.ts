"use client";

import { useEffect, useReducer, useState, useSyncExternalStore } from "react";
import { INNER_LOOP_STEP, PROCESS_STEP_IDS } from "../content/process";

export type LoopTiming = {
  /** How long the traveller rests on a stage. */
  holdMs: number;
  /** How long it takes to reach the next stage. */
  travelMs: number;
  /** The training stage holds longer: its own loop must close first. */
  innerLoopMultiplier: number;
};
/*
 * The loop is the argument, so it has to be watchable: a full walk of the ten
 * stages used to take the better part of forty seconds, which is longer than
 * anyone stands at the top of a page. At this pace the whole lifecycle reads
 * in about half that, and the travel is quick enough that the eye follows the
 * dot from one stage to the next rather than losing it between them.
 */
export const LOOP_TIMING: LoopTiming = {
  holdMs: 1500,
  travelMs: 620,
  innerLoopMultiplier: 2,
};

const COUNT = PROCESS_STEP_IDS.length;
const INNER_INDEX = PROCESS_STEP_IDS.indexOf(INNER_LOOP_STEP);

type Walk = {
  /** The lit stage. */
  index: number;
  /** Stages travelled since mount; the dot only ever moves forward. */
  position: number;
  phase: "hold" | "travel";
  /** Times the training stage has been entered; spins its satellite. */
  innerTurns: number;
};
type WalkAction =
  | { type: "tick" }
  | { type: "settle" }
  | { type: "select"; index: number };

function land(walk: Walk, index: number, position: number): Walk {
  const entering = index === INNER_INDEX && walk.index !== INNER_INDEX;
  return {
    index,
    position,
    phase: "hold",
    innerTurns: walk.innerTurns + (entering ? 1 : 0),
  };
}
function settle(walk: Walk): Walk {
  return walk.phase === "travel"
    ? land(walk, (walk.index + 1) % COUNT, walk.position)
    : walk;
}
function walkReducer(walk: Walk, action: WalkAction): Walk {
  switch (action.type) {
    case "tick":
      return walk.phase === "hold"
        ? { ...walk, position: walk.position + 1, phase: "travel" }
        : settle(walk);
    case "settle":
      return settle(walk);
    case "select": {
      const settled = settle(walk);
      const delta = (action.index - settled.index + COUNT) % COUNT;
      return land(settled, action.index, settled.position + delta);
    }
  }
}
const INITIAL_WALK: Walk = {
  index: 0,
  position: 0,
  phase: "hold",
  innerTurns: 0,
};

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeToMotionPreference(notify: () => void) {
  if (typeof window.matchMedia !== "function") return () => {};
  const query = window.matchMedia(REDUCED_MOTION);
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", notify);
    return () => query.removeEventListener("change", notify);
  }
  query.addListener(notify);
  return () => query.removeListener(notify);
}
function readsReducedMotion() {
  return typeof window.matchMedia === "function"
    ? window.matchMedia(REDUCED_MOTION).matches
    : false;
}

export type Loop = {
  index: number;
  /** Stages travelled since mount, so the picture only ever turns forward. */
  position: number;
  innerTurns: number;
  innerActive: boolean;
  playing: boolean;
  reduced: boolean;
  timing: LoopTiming;
  select: (index: number) => void;
  toggle: () => void;
  /** Give this whatever holds the picture; it rests while off screen. */
  attach: (element: HTMLElement | null) => void;
};

/**
 * One walk around the build loop, owned above the components that show it:
 * the picture leads the page and the stages are listed further down, so both
 * read the same lit stage and either can move it.
 */
export function useLoopWalk(timing: LoopTiming = LOOP_TIMING): Loop {
  const [walk, dispatch] = useReducer(walkReducer, INITIAL_WALK);
  const [playing, setPlaying] = useState(true);
  const [onScreen, setOnScreen] = useState(false);
  const [stage, setStage] = useState<HTMLElement | null>(null);
  const reduced = useSyncExternalStore(
    subscribeToMotionPreference,
    readsReducedMotion,
    () => false,
  );
  const { holdMs, travelMs, innerLoopMultiplier } = timing;
  const innerHoldMs = holdMs * innerLoopMultiplier;

  // Motion only while the picture is on screen: off screen it is noise, and
  // the page promises that decorative motion settles. Where nothing can be
  // observed -- no element yet, or no observer at all -- the walk runs.
  const watched = stage !== null && typeof IntersectionObserver !== "undefined";
  const inView = watched ? onScreen : true;
  const autoplay = playing && inView && !reduced;

  useEffect(() => {
    if (!watched || !stage) return;
    const observer = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(stage);
    return () => observer.disconnect();
  }, [stage, watched]);

  useEffect(() => {
    if (!autoplay) return;
    const delay =
      walk.phase === "travel"
        ? travelMs
        : walk.index === INNER_INDEX
          ? innerHoldMs
          : holdMs;
    const timer = setTimeout(() => dispatch({ type: "tick" }), delay);
    return () => clearTimeout(timer);
  }, [autoplay, walk.phase, walk.index, holdMs, travelMs, innerHoldMs]);

  return {
    index: walk.index,
    position: walk.position,
    innerTurns: walk.innerTurns,
    innerActive: walk.index === INNER_INDEX,
    playing,
    reduced,
    timing,
    select(index: number) {
      dispatch({ type: "select", index });
      setPlaying(false);
    },
    toggle() {
      if (playing) dispatch({ type: "settle" });
      setPlaying(!playing);
    },
    attach: setStage,
  };
}
