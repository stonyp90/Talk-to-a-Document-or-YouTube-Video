import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  INTRO_SCENES,
  INTRO_WAVE,
} from "../../apps/web/app/content/intro-video";
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
type LanguageCopy = { scenes: Scene[]; loop: Loop };
type IntroCopy = Record<"en" | "fr", LanguageCopy>;
type IntroWave = typeof INTRO_WAVE;
type IntroPalette = Record<
  "paper" | "ink" | "muted" | "accent" | "hairline",
  string
>;

const languages = ["en", "fr"] as const;

// The specifier is typed as a plain string so the compiler does not try to
// resolve an untyped `.mjs` module that another stream still owns.
const modulePath: string = "../../scripts/brand/intro-copy.mjs";

let introCopy: IntroCopy | undefined;
let introWave: IntroWave | undefined;
let introPalette: IntroPalette | undefined;
let loadFailure: unknown;
try {
  ({ introCopy, introWave, introPalette } = (await import(modulePath)) as {
    introCopy: IntroCopy;
    introWave: IntroWave;
    introPalette: IntroPalette;
  });
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

/** The same, for the colours the renderer paints those words in. */
function palette(): IntroPalette {
  if (!introPalette)
    throw new Error(
      `scripts/brand/intro-copy.mjs did not load, so the film's palette ` +
        `cannot be checked against the site's: ${String(loadFailure)}`,
    );
  return introPalette;
}

/**
 * The site's colours, read out of the stylesheet that actually paints them
 * rather than typed in again here -- a third copy of #a84332 would only be one
 * more thing to keep in step. Only the first `:root` block is read: that is
 * where the brand is declared, and a later block that happens to set a token
 * for one surface is not the brand moving.
 */
const tokens = (() => {
  const stylesheet = readFileSync(
    fileURLToPath(new URL("../../apps/web/app/globals.css", import.meta.url)),
    "utf8",
  );
  const start = stylesheet.indexOf(":root {");
  const block = stylesheet.slice(start, stylesheet.indexOf("\n}", start));
  return new Map(
    Array.from(block.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g), (match) => [
      match[1],
      match[2].trim().toLowerCase(),
    ]),
  );
})();

/** Fails naming the token rather than comparing against `undefined`. */
function token(name: string): string {
  const value = tokens.get(name);
  if (value === undefined)
    throw new Error(
      `apps/web/app/globals.css no longer declares ${name} in :root, so the ` +
        `film's palette cannot be checked against it`,
    );
  return value;
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

  it("puts the page's own mission at the centre of the loop", () => {
    for (const language of languages)
      expect(copy()[language].loop.centre, language).toEqual(
        processCopy[language].target.statement,
      );
  });

  /**
   * The wave is the one thing the film and the page draw at the same moment:
   * the film ends on it and the landing page opens on it. If the two shapes
   * drift, the cut from the film into the page stops being invisible, which is
   * the whole reason the mark is there.
   */
  it("draws the wave the page draws, bar for bar", () => {
    expect(introWave).toEqual({ ...INTRO_WAVE });
  });
});

/**
 * The film is drawn by a build script and the page is painted by a stylesheet,
 * which means the two can hold different ideas of what the brand's coral is and
 * nothing will complain: both render, both look deliberate, and every test
 * passes. The drift only shows itself to a person who watches the film end and
 * then looks at the page it hands over to -- a waveform, a BETA chip and a
 * loop that were one hue a second ago, and are now very slightly another. By
 * then it has shipped. This is the thing that notices first.
 *
 * The stylesheet is the source of truth, because it is the side with the
 * contrast budget: --accent holds about 5.6:1 on paper, and a lighter coral
 * chosen to flatter the film would spend that on the page, where people
 * actually have to read. The film is regenerated from this repository, so it is
 * the cheap side to move -- re-render it when a token here changes.
 */
describe("the film's palette against the site's tokens", () => {
  const mirrored: [keyof IntroPalette, string][] = [
    ["paper", "--paper"],
    ["ink", "--ink"],
    ["muted", "--muted"],
    ["accent", "--accent"],
    // Named for what it draws in the frame; declared as the line it draws.
    ["hairline", "--line"],
  ];

  for (const [name, css] of mirrored)
    it(`paints ${name} in the colour ${css} declares`, () => {
      expect(palette()[name].toLowerCase()).toBe(token(css));
    });
});
