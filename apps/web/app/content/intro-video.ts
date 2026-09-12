/**
 * The facts about the twenty-four second introduction, in one place, because
 * four readers need them: the dialog that plays it, the renderer that draws
 * it, the structured data that describes it to crawlers and answer engines,
 * and the plain-text reading at `/llms.txt`. English is the source language
 * here as everywhere; the French wording comes from the dictionary under
 * these same keys.
 */

export const INTRO_DURATION_SECONDS = 24;

/** Four scenes of six seconds, the order the argument is made in. */
export const INTRO_SCENE_SECONDS = 6;

/** The date the introduction was first published on this origin. */
export const INTRO_PUBLISHED_ON = "2026-09-11";

export const INTRO_TITLE = "Ursly, in 24 seconds.";

export const INTRO_DESCRIPTION =
  "The next generation of internet: a source, a question, and a conversation you never have to type.";

/**
 * The argument the video makes, one scene at a time. Voice is the way in,
 * motion is what comes next, and the keyboard is named for what it now is:
 * the old way, still there, no longer the door.
 */
export const INTRO_SCENES = [
  {
    headline: "The next generation of internet.",
    lede: "Internet without a keyboard and a mouse.",
  },
  {
    headline: "Voice to action.",
    lede: "Say it, and Ursly does it.",
  },
  {
    headline: "Motion to action.",
    lede: "In beta, built for the headsets coming next.",
  },
  {
    headline: "The keyboard still works.",
    lede: "It is simply no longer the way in.",
  },
] as const;

/** The on-screen text of the video, sequenced, for people who cannot watch it. */
export const INTRO_TRANSCRIPT = INTRO_SCENES.map(
  (scene) => `${scene.headline} ${scene.lede}`,
);

export const introVideoPaths = (language: string) => ({
  webm: `/brand/ursly-intro.${language}.webm`,
  mp4: `/brand/ursly-intro.${language}.mp4`,
  captions: `/brand/ursly-intro.${language}.vtt`,
  poster: "/brand/social-card.png",
});
