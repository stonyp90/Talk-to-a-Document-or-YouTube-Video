"use client";

import { useEffect } from "react";
import { prefersReducedMotion } from "./motion";

/**
 * Marks each `[data-reveal]` element `data-revealed` the first time it enters
 * the viewport, so the stylesheet can let sections rise into place as the
 * page is read. Without an observer, or for people who asked for less motion,
 * everything is revealed at once.
 */
export function useRevealOnScroll(selector = "[data-reveal]") {
  useEffect(() => {
    const elements = Array.from(document.querySelectorAll(selector));
    const show = (element: Element) =>
      element.setAttribute("data-revealed", "true");
    if (typeof IntersectionObserver !== "function" || prefersReducedMotion()) {
      elements.forEach(show);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          show(entry.target);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [selector]);
}
