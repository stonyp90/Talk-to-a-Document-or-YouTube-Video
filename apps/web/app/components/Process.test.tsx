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
import {
  PROCESS_STEP_IDS,
  resolveProcessCopy,
  type ProcessStepId,
} from "../content/process";

const copy = resolveProcessCopy("en");
const appHref = "/en/app";
/** Looked up by name rather than by position, so order is asserted once. */
const stage = (id: ProcessStepId) => copy.steps.find((s) => s.id === id)!;

/** The words alone. The picture stands beside them, drawn by Arrival. */
function Words({ locale }: { locale?: string }) {
  return <Process locale={locale} appHref={appHref} loop={useLoopWalk()} />;
}

/** Picture and words over one walk, the way the first screen wires them. */
function FirstScreen() {
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
  it("lists every stage of the loop, in the order the walk takes them", () => {
    render(<Words />);
    const items = stepItems();
    expect(items).toHaveLength(PROCESS_STEP_IDS.length);
    // The walk moves by index, so the rail must stand in the walk's order or
    // a reader would pick one stage and watch another light up.
    PROCESS_STEP_IDS.forEach((id, index) => {
      expect(items[index]).toHaveTextContent(stage(id).title);
    });
    expect(current()).toBe(0);
  });

  it("keeps every summary for the ear after taking it off the screen", () => {
    render(<Words />);
    const items = stepItems();
    PROCESS_STEP_IDS.forEach((id, index) => {
      // Still announced with the stage it belongs to: the caption under the
      // drawing recites the lit stage for the eye, and anyone reading the page
      // aloud would otherwise get ten bare nouns and no argument.
      expect(items[index]).toHaveTextContent(stage(id).summary);
      expect(within(items[index]).getByText(stage(id).summary)).toHaveClass(
        "visually-hidden",
      );
    });
  });

  it("leaves the picture to the screen it stands on and keeps the words here", () => {
    render(<Words />);
    expect(screen.queryByTestId("loop-diagram")).not.toBeInTheDocument();
    expect(screen.queryByTestId("loop-caption")).not.toBeInTheDocument();
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
    render(<FirstScreen />);
    const secure = PROCESS_STEP_IDS.indexOf("secure");
    fireEvent.click(within(stepItems()[secure]).getByRole("button"));
    expect(current()).toBe(secure);
    expect(
      screen.getByTestId("loop-diagram").querySelector('[data-stage="secure"]'),
    ).toHaveAttribute("data-active", "true");
    expect(screen.getByTestId("loop-caption")).toHaveTextContent(
      stage("secure").title,
    );
  });

  it("speaks French when asked, and English for anything else", () => {
    render(<Words locale="fr-CA" />);
    expect(
      screen.getByRole("heading", {
        name: resolveProcessCopy("fr").mission.heading,
      }),
    ).toBeInTheDocument();
    cleanup();
    render(<Words locale="de" />);
    expect(
      screen.getByRole("heading", { name: copy.mission.heading }),
    ).toBeInTheDocument();
  });
});
