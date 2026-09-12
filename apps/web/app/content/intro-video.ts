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
export const INTRO_DURATION_SECONDS =
  INTRO_SCENES.length * INTRO_SCENE_SECONDS;

/**
 * The title, as a translation key with the duration filled in, so the number
 * on the button and the number in the film can never disagree.
 */
export const INTRO_TITLE_KEY = "Ursly, in {seconds} seconds.";

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
