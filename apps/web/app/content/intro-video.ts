/**
 * The facts about the twenty-four second introduction, in one place, because
 * three readers need them: the dialog that plays it, the structured data that
 * describes it to crawlers and answer engines, and the plain-text reading at
 * `/llms.txt`. English is the source language here as everywhere; the French
 * wording comes from the dictionary under these same keys.
 */

export const INTRO_DURATION_SECONDS = 24;

/** The date the introduction was first published on this origin. */
export const INTRO_PUBLISHED_ON = "2026-09-11";

export const INTRO_TITLE = "Ursly, in 24 seconds.";

export const INTRO_DESCRIPTION =
  "A source, a question, and a conversation that stays grounded in what you brought.";

/** The on-screen text of the video, sequenced, for people who cannot watch it. */
export const INTRO_TRANSCRIPT = [
  "Ursly. A source. A conversation.",
  "Bring a document or a video. Ursly reads it for you.",
  "Ask by voice, by keyboard, and soon by movement.",
  "Source, question, understanding.",
] as const;

export const introVideoPaths = (language: string) => ({
  webm: `/brand/ursly-intro.${language}.webm`,
  mp4: `/brand/ursly-intro.${language}.mp4`,
  captions: `/brand/ursly-intro.${language}.vtt`,
  poster: "/brand/social-card.png",
});
