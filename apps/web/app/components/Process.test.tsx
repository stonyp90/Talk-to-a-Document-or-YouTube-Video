// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOOP_TIMING, PROVIDER_TURNS, Process } from "./Process";
import {
  INNER_LOOP_STEP,
  PROCESS_STEP_IDS,
  resolveProcessCopy,
} from "../content/process";

const copy = resolveProcessCopy("en");
const timing = { holdMs: 1000, travelMs: 200, innerLoopMultiplier: 2 };
const stepItems = () =>
  within(
    screen.getByRole("list", { name: copy.controls.stepList }),
  ).getAllByRole("listitem");
const current = () =>
  stepItems().findIndex(
    (item) =>
      within(item).getByRole("button").getAttribute("aria-current") === "step",
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

describe("Process", () => {
  it("names the section and lists every stage of the loop in order", () => {
    render(<Process appHref="/en/app" />);
    // jsdom gives the accent span no display, so the name computation pads
    // it as a block; browsers read the heading as one sentence.
    const sentence = `${copy.heading.lead}${copy.heading.accent}${copy.heading.trail}`;
    const section = screen.getByRole("region", {
      name: (name) => name.replace(/\s+([.,!?])/g, "$1") === sentence,
    });
    expect(section).toHaveAttribute("id", "how-we-build");
    const items = stepItems();
    expect(items).toHaveLength(PROCESS_STEP_IDS.length);
    items.forEach((item, index) => {
      expect(item).toHaveTextContent(copy.steps[index].title);
      expect(item).toHaveTextContent(copy.steps[index].summary);
    });
    expect(current()).toBe(0);
    expect(
      screen.getByRole("heading", { name: copy.mission.heading }),
    ).toBeInTheDocument();
    expect(LOOP_TIMING.holdMs).toBeGreaterThan(LOOP_TIMING.travelMs);
  });

  it("walks to the next stage once the traveller has arrived", () => {
    render(<Process appHref="/en/app" timing={timing} />);
    advance(timing.holdMs - 1);
    expect(current()).toBe(0);
    advance(1);
    // Departed: the node lights up only when the dot gets there.
    expect(current()).toBe(0);
    advance(timing.travelMs);
    expect(current()).toBe(1);
    expect(
      screen.getByRole("button", { name: copy.controls.pause }),
    ).toBeEnabled();
  });

  it("lets a reader pick a stage, which pauses the walk", () => {
    render(<Process appHref="/en/app" timing={timing} />);
    const secure = PROCESS_STEP_IDS.indexOf("secure");
    fireEvent.click(within(stepItems()[secure]).getByRole("button"));
    expect(current()).toBe(secure);
    expect(
      screen.getByRole("button", { name: copy.controls.play }),
    ).toBeInTheDocument();
    walk();
    expect(current()).toBe(secure);
    fireEvent.click(screen.getByRole("button", { name: copy.controls.play }));
    walk();
    expect(current()).toBe(secure + 1);
  });

  it("waits for the inner loop before leaving the training stage", () => {
    render(<Process appHref="/en/app" timing={timing} />);
    const train = PROCESS_STEP_IDS.indexOf(INNER_LOOP_STEP);
    const listen = train - 1;
    fireEvent.click(within(stepItems()[listen]).getByRole("button"));
    fireEvent.click(screen.getByRole("button", { name: copy.controls.play }));
    walk();
    expect(current()).toBe(train);
    const diagram = screen.getByTestId("loop-diagram");
    expect(diagram).toHaveAttribute("data-inner-loop", "active");
    // A normal stage would have moved on by now; training holds for its loop.
    walk();
    expect(current()).toBe(train);
    walk(timing.holdMs * (timing.innerLoopMultiplier - 1) - timing.travelMs);
    expect(current()).toBe(0);
    expect(diagram).toHaveAttribute("data-inner-loop", "idle");
  });

  it("never rotates backwards when the loop wraps around", () => {
    render(<Process appHref="/en/app" timing={timing} />);
    const diagram = screen.getByTestId("loop-diagram");
    const angle = () => Number(diagram.getAttribute("data-angle"));
    const last = PROCESS_STEP_IDS.length - 1;
    fireEvent.click(within(stepItems()[last]).getByRole("button"));
    const before = angle();
    fireEvent.click(within(stepItems()[0]).getByRole("button"));
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
    render(<Process appHref="/en/app" timing={timing} />);
    walk();
    walk();
    expect(current()).toBe(0);
    expect(
      screen.queryByRole("button", { name: copy.controls.pause }),
    ).not.toBeInTheDocument();
    fireEvent.click(within(stepItems()[3]).getByRole("button"));
    expect(current()).toBe(3);
  });

  it("speaks French when asked, and English for anything else", () => {
    render(<Process appHref="/fr/app" locale="fr-CA" />);
    expect(
      screen.getByRole("heading", {
        name: resolveProcessCopy("fr").mission.heading,
      }),
    ).toBeInTheDocument();
    cleanup();
    render(<Process appHref="/en/app" locale="de" />);
    expect(
      screen.getByRole("heading", { name: copy.mission.heading }),
    ).toBeInTheDocument();
  });

  it("shows each model provider's turn on the training loop", () => {
    render(<Process appHref="/en/app" timing={timing} />);
    const diagram = screen.getByTestId("loop-diagram");
    const providers = diagram.querySelectorAll("[data-provider]");
    expect(PROVIDER_TURNS).toBeGreaterThanOrEqual(2);
    expect(providers).toHaveLength(PROVIDER_TURNS);
    providers.forEach((dot, index) =>
      expect(dot).toHaveAttribute("data-provider", String(index)),
    );
  });

  it("keeps the lit stage off the training hand-off", () => {
    render(<Process appHref="/en/app" timing={timing} />);
    const diagram = screen.getByTestId("loop-diagram");
    const train = PROCESS_STEP_IDS.indexOf(INNER_LOOP_STEP);
    fireEvent.click(within(stepItems()[train]).getByRole("button"));
    const lit = diagram.querySelector('g[data-active="true"]');
    expect(lit?.querySelectorAll("[data-provider]")).toHaveLength(
      PROVIDER_TURNS,
    );
    // An unclassed circle can only be reached as `.node circle`, and that
    // selector beats the satellite's own rules: lighting the training stage
    // would fill its ring, its provider markers and its hand-off dot solid,
    // which is the one thing that node exists to show.
    expect(diagram.querySelectorAll("circle:not([class])")).toHaveLength(0);
  });

  it("states the mission in the document, not only inside the drawing", () => {
    render(<Process appHref="/en/app" />);
    // The drawing is aria-hidden, so anything only drawn there never reaches
    // a screen reader. Exactly one copy of each line has to be reachable.
    const reachable = (text: string) =>
      screen
        .queryAllByText(text)
        .filter((node) => !node.closest('[aria-hidden="true"]'));
    expect(reachable(copy.target.eyebrow)).toHaveLength(1);
    expect(reachable(copy.target.statement.join(" "))).toHaveLength(1);
    expect(reachable(copy.target.note)).toHaveLength(1);
  });
});
