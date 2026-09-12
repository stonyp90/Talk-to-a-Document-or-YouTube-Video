"use client";

import {
  useEffect,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
} from "react";
import styles from "./Process.module.css";
import {
  INNER_LOOP_STEP,
  PROCESS_STEP_IDS,
  resolveProcessCopy,
  type ProcessStepId,
} from "../content/process";

export type LoopTiming = {
  /** How long the traveller rests on a stage. */
  holdMs: number;
  /** How long it takes to reach the next stage. */
  travelMs: number;
  /** The training stage holds longer: its own loop must close first. */
  innerLoopMultiplier: number;
};
export const LOOP_TIMING: LoopTiming = {
  holdMs: 2600,
  travelMs: 1100,
  innerLoopMultiplier: 2,
};

const COUNT = PROCESS_STEP_IDS.length;
/** Turns on the training loop: every model provider's best model, in turn. */
export const PROVIDER_TURNS = 3;
const INNER_INDEX = PROCESS_STEP_IDS.indexOf(INNER_LOOP_STEP);
const STEP_DEGREES = 360 / COUNT;

/** Everything is drawn in one viewBox so it scales as a single picture. */
const GEOMETRY = {
  width: 600,
  height: 520,
  cx: 300,
  cy: 260,
  ring: 168,
  node: 19,
  label: 214,
  innerLabel: 234,
  satellite: 31,
  disc: 104,
};

/**
 * The furthest the picture reaches from its centre: the ring, plus whichever
 * is wider at a stage — the node itself or the training satellite around it —
 * plus a hair for the stroke that sits on that edge.
 */
const PLOT_REACH =
  GEOMETRY.ring + Math.max(GEOMETRY.node, GEOMETRY.satellite) + 2;
/**
 * Without their labels the stages sit in a frame of empty gutters. A phone
 * drops the labels, so the picture scales by this much to take that room
 * back, and still lands inside the viewBox.
 */
const PLOT_FILL = Math.min(GEOMETRY.width, GEOMETRY.height) / 2 / PLOT_REACH;

const ICONS: Record<ProcessStepId, string[]> = {
  concept: [
    "M9 18h6",
    "M10 21h4",
    "M12 3a6 6 0 0 0-3.5 10.9c.7.6 1 1.3 1 2.1h5c0-.8.3-1.5 1-2.1A6 6 0 0 0 12 3Z",
  ],
  plan: [
    "M8 6h12",
    "M8 12h12",
    "M8 18h12",
    "M4 6h.01",
    "M4 12h.01",
    "M4 18h.01",
  ],
  tools: ["m12 3-9 5 9 5 9-5-9-5Z", "m3 13 9 5 9-5", "m3 18 9 5 9-5"],
  local: ["M4 5a1 1 0 0 1 1-1h14a1 1 0 0 1 1 1v11H4V5Z", "M2 19h20"],
  test: ["M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z", "m8.5 12 2.5 2.5 4.5-5"],
  secure: ["M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6l-8-3Z", "m9 12 2 2 4-4"],
  deliver: [
    "M18.2 8.2a3.8 3.8 0 1 1 0 7.6c-3.8 0-8.6-7.6-12.4-7.6a3.8 3.8 0 1 0 0 7.6c3.8 0 8.6-7.6 12.4-7.6Z",
  ],
  production: ["M7 17 17 7", "M8 7h9v9"],
  listen: ["M4 5h16v11H9l-5 4V5Z"],
  train: [
    "M4 12a8 8 0 0 1 14-5.3",
    "M18 3v4h-4",
    "M20 12a8 8 0 0 1-14 5.3",
    "M6 21v-4h4",
  ],
};

function point(degrees: number, radius: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: GEOMETRY.cx + radius * Math.cos(radians),
    y: GEOMETRY.cy + radius * Math.sin(radians),
  };
}

/** Labels sit outside the ring and lean away from it. */
function labelPlacement(degrees: number) {
  const cos = Math.cos((degrees * Math.PI) / 180);
  const sin = Math.sin((degrees * Math.PI) / 180);
  if (Math.abs(cos) < 0.2)
    return sin < 0
      ? { anchor: "middle" as const, baseline: "auto" as const, dy: -4 }
      : { anchor: "middle" as const, baseline: "hanging" as const, dy: 4 };
  return cos > 0
    ? { anchor: "start" as const, baseline: "middle" as const, dy: 0 }
    : { anchor: "end" as const, baseline: "middle" as const, dy: 0 };
}

const NODES = PROCESS_STEP_IDS.map((id, index) => {
  const degrees = -90 + index * STEP_DEGREES;
  const inner = index === INNER_INDEX;
  return {
    id,
    index,
    degrees,
    ...point(degrees, GEOMETRY.ring),
    label: point(degrees, inner ? GEOMETRY.innerLabel : GEOMETRY.label),
    placement: labelPlacement(degrees),
    inner,
  };
});

