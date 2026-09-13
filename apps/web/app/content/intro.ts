/**
 * The introduction, chapter by chapter: what Ursly is first, then each surface
 * it runs on, then the features. English is the source language; French comes
 * through the dictionary. `scripts/brand/intro-video.mjs` cuts the video from
 * these same chapters and `IntroGate` lists them, so what the dialog says and
 * what the video shows can never drift apart.
 */
export type IntroChapterId = "what" | "web" | "ios" | "android" | "features";

export type IntroChapter = {
  id: IntroChapterId;
  /** The chapter name, as listed beside the video. */
  title: string;
  /** Two short lines burned into the video next to the recording. */
  headline: readonly [string, string];
  /** One sentence under the headline, and under the title in the dialog. */
  summary: string;
  /** How long the chapter plays. */
  seconds: number;
  /** The captions, spread evenly across the chapter; also the transcript. */
  captions: readonly string[];
};

export const INTRO_CHAPTERS: readonly IntroChapter[] = [
  {
    id: "what",
    title: "What Ursly is",
    headline: ["A source.", "A conversation."],
    summary:
      "Ursly turns a document or a video into a conversation you lead by voice, by keyboard, and soon by movement.",
    seconds: 6,
    captions: [
      "Ursly turns a document or a video into a conversation.",
      "Voice first. Keyboard always. Motion next.",
    ],
  },
  {
    id: "web",
    title: "On the web",
    headline: ["Bring a source.", "Then ask."],
    summary:
      "Add a PDF or a captioned YouTube video in the browser, ask in your own words and get an answer grounded in the source.",
    seconds: 10,
    captions: [
      "On the web: add a PDF or a captioned video, then ask.",
      "Every answer stays grounded in what you brought.",
    ],
  },
  {
    id: "ios",
    title: "On iPhone",
    headline: ["Native on iPhone.", "Voice by default."],
    summary:
      "The same Ursly as a native iOS app: voice to action by default, the keyboard one tap away.",
    seconds: 8,
    captions: [
      "The same Ursly, native on iPhone.",
      "Voice to action by default, keyboard one tap away.",
    ],
  },
  {
    id: "android",
    title: "On Android",
    headline: ["Native on Android.", "Same three modes."],
    summary:
      "The native Android app carries the same source, the same question and the same understanding.",
    seconds: 8,
    captions: [
      "And native on Android.",
      "Source, question, understanding, in your pocket.",
    ],
  },
  {
    id: "features",
    title: "The features",
    headline: ["Three modes.", "Two languages."],
    summary:
      "Voice, keyboard and motion in beta; Brain is a research beta; English or French in one tap; answers you can check against the source text.",
    seconds: 8,
    captions: [
      "Voice, keyboard, and motion in beta: three ways to do the same thing.",
      "Brain is a research beta. English or French in one tap.",
    ],
  },
];

/** The whole introduction, in seconds. */
export const INTRO_SECONDS = INTRO_CHAPTERS.reduce(
  (total, chapter) => total + chapter.seconds,
  0,
);

/** The second at which a chapter begins. */
export function chapterStart(index: number): number {
  return INTRO_CHAPTERS.slice(0, index).reduce(
    (total, chapter) => total + chapter.seconds,
    0,
  );
}

/** The chapter playing at a given second of the video. */
export function chapterAt(time: number): number {
  let index = 0;
  for (let i = 0; i < INTRO_CHAPTERS.length; i++)
    if (time >= chapterStart(i)) index = i;
  return index;
}

export type IntroCaption = { from: number; to: number; text: string };

/** The captions with their timing, gapless from the first second to the last. */
export function introCaptions(): IntroCaption[] {
  const cues: IntroCaption[] = [];
  INTRO_CHAPTERS.forEach((chapter, index) => {
    const start = chapterStart(index);
    const each = chapter.seconds / chapter.captions.length;
    chapter.captions.forEach((text, i) =>
      cues.push({ from: start + each * i, to: start + each * (i + 1), text }),
    );
  });
  return cues;
}

/** The on-screen text of the video, in order, for people who cannot watch it. */
export const INTRO_TRANSCRIPT: readonly string[] = INTRO_CHAPTERS.flatMap(
  (chapter) => chapter.captions,
);
