// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useRevealOnScroll } from "./reveal";

function Harness() {
  useRevealOnScroll();
  return (
    <>
      <section data-reveal id="a" />
      <section data-reveal id="b" />
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("useRevealOnScroll", () => {
  it("reveals everything at once when the browser cannot observe", () => {
    vi.stubGlobal("IntersectionObserver", undefined);
    render(<Harness />);
    expect(document.getElementById("a")).toHaveAttribute("data-revealed", "true");
    expect(document.getElementById("b")).toHaveAttribute("data-revealed", "true");
  });

  it("reveals a section once it enters the viewport and then stops watching it", () => {
    const observed: Element[] = [];
    const unobserved: Element[] = [];
    let callback: IntersectionObserverCallback = () => {};
    class Observer {
      constructor(fn: IntersectionObserverCallback) {
        callback = fn;
      }
      observe(el: Element) {
        observed.push(el);
      }
      unobserve(el: Element) {
        unobserved.push(el);
      }
      disconnect() {}
    }
    vi.stubGlobal("IntersectionObserver", Observer);
    render(<Harness />);
    const a = document.getElementById("a")!;
    expect(observed).toHaveLength(2);
    expect(a).not.toHaveAttribute("data-revealed");
    callback(
      [
        { target: a, isIntersecting: true } as unknown as IntersectionObserverEntry,
      ],
      {} as IntersectionObserver,
    );
    expect(a).toHaveAttribute("data-revealed", "true");
    expect(unobserved).toEqual([a]);
    expect(document.getElementById("b")).not.toHaveAttribute("data-revealed");
  });
});
