/**
 * Copy for the "How we build" section. English is the source; other locales
 * translate the same keys and anything unsupported falls back to English.
 */
export type ProcessLocale = "en" | "fr";
export const DEFAULT_PROCESS_LOCALE: ProcessLocale = "en";

/** The loop, in the order it is walked. */
export const PROCESS_STEP_IDS = [
  "concept",
  "plan",
  "tools",
  "local",
  "test",
  "secure",
  "deliver",
  "production",
  "listen",
  "train",
] as const;
export type ProcessStepId = (typeof PROCESS_STEP_IDS)[number];

/** The stage with a loop of its own: local, then beta, then the same loop. */
export const INNER_LOOP_STEP: ProcessStepId = "train";

/**
 * The training stage is a loop of its own, and it leverages every model
 * provider: the best model from one provider proves itself, an event hands off
 * to the best from the next, each iterating on its own, locally and then in
 * beta, through the same loop. The big loop waits until that small loop closes.
 */
export type ProcessStepCopy = {
  id: ProcessStepId;
  title: string;
  summary: string;
};

export type ProcessCopy = {
  eyebrow: string;
  heading: { lead: string; accent: string; trail: string };
  intro: string;
  quote: string;
  target: { eyebrow: string; statement: string[]; note: string };
  innerLoop: string;
  controls: {
    pause: string;
    play: string;
    stepList: string;
    /** Asks the page to name each stage aloud as the walk reaches it. */
    narrate: string;
    silence: string;
  };
  steps: ProcessStepCopy[];
  mission: {
    eyebrow: string;
    heading: string;
    body: string;
    primary: string;
    secondary: string;
  };
};

