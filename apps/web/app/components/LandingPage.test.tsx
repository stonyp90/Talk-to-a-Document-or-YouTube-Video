// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import LandingPage from "./LandingPage";
import { INTRO_STORAGE_KEY } from "./IntroGate";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { STORY_SECTIONS } from "../content/story";

/**
 * The film renders its player only while the dialog is open, so the presence of
 * a video says whether the introduction took over the page — which is the one
 * thing about a first visit a reader cannot undo by scrolling.
 */
const filmIsPlaying = () => !!document.querySelector(".intro-player");

/** jsdom has no scrollIntoView, so the page's one move is recorded here. */
const scrolled = vi.fn();

function arriveAt(url: string, seen?: string) {
  window.history.replaceState({}, "", url);
  if (seen) localStorage.setItem(INTRO_STORAGE_KEY, seen);
  const view = render(
    <LanguageProvider language="en" dictionary={{}}>
      <LandingPage />
    </LanguageProvider>,
  );
  return view;
}

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = scrolled;
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("the introduction and where the reader came for", () => {
  it("does not auto-play the intro on a first visit", () => {
    arriveAt("/en");
    expect(filmIsPlaying()).toBe(false);
    expect(scrolled).not.toHaveBeenCalled();
  });

  it("stands aside for a first visit to a section of the story", () => {
    arriveAt("/en#how-it-works");
    // The introduction holds the page still while it runs, so playing it here
    // would keep a reader pinned above the very section they asked for.
    expect(filmIsPlaying()).toBe(false);
    // Standing aside spends nothing: an untargeted visit still gets the film.
    expect(localStorage.getItem(INTRO_STORAGE_KEY)).toBeNull();
  });

  it("stays out of the way of a returning visitor either way", () => {
    arriveAt("/en", "seen");
    expect(filmIsPlaying()).toBe(false);
  });

  it("only ever shows the film when there is one to show", () => {
    for (const section of STORY_SECTIONS) {
      cleanup();
      arriveAt(`/en#${section.id}`);
      expect(filmIsPlaying(), section.id).toBe(false);
    }
  });
});

describe("arriving at a section of the story", () => {
  it("does not scroll on the immersive stage — there is nowhere to go", () => {
    const target = STORY_SECTIONS[STORY_SECTIONS.length - 1].id;
    arriveAt(`/en#${target}`);
    // The stage is one viewport; no sections to scroll to.
    expect(scrolled).not.toHaveBeenCalled();
    // The intro still stands aside for a targeted visit.
    expect(filmIsPlaying()).toBe(false);
  });

  it("does not move a reader who asked for the top of the page", () => {
    arriveAt("/en");
    expect(scrolled).not.toHaveBeenCalled();
  });
});
