import { describe, expect, it } from "vitest";
import {
  INTRO_DURATION_SECONDS,
  INTRO_SCENES,
  INTRO_SCENE_SECONDS,
  INTRO_TITLE_KEY,
  INTRO_TRANSCRIPT,
} from "./intro-video";
import { french } from "../i18n/fr";
import { createTranslator } from "../i18n/translate";

/** Every string the film puts on screen, in the order it appears. */
const onScreen = INTRO_SCENES.flatMap((scene) => [scene.headline, scene.lede]);

describe("the introduction's facts", () => {
  it("derives the duration from the scenes rather than stating it twice", () => {
    expect(INTRO_DURATION_SECONDS).toBe(
      INTRO_SCENES.length * INTRO_SCENE_SECONDS,
    );
  });

  it("names every scene once and leaves no line blank", () => {
    const ids = INTRO_SCENES.map((scene) => scene.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const scene of INTRO_SCENES) {
      expect(scene.id.trim(), "a scene id must identify something").not.toBe(
        "",
      );
      expect(scene.headline.trim(), scene.id).not.toBe("");
      expect(scene.lede.trim(), scene.id).not.toBe("");
    }
  });

  it("reads back as one transcript entry per scene, in scene order", () => {
    expect(INTRO_TRANSCRIPT).toHaveLength(INTRO_SCENES.length);
    expect(INTRO_TRANSCRIPT).toEqual(
      INTRO_SCENES.map((scene) => `${scene.headline} ${scene.lede}`),
    );
  });
});

describe("the introduction in French", () => {
  // The transcript is shown in the dialog, so every line the film says is a
  // line the interface owes a reader in their own language.
  it("translates every headline and lede", () => {
    for (const line of onScreen)
      expect(french[line], `missing French for: ${line}`).toBeTruthy();
  });

  // A dictionary entry that repeats the English is a placeholder, not a
  // translation, and it would ship looking finished.
  it("never passes the English back off as French", () => {
    for (const line of onScreen)
      expect(french[line], `untranslated: ${line}`).not.toBe(line);
  });

  // The dialog renders the transcript by translating a headline and a lede
  // separately and joining them, because those are the keys the dictionary
  // holds. Anyone tempted to hand a whole transcript line to the translator
  // instead would ship English to French readers, so nail the reason down.
  it("keys the halves, not the joined line, in the dictionary", () => {
    for (const line of INTRO_TRANSCRIPT)
      expect(french[line], `joined lines are not translated: ${line}`).toBe(
        undefined,
      );
    for (const scene of INTRO_SCENES)
      expect(`${french[scene.headline]} ${french[scene.lede]}`.trim()).not.toBe(
        `${scene.headline} ${scene.lede}`,
      );
  });
});

describe("the title", () => {
  // The number on screen is a parameter, so the title has to survive
  // substitution in every language rather than baking a duration into the copy.
  it("is translated rather than falling back to the English key", () => {
    expect(french[INTRO_TITLE_KEY]).toBeTruthy();
    expect(french[INTRO_TITLE_KEY]).not.toBe(INTRO_TITLE_KEY);
    // A translator that dropped the placeholder would silently lose the
    // duration, which is the one thing the title exists to say.
    expect(french[INTRO_TITLE_KEY]).toContain("{seconds}");
  });

  // The wordmark sits directly above this line. A title that says the name
  // again introduces the brand twice in one breath, which is what made the
  // introduction stop looking like the page it introduces.
  it("leaves the name to the wordmark", () => {
    for (const dictionary of [{}, french]) {
      const t = createTranslator(dictionary);
      expect(
        t(INTRO_TITLE_KEY, { seconds: INTRO_DURATION_SECONDS }),
      ).not.toMatch(/ursly/i);
    }
  });

  it("carries the duration through substitution in both languages", () => {
    for (const dictionary of [{}, french]) {
      const t = createTranslator(dictionary);
      const title = t(INTRO_TITLE_KEY, { seconds: INTRO_DURATION_SECONDS });
      expect(title).toContain(String(INTRO_DURATION_SECONDS));
    }
  });
});
