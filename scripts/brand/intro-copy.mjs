// Every word the introduction burns into a frame, in both languages.
//
// This is a build script's copy, not the application's, and the two have to
// say the same thing. The renderer cannot import the app's TypeScript -- it
// runs under plain node with no build step -- so the words are written out
// again here, and `scripts/brand/intro-copy.test.ts` fails the suite the
// moment either side drifts from the other. That test is the only reason it
// is safe to have the same sentence in two files.
//
// Where a line comes from, so a translator changes it in the right place:
//   scenes  -> apps/web/app/content/intro-video.ts (English) and
//              apps/web/app/i18n/fr.ts (French, under the English key)
//   loop    -> apps/web/app/content/process.ts, every stage of the build loop
//              and the mission at the centre of it, verbatim
// The French carries typographic apostrophes because the page does, and a
// test that compares the two strings counts a straight quote as a difference.
//
// The same rule covers what the film is painted with. The colours below are
// the site's tokens written out a second time, for the same reason and under
// the same guard, so this file is the renderer's whole mirror of the
// application rather than only its words.

/**
 * The palette the film paints with, which is the site's palette: a mirror of
 * the `:root` custom properties in apps/web/app/globals.css. The film ends and
 * the page begins in the same breath, so a coral in the film that is not the
 * coral on the page is a seam the viewer sees without being able to name it.
 * `tests/brand/intro-copy.test.ts` reads the stylesheet and fails the moment
 * the two part company.
 *
 * Which token each one is, so a colour is changed in the stylesheet and not
 * here: paper is --paper, ink is --ink, muted is --muted, accent is --accent,
 * and hairline is --line, named for what it draws rather than for where it is
 * declared. `screen` is the white of the application's own screen inside the
 * frame and has no token, because the page never paints it -- the page is the
 * paper around it.
 */
export const introPalette = {
  paper: "#f8f5ef",
  ink: "#292735",
  muted: "#716c78",
  accent: "#a84332",
  hairline: "#e5e0d8",
  screen: "#ffffff",
};

/**
 * The geometry of the wave the film runs along the top of its type column.
 * The application draws the same wave above the landing page's first words,
 * so this is a mirror of `INTRO_WAVE` in apps/web/app/content/intro-video.ts
 * and `tests/brand/intro-copy.test.ts` fails the moment the two disagree.
 */
export const introWave = {
  bars: 26,
  pitch: 34,
  bar: 15,
  left: -22,
  floor: 12,
  swing: 168,
  speed: 2.4,
  phase: 0.7,
  fade: 340,
  gains: [0.45, 0.6, 1, 0.66, 0.3, 0.5],
};

export const introCopy = {
  en: {
    rail: "SOURCE  →  QUESTION  →  UNDERSTANDING",
    beta: "BETA",
    modes: { voice: "Voice", motion: "Motion", keyboard: "Keyboard" },
    // The three letter rows of the keyboard the fifth scene draws. The
    // keyboard a reader recognises is the one their own hands know, so English
    // gets QWERTY and French gets AZERTY. These are never spoken and never
    // appear on the page, so nothing checks them against the dictionary: they
    // are the shape of an object, not a sentence.
    keys: [
      ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
      ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
      ["Z", "X", "C", "V", "B", "N", "M"],
    ],
    site: "ursly.io",
    loop: {
      centre: ["The bridge to", "tomorrow’s internet."],
      stages: [
        "Concept",
        "Plan",
        "Tools",
        "Local",
        "Test",
        "Secure",
        "Deliver",
        "Production",
        "Sustain",
        "Listen",
        "Train",
      ],
    },
    scenes: [
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
    ],
  },
  fr: {
    rail: "SOURCE  →  QUESTION  →  COMPRÉHENSION",
    beta: "BÊTA",
    modes: { voice: "Voix", motion: "Mouvement", keyboard: "Clavier" },
    keys: [
      ["A", "Z", "E", "R", "T", "Y", "U", "I", "O", "P"],
      ["Q", "S", "D", "F", "G", "H", "J", "K", "L", "M"],
      ["W", "X", "C", "V", "B", "N"],
    ],
    site: "ursly.io",
    loop: {
      centre: ["Le pont vers", "l’Internet de demain."],
      stages: [
        "Concept",
        "Plan",
        "Outils",
        "Local",
        "Tests",
        "Sécurité",
        "Livraison",
        "Production",
        "Financement",
        "Écoute",
        "Entraînement",
      ],
    },
    scenes: [
      {
        id: "what",
        headline: "La nouvelle génération d’internet.",
        lede: "Pas un nouveau site Web. Une nouvelle façon de s’en servir.",
      },
      {
        id: "source",
        headline: "Apportez un document ou une vidéo.",
        lede: "Ursly le lit, et ne répond qu’à partir de lui.",
      },
      {
        id: "voice",
        headline: "Voix vers action.",
        lede: "Dites-le, Ursly le fait.",
      },
      {
        id: "motion",
        headline: "Mouvement vers action.",
        lede: "En bêta, pensé pour les casques qui arrivent.",
      },
      {
        id: "keyboard",
        headline: "Le clavier fonctionne toujours.",
        lede: "Ce n’est simplement plus la porte d’entrée.",
      },
      {
        id: "loop",
        headline: "Rien ne sort tant que la boucle n’est pas bouclée.",
        lede: "Du concept à la production, testé en production, à chaque cycle.",
      },
    ],
  },
};