/** Where each provider sits on the training loop; the satellite passes them in turn. */
const PROVIDERS = Array.from({ length: PROVIDER_TURNS }, (_, index) => {
  const radians = ((-90 + (index * 360) / PROVIDER_TURNS) * Math.PI) / 180;
  return {
    index,
    dx: GEOMETRY.satellite * Math.cos(radians),
    dy: GEOMETRY.satellite * Math.sin(radians),
  };
});

/** The comet: a dot with a fading trail, all rotated together. */
const TRAIL = [
  { lag: 0, radius: 7, opacity: 1 },
  { lag: 5, radius: 5.5, opacity: 0.6 },
  { lag: 9, radius: 4.5, opacity: 0.45 },
  { lag: 13, radius: 3.5, opacity: 0.32 },
  { lag: 17, radius: 2.6, opacity: 0.22 },
  { lag: 21, radius: 1.8, opacity: 0.14 },
].map((dot) => ({ ...dot, ...point(-90 - dot.lag, GEOMETRY.ring) }));

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

export function Process({
  locale,
  timing = LOOP_TIMING,
}: {
  locale?: string;
  timing?: LoopTiming;
}) {
  const copy = resolveProcessCopy(locale);
  const [walk, dispatch] = useReducer(walkReducer, INITIAL_WALK);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const reduced = useSyncExternalStore(
    subscribeToMotionPreference,
    readsReducedMotion,
    () => false,
  );
  const { holdMs, travelMs, innerLoopMultiplier } = timing;
  const innerHoldMs = holdMs * innerLoopMultiplier;
  const autoplay = playing && inView && !reduced;

  // Motion only while the picture is on screen: off screen it is noise, and
  // the page promises that decorative motion settles.
  useEffect(() => {
    const element = stage.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.35 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

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

  function select(index: number) {
    dispatch({ type: "select", index });
    setPlaying(false);
  }
  function toggle() {
    if (playing) dispatch({ type: "settle" });
    setPlaying(!playing);
  }

  const angle = walk.position * STEP_DEGREES;
  const innerActive = walk.index === INNER_INDEX;
  const active = copy.steps[walk.index];
  const number = (index: number) => String(index + 1).padStart(2, "0");
  const diagramStyle = {
    "--loop-travel": `${travelMs}ms`,
    "--loop-inner": `${innerHoldMs}ms`,
    "--plot-fill": PLOT_FILL.toFixed(3),
  } as CSSProperties;

  return (
    <section
      className={styles.section}
      id="how-we-build"
      aria-labelledby="how-we-build-heading"
    >
      <div className={styles.layout}>
        <div className={styles.copy}>
          <span className="eyebrow">{copy.eyebrow}</span>
          <h2 id="how-we-build-heading" className={styles.heading}>
            {copy.heading.lead}
            <span>{copy.heading.accent}</span>
            {copy.heading.trail}
          </h2>
          <p className={styles.intro}>{copy.intro}</p>
          <p className={styles.quote}>{copy.quote}</p>
        </div>

        <div className={styles.stage} ref={stage}>
          {/* The list below carries the words; the picture is for the eye. */}
          <svg
            className={styles.diagram}
            viewBox={`0 0 ${GEOMETRY.width} ${GEOMETRY.height}`}
            style={diagramStyle}
            data-testid="loop-diagram"
            data-angle={angle}
            data-inner-loop={innerActive ? "active" : "idle"}
            aria-hidden="true"
            focusable="false"
          >
            {/* One group for the whole picture, so a phone can scale it into
                the room its hidden labels leave behind. */}
            <g className={styles.plot}>
              <circle
                className={styles.ring}
                cx={GEOMETRY.cx}
                cy={GEOMETRY.cy}
                r={GEOMETRY.ring}
              />
              <circle
                className={styles.discHalo}
                cx={GEOMETRY.cx}
                cy={GEOMETRY.cy}
                r={GEOMETRY.disc + 12}
              />
              <circle
                className={styles.disc}
                cx={GEOMETRY.cx}
                cy={GEOMETRY.cy}
                r={GEOMETRY.disc}
              />
              <text
                className={styles.discEyebrow}
                x={GEOMETRY.cx}
                y={GEOMETRY.cy - 36}
                textAnchor="middle"
              >
                {copy.target.eyebrow}
              </text>
              <text
                className={styles.discStatement}
                x={GEOMETRY.cx}
                y={GEOMETRY.cy - 6}
                textAnchor="middle"
              >
                {copy.target.statement.map((line, index) => (
                  <tspan key={line} x={GEOMETRY.cx} dy={index === 0 ? 0 : 22}>
                    {line}
                  </tspan>
                ))}
              </text>
              <text
                className={styles.discNote}
                x={GEOMETRY.cx}
                y={GEOMETRY.cy + 52}
                textAnchor="middle"
              >
                {copy.target.note}
              </text>

              <g
                className={styles.traveller}
                style={{ transform: `rotate(${angle}deg)` }}
              >
                {TRAIL.map((dot) => (
                  <circle
                    key={dot.lag}
                    className={styles.comet}
                    cx={dot.x}
                    cy={dot.y}
                    r={dot.radius}
                    opacity={dot.opacity}
                  />
                ))}
              </g>

              {NODES.map((node) => (
                <g
                  key={node.id}
                  className={styles.node}
                  data-active={node.index === walk.index}
                  onClick={() => select(node.index)}
                >
                  {node.inner && (
                    <>
                      <circle
                        className={styles.satelliteRing}
                        cx={node.x}
                        cy={node.y}
                        r={GEOMETRY.satellite}
                      />
                      {PROVIDERS.map((provider) => (
                        <circle
                          key={provider.index}
                          className={styles.providerDot}
                          data-provider={provider.index}
                          style={{
                            animationDelay: `calc(var(--loop-inner) * ${provider.index} / ${PROVIDER_TURNS})`,
                          }}
                          cx={node.x + provider.dx}
                          cy={node.y + provider.dy}
                          r={3.2}
                        />
                      ))}
                      <g
                        className={styles.satellite}
                        style={{
                          transform: `rotate(${walk.innerTurns * 360}deg)`,
                          transformOrigin: `${node.x}px ${node.y}px`,
                        }}
                      >
                        <circle
                          className={styles.satelliteDot}
                          cx={node.x}
                          cy={node.y - GEOMETRY.satellite}
                          r={4}
                        />
                      </g>
                    </>
                  )}
                  <circle
                    className={styles.nodeDisc}
                    cx={node.x}
                    cy={node.y}
                    r={GEOMETRY.node}
                  />
                  <svg
                    x={node.x - 10}
                    y={node.y - 10}
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {ICONS[node.id].map((path) => (
                      <path key={path} d={path} />
                    ))}
                  </svg>
                  <text
                    className={styles.label}
                    x={node.label.x}
                    y={node.label.y + node.placement.dy}
                    textAnchor={node.placement.anchor}
                    dominantBaseline={node.placement.baseline}
                  >
                    {copy.steps[node.index].title}
                  </text>
                </g>
              ))}
            </g>
          </svg>

          {/* The disc draws the mission, and the drawing is aria-hidden, so on
              its own it never reaches a screen reader. Here the same words are
              real text: carried for assistive technology while the disc still
              shows them, and the visible copy on a phone, where the disc's
              type would render at a third of its size. */}
          <div className={styles.target}>
            <span className={styles.targetEyebrow}>{copy.target.eyebrow}</span>
            <p className={styles.targetStatement}>
              {copy.target.statement.join(" ")}
            </p>
            <span className={styles.targetNote}>{copy.target.note}</span>
          </div>
        </div>

        {/* The picture's readout: where the traveller is, and the control for
            it. It sits under the copy, so the column runs to the ring's foot
            instead of stopping mid-argument. */}
        <div className={styles.legend}>
          <p className={styles.caption} key={walk.index} aria-hidden="true">
            <span className={styles.captionNumber}>{number(walk.index)}</span>{" "}
            <b>{active.title}.</b> <i>{active.summary}</i>
          </p>
          <div className={styles.controls}>
            {!reduced && (
              <button
                type="button"
                className={`secondary ${styles.toggle}`}
                onClick={toggle}
              >
                {playing ? copy.controls.pause : copy.controls.play}
              </button>
            )}
            <p className={styles.innerLoopNote}>{copy.innerLoop}</p>
          </div>
        </div>

        <ol className={styles.steps} aria-label={copy.controls.stepList}>
          {copy.steps.map((step, index) => (
            <li key={step.id} className={styles.step}>
              <button
                type="button"
                aria-current={index === walk.index ? "step" : undefined}
                onClick={() => select(index)}
              >
                <span className={styles.stepNumber}>{number(index)}</span>
                <span className={styles.stepTitle}>{step.title}</span>
                <span className={styles.stepSummary}>{step.summary}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className={styles.mission}>
        <div className={styles.missionCopy}>
          <span className="eyebrow">{copy.mission.eyebrow}</span>
          <h3>{copy.mission.heading}</h3>
          <p>{copy.mission.body}</p>
        </div>
        <div className={styles.missionActions}>
          <a className={`primary ${styles.missionAction}`} href="#workspace">
            {copy.mission.primary}
          </a>
          <a
            className={`secondary ${styles.missionAction}`}
            href="#applications"
          >
            {copy.mission.secondary}
          </a>
        </div>
      </div>
    </section>
  );
}
