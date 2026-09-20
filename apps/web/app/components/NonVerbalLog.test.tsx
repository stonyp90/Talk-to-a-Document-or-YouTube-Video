// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NonVerbalLog, formatSignal } from "./NonVerbalLog";
import type { NonVerbalSignal } from "@talk/core/domain/nonVerbalTracker";

describe("formatSignal", () => {
  it("formats gesture signal", () => {
    const signal: NonVerbalSignal = {
      kind: "gesture",
      gesture: "right",
      energy: 0.42,
      at: new Date("2026-09-20T14:32:01"),
    };
    const text = formatSignal(signal);
    expect(text).toContain("Swipe right");
    expect(text).toContain("0.42");
  });

  it("formats mood signal", () => {
    const signal: NonVerbalSignal = {
      kind: "mood",
      mood: "frustrated",
      at: new Date("2026-09-20T14:33:45"),
    };
    const text = formatSignal(signal);
    expect(text).toContain("frustrated");
  });
});

describe("NonVerbalLog", () => {
  it("renders empty state", () => {
    render(<NonVerbalLog signals={[]} />);
    expect(screen.getByText(/no signals recorded/i)).toBeInTheDocument();
  });

  it("renders signal entries", () => {
    const signals: NonVerbalSignal[] = [
      { kind: "gesture", gesture: "right", energy: 0.42, at: new Date() },
    ];
    render(<NonVerbalLog signals={signals} />);
    expect(screen.getByText(/Swipe right/)).toBeInTheDocument();
  });
});
