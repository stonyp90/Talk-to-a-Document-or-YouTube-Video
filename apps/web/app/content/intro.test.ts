import { describe, expect, it } from "vitest";
import { french } from "../i18n/fr";
import {
  INTRO_CHAPTERS,
  INTRO_SECONDS,
  INTRO_TRANSCRIPT,
  chapterAt,
  chapterStart,
  introCaptions,
} from "./intro";

describe("intro chapters", () => {
  it("tell what Ursly is first, then each surface, then the features", () => {
    expect(INTRO_CHAPTERS.map((chapter) => chapter.id)).toEqual([
      "what",
      "web",
      "ios",
      "android",
      "features",
    ]);
  });

  it("add up to the announced length", () => {
    const total = INTRO_CHAPTERS.reduce((sum, c) => sum + c.seconds, 0);
    expect(INTRO_SECONDS).toBe(total);
    expect(chapterStart(0)).toBe(0);
    expect(chapterStart(INTRO_CHAPTERS.length - 1)).toBe(
      total - INTRO_CHAPTERS.at(-1)!.seconds,
    );
  });

  it("know which chapter a moment of the video belongs to", () => {
    expect(chapterAt(0)).toBe(0);
    expect(chapterAt(INTRO_CHAPTERS[0].seconds - 0.01)).toBe(0);
    expect(chapterAt(INTRO_CHAPTERS[0].seconds)).toBe(1);
    expect(chapterAt(INTRO_SECONDS + 5)).toBe(INTRO_CHAPTERS.length - 1);
    expect(chapterAt(-1)).toBe(0);
  });

  it("produce gapless captions that are also the transcript", () => {
    const cues = introCaptions();
    expect(cues[0].from).toBe(0);
    expect(cues.at(-1)!.to).toBe(INTRO_SECONDS);
    cues.slice(1).forEach((cue, i) => expect(cue.from).toBe(cues[i].to));
    expect(cues.map((cue) => cue.text)).toEqual([...INTRO_TRANSCRIPT]);
  });

  it("are fully translated to French", () => {
    for (const chapter of INTRO_CHAPTERS) {
      for (const key of [chapter.title, chapter.summary, ...chapter.headline, ...chapter.captions])
        expect(french[key], key).toBeTruthy();
    }
  });
});
