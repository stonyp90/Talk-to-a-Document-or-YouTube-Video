// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SECTION_SETTLE_MS,
  SectionLoader,
  sectionTargetFromHref,
  useSectionTransition,
} from "./sectionNavigation";

function Harness() {
  const entering = useSectionTransition();
  return (
    <>
      <SectionLoader entering={entering} labels={{ platform: "Platform" }} />
      <a href="#platform">Platform</a>
      <a href="/#platform">Platform (absolute)</a>
      <a href="https://example.com/#elsewhere">Elsewhere</a>
      <section id="platform">
        <h2>Platform</h2>
      </section>
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("sectionTargetFromHref", () => {
  const here = { pathname: "/en", origin: "http://localhost" } as Location;
  it("reads a same-page fragment", () => {
    expect(sectionTargetFromHref("#platform", here)).toBe("platform");
    expect(sectionTargetFromHref("/en#platform", here)).toBe("platform");
  });
  it("ignores other pages, other origins and empty fragments", () => {
    expect(sectionTargetFromHref("/fr#platform", here)).toBeNull();
    expect(sectionTargetFromHref("https://example.com/#x", here)).toBeNull();
    expect(sectionTargetFromHref("#", here)).toBeNull();
    expect(sectionTargetFromHref(null, here)).toBeNull();
  });
});

describe("moving into a section", () => {
  it("shows a loader while the page travels, then marks the arrival", () => {
    render(<Harness />);
    expect(screen.queryByRole("status")).toBeNull();
    fireEvent.click(screen.getByText("Platform", { selector: "a" }));
    expect(
      screen.getByRole("status", { name: "Opening Platform" }),
    ).toBeInTheDocument();
    const section = document.getElementById("platform")!;
    expect(section).toHaveAttribute("data-entering", "true");
    act(() => void vi.advanceTimersByTime(SECTION_SETTLE_MS + 10));
    expect(screen.queryByRole("status")).toBeNull();
    expect(section).not.toHaveAttribute("data-entering");
    expect(section).toHaveAttribute("data-arrived", "true");
  });

  it("ends early when the browser reports the scroll has settled", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Platform (absolute)"));
    expect(screen.getByRole("status")).toBeInTheDocument();
    act(() => {
      document.dispatchEvent(new Event("scrollend"));
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("leaves links to other places alone", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("Elsewhere"));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