export const processCopy: Record<ProcessLocale, ProcessCopy> = {
  en: {
    eyebrow: "How we build",
    heading: {
      lead: "Nothing ships until ",
      accent: "the loop closes",
      trail: ".",
    },
    intro:
      "Ursly is built in short cycles. Each one starts as an idea and ends with real people using it and telling us what to improve. In between, it is planned, built with the right tools, run and tested on one machine, secured, delivered continuously and proven in production. A feature is finished only when the whole loop has been walked.",
    quote: "The loop is our definition of done.",
    target: {
      eyebrow: "The mission",
      statement: ["The bridge to", "tomorrow’s internet."],
      note: "One loop · nothing skipped",
    },
    innerLoop:
      "Training is a loop of its own: the best model from one provider proves itself, then an event hands off to the best from the next provider, each iterating on its own, first locally, then in beta, through this same loop. The big loop waits until the small one closes.",
    controls: {
      pause: "Pause the loop",
      play: "Play the loop",
      stepList: "Stages of the loop",
      narrate: "Hear the loop",
      silence: "Stop the voice",
    },
    steps: [
      {
        id: "concept",
        title: "Concept",
        summary: "Start from an idea worth building, said plainly.",
      },
      {
        id: "plan",
        title: "Plan",
        summary: "Write down how it will be built before writing any code.",
      },
      {
        id: "tools",
        title: "Tools",
        summary:
          "Choose the best technology for the job, not the most familiar one.",
      },
      {
        id: "local",
        title: "Local",
        summary:
          "Run the whole product on one machine, every dependency included.",
      },
      {
        id: "test",
        title: "Test",
        summary:
          "Behaviour, contract and unit tests on every cycle, so nothing regresses when the next feature lands.",
      },
      {
        id: "secure",
        title: "Secure",
        summary:
          "Security and compliance are the law, so they are built into every cycle rather than added at the end.",
      },
      {
        id: "deliver",
        title: "Deliver",
        summary:
          "Continuous integration and delivery: every change is checked, then shipped automatically.",
      },
      {
        id: "production",
        title: "Production",
        summary: "Go live, then test it in production too.",
      },
      {
        id: "listen",
        title: "Listen",
        summary:
          "Gather enough feedback from real people to make the models better each cycle.",
      },
      {
        id: "train",
        title: "Train",
        summary:
          "What the loop learns trains the models, and every model provider gets its turn.",
      },
    ],
    mission: {
      eyebrow: "Why voice, and soon gestures",
      heading:
        "An interface between the internet you know and the one that is coming.",
      body: "Ursly is for people who would rather not spend their time learning how. Say what you want and tomorrow’s things get done, simply. We build it by voice because speaking is much faster than typing, and tomorrow a gesture will be faster still. Our job is to put that interface in front of everyone.",
      primary: "Try it by voice",
      secondary: "See how it’s made",
    },
  },
  fr: {
    eyebrow: "Notre façon de bâtir",
    heading: {
      lead: "Rien ne sort tant que ",
      accent: "la boucle n’est pas bouclée",
      trail: ".",
    },
    intro:
      "Ursly se construit en cycles courts. Chacun commence par une idée et se termine avec de vraies personnes qui l’utilisent et nous disent quoi améliorer. Entre les deux, il est planifié, bâti avec les bons outils, exécuté et testé sur une seule machine, sécurisé, livré en continu et prouvé en production. Une fonctionnalité n’est terminée que lorsque toute la boucle a été parcourue.",
    quote: "La boucle est notre définition de « terminé ».",
    target: {
      eyebrow: "La mission",
      statement: ["Le pont vers", "l’Internet de demain."],
      note: "Une boucle · rien de sauté",
    },
    innerLoop:
      "L’entraînement est une boucle à part : le meilleur modèle d’un fournisseur fait ses preuves, puis un événement passe le relais au meilleur du fournisseur suivant, chacun itérant de lui-même, en local d’abord, puis en bêta, dans cette même boucle. La grande boucle attend que la petite soit bouclée.",
    controls: {
      pause: "Mettre la boucle en pause",
      play: "Relancer la boucle",
      stepList: "Les étapes de la boucle",
      narrate: "Écouter la boucle",
      silence: "Arrêter la voix",
    },
    steps: [
      {
        id: "concept",
        title: "Concept",
        summary: "Partir d’une idée qui vaut la peine, dite simplement.",
      },
      {
        id: "plan",
        title: "Plan",
        summary: "Écrire comment elle sera bâtie avant d’écrire du code.",
      },
      {
        id: "tools",
        title: "Outils",
        summary:
          "Choisir la meilleure technologie pour la tâche, pas la plus familière.",
      },
      {
        id: "local",
        title: "Local",
        summary:
          "Faire tourner tout le produit sur une seule machine, dépendances comprises.",
      },
      {
        id: "test",
        title: "Tests",
        summary:
          "Tests de comportement, de contrat et unitaires à chaque cycle, pour qu’aucune régression ne passe quand la prochaine fonctionnalité arrive.",
      },
      {
        id: "secure",
        title: "Sécurité",
        summary:
          "La sécurité et la conformité sont la loi ; elles font partie de chaque cycle au lieu d’être ajoutées à la fin.",
      },
      {
        id: "deliver",
        title: "Livraison",
        summary:
          "Intégration et livraison continues : chaque changement est vérifié, puis expédié automatiquement.",
      },
      {
        id: "production",
        title: "Production",
        summary: "Mettre en ligne, puis tester en production aussi.",
      },
      {
        id: "listen",
        title: "Écoute",
        summary:
          "Recueillir assez de retours de vraies personnes pour améliorer les modèles à chaque cycle.",
      },
      {
        id: "train",
        title: "Entraînement",
        summary:
          "Ce que la boucle apprend entraîne les modèles, et chaque fournisseur de modèles a son tour.",
      },
    ],
    mission: {
      eyebrow: "Pourquoi la voix, et bientôt les gestes",
      heading:
        "Une interface entre l’Internet que vous connaissez et celui qui s’en vient.",
      body: "Ursly est pour les gens qui préfèrent ne pas passer leur temps à apprendre comment faire. Dites ce que vous voulez et les choses de demain se font, simplement. Nous le bâtissons à la voix parce que parler est bien plus rapide que taper, et demain un geste sera plus rapide encore. Notre travail est de mettre cette interface devant tout le monde.",
      primary: "Essayez-le à la voix",
      secondary: "Voir comment c’est fait",
    },
  },
};

/** "fr-CA" resolves to French; anything unsupported resolves to English. */
export function resolveProcessCopy(locale?: string): ProcessCopy {
  const language = locale?.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return Object.hasOwn(processCopy, language)
    ? processCopy[language as ProcessLocale]
    : processCopy[DEFAULT_PROCESS_LOCALE];
}
