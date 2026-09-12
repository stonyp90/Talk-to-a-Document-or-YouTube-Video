"use client";

import { useEffect, type CSSProperties } from "react";
import styles from "./LoopDiagram.module.css";
import { useLoopNarration } from "./useLoopNarration";
import type { Loop } from "./useLoopWalk";
import {
  PROCESS_STEP_IDS,
  resolveProcessCopy,
  type ProcessStepId,
} from "../content/process";

const COUNT = PROCESS_STEP_IDS.length;
/** Turns on the training loop: every model provider's best model, in turn. */
export const PROVIDER_TURNS = 3;
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

/**
 * Trigonometry to a fixed number of places.
 *
 * The last bit of a double does not always survive being printed on the server
 * and re-read in the browser, and an attribute that differs by that bit is a
 * hydration mismatch React refuses to patch: the whole tree is thrown away and
 * drawn again. Rounding here costs nothing anyone can see at this scale and
 * makes the two renders identical strings.
 */
const place = (value: number) => Math.round(value * 1000) / 1000;

function point(degrees: number, radius: number) {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: place(GEOMETRY.cx + radius * Math.cos(radians)),
    y: place(GEOMETRY.cy + radius * Math.sin(radians)),
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

const INNER_INDEX = PROCESS_STEP_IDS.indexOf("train");

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

/**
 * A chevron on the track between every pair of stages, pointing the way the
 * walk goes. Without them the ring is a diagram of ten things; with them it is
 * a cycle, and a reader who has never been told what a development lifecycle
 * is can see that it comes back round to the beginning.
 */
const ARROWS = PROCESS_STEP_IDS.map((_, index) => {
  const degrees = -90 + (index + 0.5) * STEP_DEGREES;
  const at = point(degrees, GEOMETRY.ring);
  return {
    index,
    ...at,
    /** Tangent to the ring at that point, so the chevron lies along the track. */
    rotation: place(degrees + 90),
  };
});

/** Where each provider sits on the training loop; the satellite passes them in turn. */
const PROVIDERS = Array.from({ length: PROVIDER_TURNS }, (_, index) => {
  const radians = ((-90 + (index * 360) / PROVIDER_TURNS) * Math.PI) / 180;
  return {
    index,
    dx: place(GEOMETRY.satellite * Math.cos(radians)),
    dy: place(GEOMETRY.satellite * Math.sin(radians)),
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

/**
 * The loop, drawn. It opens the page because the loop is the argument: the
 * words for each stage are listed further down, and both read the one walk
 * they are given, so a stage picked in either place is lit in both.
 */
export function LoopDiagram({ locale, loop }: { locale?: string; loop: Loop }) {
  const copy = resolveProcessCopy(locale);
  const { index, position, innerTurns, innerActive, playing, reduced, attach } =
    loop;
  const narration = useLoopNarration(locale ?? "en");
  const { holdMs, travelMs, innerLoopMultiplier } = loop.timing;
  const innerHoldMs = holdMs * innerLoopMultiplier;
  const angle = position * STEP_DEGREES;
  const active = copy.steps[index];
  // Each stage names itself as the walk reaches it, once, and only while a
  // reader has asked to hear it.
  const { say, speaking } = narration;
  useEffect(() => {
    if (speaking) say(`${active.title}. ${active.summary}`);
  }, [say, speaking, active.title, active.summary]);
  const number = String(index + 1).padStart(2, "0");
  const diagramStyle = {
    "--loop-travel": `${travelMs}ms`,
    "--loop-inner": `${innerHoldMs}ms`,
  } as CSSProperties;

  return (
    <div className={styles.stage} ref={attach}>
      {/* The list further down carries the words; this is for the eye. */}
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
        <circle
          className={styles.ring}
          cx={GEOMETRY.cx}
          cy={GEOMETRY.cy}
          r={GEOMETRY.ring}
        />
        {ARROWS.map((arrow) => (
          <path
            key={arrow.index}
            className={styles.arrow}
            d="M -4 -5 L 3 0 L -4 5"
            data-passed={arrow.index < index}
            transform={`translate(${arrow.x} ${arrow.y}) rotate(${arrow.rotation})`}
          />
        ))}
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
            data-stage={node.id}
            data-active={node.index === index}
            onClick={() => loop.select(node.index)}
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
                    transform: `rotate(${innerTurns * 360}deg)`,
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
            {node.index === index && (
              // Keyed on the walk's position rather than on the stage, so the
              // ring opens again every time round and not only the first.
              <circle
                key={position}
                className={styles.pulse}
                cx={node.x}
                cy={node.y}
                r={GEOMETRY.node}
              />
            )}
            <circle cx={node.x} cy={node.y} r={GEOMETRY.node} />
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
      </svg>

      <p
        className={styles.caption}
        data-testid="loop-caption"
        key={index}
        aria-hidden="true"
      >
        <span className={styles.captionNumber}>{number}</span>{" "}
        <b>{active.title}.</b> <i>{active.summary}</i>
      </p>
      <div className={styles.controls}>
        {!reduced && (
          <button
            type="button"
            className={`secondary ${styles.toggle}`}
            onClick={loop.toggle}
          >
            {playing ? copy.controls.pause : copy.controls.play}
          </button>
        )}
        {/* The page argues that listening should be an option; here it is one
            about the page itself. It is silent until it is asked. */}
        {narration.available && (
          <button
            type="button"
            className={`secondary ${styles.toggle}`}
            aria-pressed={narration.speaking}
            onClick={narration.toggle}
          >
            {narration.speaking ? copy.controls.silence : copy.controls.narrate}
          </button>
        )}
      </div>
    </div>
  );
}
