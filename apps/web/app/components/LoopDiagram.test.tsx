// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LoopDiagram, PROVIDER_TURNS } from "./LoopDiagram";
import { LOOP_TIMING, useLoopWalk, type LoopTiming } from "./useLoopWalk";
import {
  INNER_LOOP_STEP,
  PROCESS_STEP_IDS,
  resolveProcessCopy,
} from "../content/process";

const copy = resolveProcessCopy("en");
const timing: LoopTiming = {
  holdMs: 1000,
  travelMs: 200,
  innerLoopMultiplier: 2,
};

/** The picture and the walk it draws, as the page wires them together. */
function Loop({
  locale,
  timing: given = timing,
}: {
  locale?: string;
  timing?: LoopTiming;
}) {
  return <LoopDiagram locale={locale} loop={useLoopWalk(given)} />;
}

const diagram = () => screen.getByTestId("loop-diagram");
const node = (id: string) => diagram().querySelector(`[data-stage="${id}"]`)!;
const lit = () =>
  PROCESS_STEP_IDS.findIndex(
    (id) => node(id).getAttribute("data-active") === "true",
  );
const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));
/** One stage: rest, then travel. Two scopes, since React flushes per act. */
const walk = (hold = timing.holdMs) => {
  advance(hold);
  advance(timing.travelMs);
};

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LoopDiagram", () => {
  it("draws every stage of the loop and names the lit one", () => {
    render(<Loop />);
    for (const id of PROCESS_STEP_IDS) expect(node(id)).toBeInTheDocument();
    expect(lit()).toBe(0);
    expect(screen.getByTestId("loop-caption")).toHaveTextContent(
      copy.steps[0].title,
    );
    expect(screen.getByTestId("loop-caption")).toHaveTextContent(
      copy.steps[0].summary,
    );
    expect(LOOP_TIMING.holdMs).toBeGreaterThan(LOOP_TIMING.travelMs);
  });

  it("walks to the next stage once the traveller has arrived", () => {
    render(<Loop />);
    advance(timing.holdMs - 1);
    expect(lit()).toBe(0);
    advance(1);
    // Departed: the node lights up only when the dot gets there.
    expect(lit()).toBe(0);
    advance(timing.travelMs);
    expect(lit()).toBe(1);
    expect(
      screen.getByRole("button", { name: copy.controls.pause }),
    ).toBeEnabled();
  });

  it("lets a reader pick a stage on the picture, which pauses the walk", () => {
    render(<Loop />);
    const secure = PROCESS_STEP_IDS.indexOf("secure");
    fireEvent.click(node("secure"));
    expect(lit()).toBe(secure);
    expect(screen.getByTestId("loop-caption")).toHaveTextContent(
      copy.steps[secure].title,
    );
    expect(
      screen.getByRole("button", { name: copy.controls.play }),
    ).toBeInTheDocument();
    walk();
    expect(lit()).toBe(secure);
    fireEvent.click(screen.getByRole("button", { name: copy.controls.play }));
    walk();
    expect(lit()).toBe(secure + 1);
  });

  it("waits for the inner loop before leaving the training stage", () => {
    render(<Loop />);
    const train = PROCESS_STEP_IDS.indexOf(INNER_LOOP_STEP);
    fireEvent.click(node(PROCESS_STEP_IDS[train - 1]));
    fireEvent.click(screen.getByRole("button", { name: copy.controls.play }));
    walk();
    expect(lit()).toBe(train);
    expect(diagram()).toHaveAttribute("data-inner-loop", "active");
    // A normal stage would have moved on by now; training holds for its loop.
    walk();
    expect(lit()).toBe(train);
    walk(timing.holdMs * (timing.innerLoopMultiplier - 1) - timing.travelMs);
    expect(lit()).toBe(0);
    expect(diagram()).toHaveAttribute("data-inner-loop", "idle");
  });

  it("never rotates backwards when the loop wraps around", () => {
    render(<Loop />);
    const angle = () => Number(diagram().getAttribute("data-angle"));
    fireEvent.click(node(PROCESS_STEP_IDS[PROCESS_STEP_IDS.length - 1]));
    const before = angle();
    fireEvent.click(node(PROCESS_STEP_IDS[0]));
    expect(angle()).toBeGreaterThan(before);
    expect(angle() % 360).toBe(0);
  });

  it("does not move on its own when the reader prefers reduced motion", () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        onchange: null,
        dispatchEvent: vi.fn(),
      })),
    );
    render(<Loop />);
    walk();
    walk();
    expect(lit()).toBe(0);
    expect(
      screen.queryByRole("button", { name: copy.controls.pause }),
    ).not.toBeInTheDocument();
    fireEvent.click(node(PROCESS_STEP_IDS[3]));
    expect(lit()).toBe(3);
  });

  it("shows each model provider's turn on the training loop", () => {
    render(<Loop />);
    const providers = diagram().querySelectorAll("[data-provider]");
    expect(PROVIDER_TURNS).toBeGreaterThanOrEqual(2);
    expect(providers).toHaveLength(PROVIDER_TURNS);
    providers.forEach((dot, index) =>
      expect(dot).toHaveAttribute("data-provider", String(index)),
    );
  });

  it("speaks French when asked, and English for anything else", () => {
    const french = resolveProcessCopy("fr");
    render(<Loop locale="fr-CA" />);
    expect(screen.getByTestId("loop-caption")).toHaveTextContent(
      french.steps[0].title,
    );
    cleanup();
    render(<Loop locale="de" />);
    expect(screen.getByTestId("loop-caption")).toHaveTextContent(
      copy.steps[0].title,
    );
  });
});
