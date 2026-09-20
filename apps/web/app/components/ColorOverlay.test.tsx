// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { ColorOverlay, signalToColor } from "./ColorOverlay";
import type { NonVerbalSignal } from "@talk/core/domain/nonVerbalTracker";

describe("signalToColor", () => {
  it("returns blue for calm movement", () => {
    const signal: NonVerbalSignal = {
      kind: "movement",
      energy: 0.1,
      at: new Date(),
    };
    expect(signalToColor(signal)).toBe("blue");
  });

  it("returns orange for high energy", () => {
    const signal: NonVerbalSignal = {
      kind: "movement",
      energy: 0.5,
      at: new Date(),
    };
    expect(signalToColor(signal)).toBe("orange");
  });

  it("returns red for frustrated mood", () => {
    const signal: NonVerbalSignal = {
      kind: "mood",
      mood: "frustrated",
      at: new Date(),
    };
    expect(signalToColor(signal)).toBe("red");
  });

  it("returns warm for close distance", () => {
    const signal: NonVerbalSignal = {
      kind: "distance",
      estimate: "close",
      at: new Date(),
    };
    expect(signalToColor(signal)).toBe("warm");
  });
});

describe("ColorOverlay", () => {
  it("renders nothing when no signals", () => {
    const { container } = render(<ColorOverlay signals={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders overlay with color", () => {
    const signals: NonVerbalSignal[] = [
      { kind: "mood", mood: "curious", at: new Date() },
    ];
    const { container } = render(<ColorOverlay signals={signals} />);
    expect(container.firstChild).not.toBeNull();
  });
});
