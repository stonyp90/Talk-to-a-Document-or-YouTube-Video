// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IntroGate } from "./IntroGate";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { INTRO_SCENES, INTRO_SCENE_SECONDS } from "../content/intro-video";

/** jsdom has no media pipeline; the dialog only ever asks for playback. */
beforeEach(() => {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(
    () => Promise.resolve() as Promise<void>,
  );
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const mount = () =>
  render(
    <LanguageProvider language="en" dictionary={{}}>
      <IntroGate open onClose={() => {}} />
    </LanguageProvider>,
  );

const player = () => document.querySelector("video") as HTMLVideoElement;

/** Drives the film to `seconds`, the way a playing video would. */
function playTo(seconds: number) {
  const video = player();
  Object.defineProperty(video, "duration", {
    configurable: true,
    value: INTRO_SCENES.length * INTRO_SCENE_SECONDS,
  });
  Object.defineProperty(video, "currentTime", {
    configurable: true,
    value: seconds,
  });
  act(() => {
    fireEvent.timeUpdate(video);
  });
}

describe("the introduction on a phone", () => {
  it("puts the scene now on screen into page type, where the film's own is too small to read", () => {
    mount();
    const caption = screen.getByTestId("intro-scene");
    expect(caption).toHaveTextContent(INTRO_SCENES[0].headline);
    expect(caption).toHaveTextContent(INTRO_SCENES[0].lede);
  });

  it("follows the film from scene to scene rather than holding the first one", () => {
    mount();
    // A second into the third scene: the film is arguing voice, and so is the
    // type beside it.
    playTo(INTRO_SCENE_SECONDS * 2 + 1);
    expect(screen.getByTestId("intro-scene")).toHaveTextContent(
      INTRO_SCENES[2].headline,
    );
    playTo(INTRO_SCENE_SECONDS * 5 + 4);
    expect(screen.getByTestId("intro-scene")).toHaveTextContent(
      INTRO_SCENES[INTRO_SCENES.length - 1].headline,
    );
  });

  it("never runs past the last scene, whatever the player reports", () => {
    mount();
    playTo(INTRO_SCENE_SECONDS * INTRO_SCENES.length + 30);
    expect(screen.getByTestId("intro-scene")).toHaveTextContent(
      INTRO_SCENES[INTRO_SCENES.length - 1].headline,
    );
  });

  it("leaves the spoken transcript to read it once, not twice", () => {
    mount();
    // The list under "Read the intro instead" is the accessible account of the
    // film; the caption is the same words drawn larger, so it stays out of it.
    expect(screen.getByTestId("intro-scene")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
