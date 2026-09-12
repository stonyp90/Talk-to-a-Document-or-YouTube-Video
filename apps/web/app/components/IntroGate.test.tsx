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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntroGate } from "./IntroGate";
import { LanguageProvider } from "../i18n/LanguageProvider";
import {
  INTRO_SCENES,
  INTRO_SCENE_SECONDS,
  INTRO_TITLE_KEY,
} from "../content/intro-video";

function open() {
  return render(
    <LanguageProvider language="en" dictionary={{}}>
      <IntroGate open onClose={() => {}} />
    </LanguageProvider>,
  );
}

const chapters = () =>
  within(screen.getByRole("list", { name: "Chapters" })).getAllByRole("button");
const player = () => document.querySelector<HTMLVideoElement>(".intro-player")!;

beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("IntroGate", () => {
  it("shows the name once, and it is the lockup the menu carries", () => {
    open();
    const dialog = screen.getByRole("dialog");
    // The film's own product screenshot carries the name too. On this side of
    // the glass there is exactly one, and it is the shared component's.
    expect(dialog.querySelectorAll(".brand")).toHaveLength(1);
    expect(dialog.querySelectorAll(".brand-mark")).toHaveLength(1);
  });

  it("names the dialog without printing a running time", () => {
    open();
    expect(screen.getByRole("dialog", { name: /Ursly/ })).toBeInTheDocument();
    expect(INTRO_TITLE_KEY).not.toMatch(/\{seconds\}/);
    // The heading exists for assistive software only: a visible one would be
    // the second Ursly on a screen that should carry one.
    expect(document.getElementById("intro-title")).toHaveClass(
      "visually-hidden",
    );
  });

  it("carries one chapter per scene, each named by its scene", () => {
    open();
    const marks = chapters();
    expect(marks).toHaveLength(INTRO_SCENES.length);
    marks.forEach((mark, index) => {
      expect(mark).toHaveTextContent(INTRO_SCENES[index].headline);
    });
    expect(marks[0]).toHaveAttribute("aria-current", "step");
  });

  it("jumps the film to a chapter that is chosen, and says which it is", () => {
    open();
    const motion = INTRO_SCENES.findIndex((scene) => scene.id === "motion");
    fireEvent.click(chapters()[motion]);
    expect(player().currentTime).toBe(motion * INTRO_SCENE_SECONDS);
    expect(chapters()[motion]).toHaveAttribute("aria-current", "step");
    // The chapter's own button carries the same words for a screen reader, so
    // name the line under the rail rather than the first match on the page.
    expect(document.querySelector(".intro-now")).toHaveTextContent(
      INTRO_SCENES[motion].headline,
    );
  });

  it("steps back and forward a chapter at a time, and stops at both ends", () => {
    open();
    const back = screen.getByRole("button", { name: "Previous chapter" });
    const forward = screen.getByRole("button", { name: "Next chapter" });
    expect(back).toBeDisabled();
    fireEvent.click(forward);
    expect(player().currentTime).toBe(INTRO_SCENE_SECONDS);
    expect(back).toBeEnabled();
    fireEvent.click(back);
    expect(player().currentTime).toBe(0);
    fireEvent.click(chapters()[INTRO_SCENES.length - 1]);
    expect(forward).toBeDisabled();
  });

  it("keeps the way out, the fallback and the transcript", () => {
    open();
    expect(screen.getByRole("button", { name: /Skip intro/ })).toHaveFocus();
    expect(screen.getByText("Read the intro instead")).toBeInTheDocument();
    expect(player()).toHaveAttribute("preload", "auto");
    expect(player()).toHaveAttribute("muted");
  });

  it("follows the film's own clock as it plays", () => {
    open();
    const voice = INTRO_SCENES.findIndex((scene) => scene.id === "voice");
    vi.spyOn(player(), "currentTime", "get").mockReturnValue(
      voice * INTRO_SCENE_SECONDS + 1,
    );
    fireEvent.timeUpdate(player());
    expect(chapters()[voice]).toHaveAttribute("aria-current", "step");
  });
});
