// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { LoopDiagram } from "./LoopDiagram";
import { Process } from "./Process";
import { useLoopWalk } from "./useLoopWalk";
import { PROCESS_STEP_IDS, resolveProcessCopy } from "../content/process";

const copy = resolveProcessCopy("en");
const appHref = "/en/app";

/** The section alone, as the page renders it: the picture is elsewhere. */
function Section({ locale }: { locale?: string }) {
  return <Process locale={locale} appHref={appHref} loop={useLoopWalk()} />;
}

/** Picture and section over one walk, the way the landing page wires them. */
function Page() {
  const loop = useLoopWalk();
  return (
    <>
      <LoopDiagram loop={loop} />
      <Process appHref={appHref} loop={loop} />
    </>
  );
}

const stepItems = () =>
  within(
    screen.getByRole("list", { name: copy.controls.stepList }),
  ).getAllByRole("listitem");
const current = () =>
  stepItems().findIndex(
    (item) =>
      within(item).getByRole("button").getAttribute("aria-current") === "step",
  );

afterEach(cleanup);

describe("Process", () => {
  it("names the section and lists every stage of the loop in order", () => {
    render(<Section />);
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
  });

  it("leaves the picture to the first screen and keeps the words here", () => {
    render(<Section />);
    expect(screen.queryByTestId("loop-diagram")).not.toBeInTheDocument();
    expect(screen.queryByTestId("loop-caption")).not.toBeInTheDocument();
    expect(screen.getByText(copy.intro)).toBeInTheDocument();
    expect(screen.getByText(copy.quote)).toBeInTheDocument();
    expect(screen.getByText(copy.innerLoop)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: copy.mission.heading }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: copy.mission.primary }),
    ).toHaveAttribute("href", appHref);
  });

  it("drives the same walk the picture draws, from the list", () => {
    render(<Page />);
    const secure = PROCESS_STEP_IDS.indexOf("secure");
    fireEvent.click(within(stepItems()[secure]).getByRole("button"));
    expect(current()).toBe(secure);
    expect(
      screen.getByTestId("loop-diagram").querySelector('[data-stage="secure"]'),
    ).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("loop-caption")).toHaveTextContent(
      copy.steps[secure].title,
    );
  });

  it("speaks French when asked, and English for anything else", () => {
    render(<Section locale="fr-CA" />);
    expect(
      screen.getByRole("heading", {
        name: resolveProcessCopy("fr").mission.heading,
      }),
    ).toBeInTheDocument();
    cleanup();
    render(<Section locale="de" />);
    expect(
      screen.getByRole("heading", { name: copy.mission.heading }),
    ).toBeInTheDocument();
  });
});
