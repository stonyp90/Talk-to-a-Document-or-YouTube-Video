// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { VoiceMark } from "./VoiceMark";
import {
  INTRO_WAVE,
  INTRO_WAVE_CLOSING_GAIN,
  INTRO_WAVE_RIGHT,
} from "../content/intro-video";

afterEach(cleanup);

const bars = () =>
  Array.from(screen.getByTestId("voice-mark").querySelectorAll("rect"));
const height = (bar: Element) => Number(bar.getAttribute("height"));
const FULL = INTRO_WAVE.floor + INTRO_WAVE.swing;

/** The film's own height for a bar, read at the frame the film opens on. */
const filmHeight = (index: number, gain: number) => {
  const x = INTRO_WAVE.left + index * INTRO_WAVE.pitch;
  const reach = Math.min(
    1,
    Math.max(0, (INTRO_WAVE_RIGHT - x) / INTRO_WAVE.fade),
  );
  const swing = Math.abs(Math.sin(index * INTRO_WAVE.phase));
  return (INTRO_WAVE.floor + swing * INTRO_WAVE.swing) * reach * gain;
};

describe("VoiceMark", () => {
  it("draws the film's wave, bar for bar and at the film's pitch", () => {
    render(<VoiceMark />);
    const drawn = bars();
    expect(drawn).toHaveLength(INTRO_WAVE.bars);
    drawn.forEach((bar, index) => {
      expect(bar.getAttribute("x")).toBe(
        String(INTRO_WAVE.left + index * INTRO_WAVE.pitch),
      );
      expect(bar.getAttribute("width")).toBe(String(INTRO_WAVE.bar));
    });
  });

  it("stands every bar at the height the film gives it", () => {
    render(<VoiceMark />);
    bars().forEach((bar, index) => {
      expect(height(bar), `bar ${index}`).toBeCloseTo(
        filmHeight(index, INTRO_WAVE_CLOSING_GAIN),
        4,
      );
    });
  });

  it("is a wave and not a row: no two neighbours stand alike", () => {
    render(<VoiceMark />);
    const drawn = bars().map(height);
    const neighbours = drawn.slice(1).map((h, i) => Math.abs(h - drawn[i]));
    expect(Math.min(...neighbours)).toBeGreaterThan(0);
  });

  it("dissolves the right end into the paper instead of cutting it off", () => {
    render(<VoiceMark />);
    const drawn = bars();
    const last = drawn[drawn.length - 1];
    const reach = (bar: Element) =>
      Number(bar.getAttribute("style")?.match(/--bar-reach:\s*([\d.]+)/)?.[1]);
    expect(reach(drawn[0])).toBe(1);
    expect(reach(last)).toBeLessThan(1);
    expect(reach(last)).toBeLessThan(reach(drawn[drawn.length - 2]));
    // Nothing is drawn past the point the film stops drawing.
    expect(
      Number(last.getAttribute("x")) + Number(last.getAttribute("width")),
    ).toBe(INTRO_WAVE_RIGHT);
  });

  it("stands quieter when it is asked to be quieter", () => {
    render(<VoiceMark gain={1} />);
    const loud = bars().map(height);
    cleanup();
    render(<VoiceMark gain={0.5} />);
    bars().forEach((bar, index) => {
      expect(height(bar), `bar ${index}`).toBeCloseTo(loud[index] / 2, 4);
    });
  });

  it("stays inside its own box at every height", () => {
    render(<VoiceMark gain={1} />);
    bars().forEach((bar, index) => {
      const y = Number(bar.getAttribute("y"));
      expect(y, `bar ${index}`).toBeGreaterThanOrEqual(0);
      expect(y + height(bar), `bar ${index}`).toBeLessThanOrEqual(FULL);
    });
  });

  it("leads each bar in after the one before it, and never forever", () => {
    render(<VoiceMark />);
    const stagger = (bar: Element) =>
      Number(bar.getAttribute("style")?.match(/--bar-stagger:\s*(\d+)ms/)?.[1]);
    const drawn = bars();
    expect(stagger(drawn[0])).toBe(0);
    drawn.slice(1).forEach((bar, index) => {
      expect(stagger(bar)).toBeGreaterThan(stagger(drawn[index]));
    });
    // The whole arrival is over well inside the page's motion budget.
    expect(stagger(drawn[drawn.length - 1])).toBeLessThan(1000);
  });

  it("is decoration, so it is never announced", () => {
    render(<VoiceMark />);
    expect(screen.getByTestId("voice-mark")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("takes a label when it stands for something, and then it is announced", () => {
    render(<VoiceMark label="Ursly is listening" />);
    expect(
      screen.getByRole("img", { name: "Ursly is listening" }),
    ).toBeVisible();
  });
});
