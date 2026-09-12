import { describe, expect, it } from "vitest";
import { INTRO_SCENES } from "../../apps/web/app/content/intro-video";
import { processCopy } from "../../apps/web/app/content/process";
import { french } from "../../apps/web/app/i18n/fr";

/**
 * The renderer that draws the film cannot import the application's TypeScript,
 * so it keeps its own copy of the words in `scripts/brand/intro-copy.mjs`. Two
 * copies of the same sentence drift the moment one of them is edited, and the
 * drift is invisible until someone watches the film and reads the page side by
 * side. This test is the thing that notices instead.
 *
 * The application is the source of truth in both directions: English comes from
 * the content file, and French comes from the dictionary that the interface
 * itself reads, so the film can never say something the site does not.
 */

type Scene = { id: string; headline: string; lede: string };
type Loop = { centre: string[]; stages: string[] };
type LanguageCopy = { scenes: Scene[]; loop: Loop; keys: string[][] };
type IntroCopy = Record<"en" | "fr", LanguageCopy>;

const languages = ["en", "fr"] as const;

// The specifier is typed as a plain string so the compiler does not try to
// resolve an untyped `.mjs` module that another stream still owns.
const modulePath: string = "../../scripts/brand/intro-copy.mjs";

let introCopy: IntroCopy | undefined;
let loadFailure: unknown;
try {
  ({ introCopy } = (await import(modulePath)) as { introCopy: IntroCopy });
} catch (error) {
  loadFailure = error;
}

/** Fails with the reason rather than an opaque `undefined` further down. */
function copy(): IntroCopy {
  if (!introCopy)
    throw new Error(
      `scripts/brand/intro-copy.mjs did not load, so the film's copy cannot be ` +
        `checked against the app's: ${String(loadFailure)}`,
    );
  return introCopy;
}

describe("the film's copy against the app's", () => {
  it("says the English the content file says, scene for scene", () => {
    expect(
      copy().en.scenes.map((scene) => ({
        id: scene.id,
        headline: scene.headline,
        lede: scene.lede,
      })),
    ).toEqual(
      INTRO_SCENES.map((scene) => ({
        id: scene.id,
        headline: scene.headline,
        lede: scene.lede,
      })),
    );
  });

  it("says the French the dictionary says, scene for scene", () => {
    const scenes = copy().fr.scenes;
    expect(scenes).toHaveLength(INTRO_SCENES.length);
    INTRO_SCENES.forEach((scene, index) => {
      expect(scenes[index].id, `scene ${scene.id}`).toBe(scene.id);
      expect(scenes[index].headline, `headline of ${scene.id}`).toBe(
        french[scene.headline],
      );
      expect(scenes[index].lede, `lede of ${scene.id}`).toBe(
        french[scene.lede],
      );
    });
  });

  it("draws the loop with the stages the page walks, in the same order", () => {
    for (const language of languages)
      expect(copy()[language].loop.stages, language).toEqual(
        processCopy[language].steps.map((step) => step.title),
      );
  });

  /**
   * The fifth scene draws a keyboard, and the letters on it come from here so
   * that a reader sees the keyboard their own hands know: QWERTY in English,
   * AZERTY in French. The renderer gives every letter exactly one key unit of
   * room, so anything longer than a single character would run over the key
   * beside it, and a row the renderer does not draw would simply be dropped
   * without a word.
   */
  it("names one legend per key on three letter rows, in both languages", () => {
    for (const language of languages) {
      const rows = copy()[language].keys;
      expect(rows, language).toHaveLength(3);
      for (const row of rows) {
        expect(row.length, `${language} row of ${row.length}`).toBeGreaterThan(
          5,
        );
        for (const legend of row) expect(legend, language).toHaveLength(1);
      }
    }
  });

  /** Two layouts, not one layout labelled twice. */
  it("draws a different keyboard for a French reader", () => {
    expect(copy().fr.keys).not.toEqual(copy().en.keys);
  });

  it("puts the page's own mission at the centre of the loop", () => {
    for (const language of languages)
      expect(copy()[language].loop.centre, language).toEqual(
        processCopy[language].target.statement,
      );
  });
});
