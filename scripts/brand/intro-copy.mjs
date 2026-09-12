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
//   loop    -> apps/web/app/content/process.ts, the ten stages of the build
//              loop and the mission at the centre of it, verbatim
// The French carries typographic apostrophes because the page does, and a
// test that compares the two strings counts a straight quote as a difference.

export const introCopy = {
  en: {
    rail: "SOURCE  →  QUESTION  →  UNDERSTANDING",
    beta: "BETA",
    modes: { voice: "Voice", motion: "Motion", keyboard: "Keyboard" },
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
