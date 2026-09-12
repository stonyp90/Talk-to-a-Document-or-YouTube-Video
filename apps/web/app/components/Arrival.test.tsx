// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Arrival } from "./Arrival";
import { useLoopWalk } from "./useLoopWalk";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { PROCESS_STEP_IDS, resolveProcessCopy } from "../content/process";

const copy = resolveProcessCopy("en");
const appHref = "/en/app";
const TITLES = copy.steps.map((step) => step.title);

/** The first screen as the landing page mounts it: one walk, one language. */
function FirstScreen() {
  const loop = useLoopWalk();
  return (
    <LanguageProvider language="en" dictionary={{}}>
      <Arrival
        language="en"
        appHref={appHref}
        loop={loop}
        onReplayIntro={() => {}}
      />
    </LanguageProvider>
  );
}

function mount() {
  const { container } = render(<FirstScreen />);
  return container;
}

/**
 * What the page says out loud: everything an aria-hidden subtree carries is
 * drawn for the eye alone and is never read, so it is dropped here too. The
 * ring's own labels and the caption under it are both in that class.
 *
 * Read text node by text node and joined with a space, because the rail sets
 * a stage's name and its summary in two spans with nothing between them:
 * plain `textContent` runs them together into "ConceptStart from an idea",
 * where assistive software announces two.
 */
function announced(element: Element): string {
  const spoken = element.cloneNode(true) as Element;
  for (const hidden of spoken.querySelectorAll('[aria-hidden="true"]'))
    hidden.remove();
  const walker = document.createTreeWalker(spoken, NodeFilter.SHOW_TEXT);
  const said: string[] = [];
  while (walker.nextNode()) said.push(walker.currentNode.textContent ?? "");
  return said.join(" ");
}

/**
 * Whole words only. The note beside the mission opens on "Training", which
 * would count as a second mention of the Train stage under a plain substring
 * search and hide exactly the duplication this is here to catch.
 */
const mentions = (text: string, word: string) =>
  text.match(new RegExp(`\\b${word}\\b`, "g"))?.length ?? 0;

afterEach(cleanup);

describe("Arrival", () => {
  it("is one section, and it is both the first screen and how we build", () => {
    const container = mount();
    // The hero and the build loop used to be two sections a screen apart.
    // They are one element now, and the menu's anchor points at it, so a
    // reader following "How we build" lands on the page's own first frame.
    const sections = container.querySelectorAll("section");
    expect(sections).toHaveLength(1);
    const section = sections[0];
    expect(section).toHaveAttribute("id", "how-we-build");
    expect(section).toHaveClass("landing-hero");
  });

  it("speaks with one voice: a single h1, and the section is named by it", () => {
    const container = mount();
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveAttribute("id", "hero-heading");
    expect(container.querySelector("section")).toHaveAttribute(
      "aria-labelledby",
      "hero-heading",
    );
  });

  it("carries the claim, the picture, every stage and the way in on one screen", () => {
    const section = mount().querySelector("section")!;
    for (const part of [
      screen.getByTestId("loop-diagram"),
      screen.getByTestId("loop-caption"),
      screen.getByRole("list", { name: copy.controls.stepList }),
      screen.getByRole("link", { name: copy.mission.primary }),
      screen.getByRole("link", { name: /Open the app/ }),
    ])
      expect(section).toContainElement(part);
  });

  it("opens on the film's own wave, and never announces it", () => {
    const section = mount().querySelector("section")!;
    const mark = screen.getByTestId("voice-mark");
    expect(section).toContainElement(mark);
    // Decoration: the page's first words are the h1, not a drawing of sound.
    expect(mark).toHaveAttribute("aria-hidden", "true");
  });

  it("names each stage once, so the screen argues rather than repeating", () => {
    const section = mount().querySelector("section")!;
    const spoken = announced(section);
    // Counted, so an empty copy file could never make this pass by naming
    // nothing at all.
    expect(TITLES).toHaveLength(PROCESS_STEP_IDS.length);
    // The whole point of the restructure: the loop was named in the lede,
    // drawn on the ring and then listed again a screen below. The ring and
    // the caption are drawn for the eye, so the rail is the only telling.
    for (const title of TITLES) expect(mentions(spoken, title), title).toBe(1);
  });

  it("puts every stage a keyboard can reach in the one rail", () => {
    const section = mount().querySelector("section")!;
    const rail = screen.getByRole("list", { name: copy.controls.stepList });
    const reachable = [
      ...section.querySelectorAll<HTMLElement>("a, button, [tabindex]"),
    ].filter((control) =>
      TITLES.some((title) => mentions(announced(control), title) > 0),
    );
    expect(reachable).toHaveLength(PROCESS_STEP_IDS.length);
    for (const control of reachable) expect(rail).toContainElement(control);
  });
});
