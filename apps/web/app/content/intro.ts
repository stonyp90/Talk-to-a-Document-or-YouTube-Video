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
    title: "The human interface",
    headline: ["Make the keyboard", "obsolete."],
    summary:
      "Ursly is a new way to interact with the digital world. Speak, gesture, look, move — the interface adapts to you.",
    seconds: 6,
    captions: [
      "Ursly makes the keyboard obsolete.",
      "The interface adapts to the human.",
    ],
  },
  {
    id: "web",
    title: "On the web",
    headline: ["Speak.", "The interface understands."],
    summary:
      "Bring a document or a video. Express your intention by voice, gesture, or gaze. Ursly acts.",
    seconds: 10,
    captions: [
      "On the web: bring a source, then speak or gesture.",
      "No menus. No buttons. Just your intention.",
    ],
  },
  {
    id: "ios",
    title: "On iPhone",
    headline: ["Native on iPhone.", "Voice by default."],
    summary:
      "The same Ursly as a native iOS app. Voice first, gesture next, the keyboard one tap away if you want it.",
    seconds: 8,
    captions: [
      "The same Ursly, native on iPhone.",
      "Voice first. Gesture next. Keyboard if you want.",
    ],
  },
  {
    id: "android",
    title: "On Android",
    headline: ["Native on Android.", "Same human interface."],
    summary:
      "The native Android app carries the same source, the same intention, the same understanding.",
    seconds: 8,
    captions: [
      "And native on Android.",
      "Same intention. Same understanding. In your pocket.",
    ],
  },
  {
    id: "features",
    title: "The modes",
    headline: ["Voice. Gesture.", "Gaze. Motion."],
    summary:
      "Four ways to express your intention. Brain is a research beta. English or French in one tap. Answers grounded in your source.",
    seconds: 8,
    captions: [
      "Voice, gesture, gaze, and motion: four ways to mean the same thing.",
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
