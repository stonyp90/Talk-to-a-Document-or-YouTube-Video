import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { french } from "../i18n/fr";
import { INTRO_TRANSCRIPT } from "./IntroGate";

/**
 * The captions burned into the intro video, the WebVTT track next to it and
 * the transcript the dialog offers must tell the same story in both
 * languages. The video and its captions come from scripts/brand/intro-video.mjs;
 * this keeps the component honest when the video is re-cut.
 */
const brand = join(__dirname, "../../public/brand");
const cues = (lang: string) =>
  readFileSync(join(brand, `ursly-intro.${lang}.vtt`), "utf8")
    .split(/\n\n+/)
    .slice(1)
    .map((cue) => cue.split("\n").slice(1).join(" ").trim())
    .filter(Boolean);

describe("intro transcript", () => {
  it("matches the English captions of the video", () => {
    expect(cues("en")).toEqual([...INTRO_TRANSCRIPT]);
  });

  it("matches the French captions through the dictionary", () => {
    expect(cues("fr")).toEqual(INTRO_TRANSCRIPT.map((line) => french[line]));
  });

  it("covers the whole 24 seconds without gaps", () => {
    const timings = readFileSync(join(brand, "ursly-intro.en.vtt"), "utf8")
      .match(/^(\S+) --> (\S+)$/gm)!
      .map((line) =>
        line.split(" --> ").map((stamp) =>
          stamp
            .split(":")
            .map(Number)
            .reduce((total, part) => total * 60 + part, 0),
        ),
      );
    expect(timings[0][0]).toBe(0);
    expect(timings.at(-1)![1]).toBe(24);
    timings.slice(1).forEach(([from], i) => expect(from).toBe(timings[i][1]));
  });
});
