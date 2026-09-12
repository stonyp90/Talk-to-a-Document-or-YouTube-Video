/**
 * The facts about the introduction, in one place, because five readers need
 * them: the dialog that plays it, the landing page that offers it, the
 * renderer that draws it, the captions beside it, and the transcript for
 * anyone who cannot watch. English is the source language here as everywhere;
 * the French wording comes from the dictionary under these same keys.
 *
 * Nothing here is a number typed twice. The duration is the scene count times
 * the scene length, and the title takes the duration as a parameter, so the
 * film can grow or shrink by editing the list below and nothing else.
 */

/** Every scene runs the same length, which is what makes the captions regular. */
export const INTRO_SCENE_SECONDS = 6;

/** The date the introduction was first published on this origin. */
export const INTRO_PUBLISHED_ON = "2026-09-12";

/**
 * The argument the film makes, one scene at a time.
 *
 * It answers two questions in the order a stranger asks them: what is this,
 * and why should I believe it. Scenes one to three are the product actually
 * running — a source going in, a question asked out loud, an answer that came
 * from that source and nothing else. Scenes four and five place the product in
 * the hierarchy of ways to drive it: voice now, motion next, the keyboard kept
 * but no longer the door. Scene six is the answer to "how are you building the
 * next internet", and it is not a claim: it is the same loop the landing page
 * walks through, drawn as a loop.
 */
export const INTRO_SCENES = [
  {
    id: "what",
    headline: "The next generation of internet.",
    lede: "Not a new website. A new way to use one.",
  },
  {
    id: "source",
    headline: "Bring a document or a video.",
    lede: "Ursly reads it, and answers only from it.",
  },
  {
    id: "voice",
    headline: "Voice to action.",
    lede: "Say it, and Ursly does it.",
  },
  {
    id: "motion",
    headline: "Motion to action.",
    lede: "In beta, built for the headsets coming next.",
  },
  {
    id: "keyboard",
    headline: "The keyboard still works.",
    lede: "It is simply no longer the way in.",
  },
  {
    id: "loop",
    headline: "Nothing ships until the loop closes.",
    lede: "Concept to production, tested in production, every cycle.",
  },
] as const;

export type IntroScene = (typeof INTRO_SCENES)[number];
export type IntroSceneId = IntroScene["id"];

/** Six seconds a scene, for as many scenes as the argument takes. */
export const INTRO_DURATION_SECONDS = INTRO_SCENES.length * INTRO_SCENE_SECONDS;

/**
 * What the dialog is called. It is not shown: the name at the top of the
 * introduction is the same lockup the menu carries, and a heading repeating
 * it in words would be the second Ursly on a screen that should only ever
 * have one. This is what assistive software announces instead.
 *
 * It no longer carries the running time. How long the film is is something a
 * reader finds out by watching the chapters fill, not a number to be promised
 * in the title of the thing.
 */
export const INTRO_TITLE_KEY = "The Ursly introduction";

export const INTRO_DESCRIPTION =
  "The next generation of internet: a source, a question, and a conversation you never have to type — built in one loop that closes before anything ships.";

/** The on-screen text of the film, sequenced, for people who cannot watch it. */
export const INTRO_TRANSCRIPT = INTRO_SCENES.map(
  (scene) => `${scene.headline} ${scene.lede}`,
);

export const introVideoPaths = (language: string) => ({
  webm: `/brand/ursly-intro.${language}.webm`,
  mp4: `/brand/ursly-intro.${language}.mp4`,
  captions: `/brand/ursly-intro.${language}.vtt`,
  poster: "/brand/social-card.png",
});

/**
 * The voice, drawn. The film runs this wave along the top of its type column
 * in every scene; the landing page draws the same one above its first words,
 * so the cut from the film to the page lands on a mark that never stopped
 * moving. The numbers are the film's own, in the film's 1920x1080 frame:
 * `scripts/brand/intro-copy.mjs` mirrors them for the renderer, which cannot
 * import TypeScript, and `tests/brand/intro-copy.test.ts` fails the moment the
 * two disagree.
 *
 * A bar's height is `(floor + |sin(t * speed + i * phase)| * swing) * reach`,
 * where `reach` dissolves the right end into the paper over `fade` units
 * instead of cutting it off, so the sound reads as arriving from off frame.
 */
export const INTRO_WAVE = {
  bars: 26,
  /** Centre-to-centre spacing, and the width of a bar. */
  pitch: 34,
  bar: 15,
  /** The first bar starts off the left edge: the sound was already going. */
  left: -22,
  /** A bar is never nothing, and never taller than this above the floor. */
  floor: 12,
  swing: 168,
  /** Radians per second, and the phase one bar leads the next by. */
  speed: 2.4,
  phase: 0.7,
  /** How far the right end takes to dissolve into the paper. */
  fade: 340,
  /**
   * How loud the wave is in each scene: loud where the argument is about
   * voice, quiet where it is about the keyboard voice replaces. One entry per
   * scene, so the page can open at the loudness the film closed on.
   */
  gains: [0.45, 0.6, 1, 0.66, 0.3, 0.5],
} as const;

/** The loudness the film ends on, and so the loudness the page begins on. */
export const INTRO_WAVE_CLOSING_GAIN =
  INTRO_WAVE.gains[INTRO_WAVE.gains.length - 1];

/** Where the wave ends, if nothing faded it. Derived, never typed twice. */
export const INTRO_WAVE_RIGHT =
  INTRO_WAVE.left + (INTRO_WAVE.bars - 1) * INTRO_WAVE.pitch + INTRO_WAVE.bar;

/** One full swing of a bar, in seconds: |sin| repeats every half turn. */
export const INTRO_WAVE_PERIOD_SECONDS = Math.PI / INTRO_WAVE.speed;
