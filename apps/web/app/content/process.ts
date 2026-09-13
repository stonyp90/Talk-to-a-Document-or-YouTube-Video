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
  "sustain",
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
  subcycles: Record<
    string,
    { title: string; steps: string[]; criterion: string }
  >;
  controls: {
    pause: string;
    play: string;
    stepList: string;
    /** Asks the page to name each stage aloud as the walk reaches it. */
    narrate: string;
    silence: string;
    pauseVoice: string;
    resumeVoice: string;
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
      lead: "One continuous lifecycle. ",
      accent: "Smaller loops",
      trail: " at every stage.",
    },
    intro:
      "We design, build, and validate before release—then operate, listen, and improve. Every loop has a purpose. Every release moves the product forward.",
    quote:
      "The main lifecycle connects the loops; feedback returns where it matters.",
    target: {
      eyebrow: "The mission",
      statement: ["The bridge to", "tomorrow’s internet."],
      note: "One lifecycle · smaller loops",
    },
    innerLoop:
      "Training is a loop of its own: the best model from one provider proves itself, then an event hands off to the best from the next provider, each iterating on its own, first locally, then in beta, through this same loop. The big loop waits until the small one closes.",
    subcycles: {
      concept: {
        title: "Discovery loop",
        steps: ["Discover", "Design", "Prototype", "Review", "Repeat"],
        criterion: "A clear concept and a reviewed prototype.",
      },
      plan: {
        title: "Discovery loop",
        steps: ["Discover", "Design", "Prototype", "Review", "Repeat"],
        criterion: "A clear concept and a reviewed prototype.",
      },
      tools: {
        title: "Development loop",
        steps: ["Build", "Test", "Review", "Fix", "Repeat"],
        criterion: "A validated release candidate.",
      },
      local: {
        title: "Development loop",
        steps: ["Build", "Test", "Review", "Fix", "Repeat"],
        criterion: "A validated release candidate.",
      },
      test: {
        title: "Development loop",
        steps: ["Build", "Test", "Review", "Fix", "Repeat"],
        criterion: "A validated release candidate.",
      },
      secure: {
        title: "Development loop",
        steps: ["Build", "Test", "Review", "Fix", "Repeat"],
        criterion: "A validated release candidate.",
      },
      deliver: {
        title: "Delivery loop",
        steps: ["Deploy", "Verify", "Observe", "Adjust", "Revalidate"],
        criterion: "A verified production release.",
      },
      production: {
        title: "Delivery loop",
        steps: ["Deploy", "Verify", "Observe", "Adjust", "Revalidate"],
        criterion: "A verified production release.",
      },
      sustain: {
        title: "Learning loop",
        steps: ["Measure", "Gather feedback", "Improve", "Evaluate", "Repeat"],
        criterion: "An improvement ready for planning.",
      },
      listen: {
        title: "Learning loop",
        steps: ["Measure", "Gather feedback", "Improve", "Evaluate", "Repeat"],
        criterion: "An improvement ready for planning.",
      },
      train: {
        title: "Learning loop",
        steps: ["Measure", "Gather feedback", "Improve", "Evaluate", "Repeat"],
        criterion: "An improvement ready for planning.",
      },
    },
    controls: {
      pause: "Pause the loop",
      play: "Play the loop",
      stepList: "Stages of the loop",
      narrate: "Hear the loop",
      silence: "Stop the voice",
      pauseVoice: "Pause the voice",
      resumeVoice: "Resume the voice",
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
        id: "sustain",
        title: "Sustain",
        summary:
          "Nobody builds software for free, so every cycle has to pay for itself: free if your conversations help train the models, paid if you would rather they did not.",
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
          "What the free plan agreed to share trains the models, paid work never does, and every model provider gets its turn.",
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
      lead: "Un cycle de vie continu. ",
      accent: "De petites boucles",
      trail: " à chaque étape.",
    },
    intro:
      "Nous concevons, bâtissons et validons avant la sortie, puis nous opérons, écoutons et améliorons. Chaque boucle a un but. Chaque version fait avancer le produit.",
    quote:
      "Le cycle principal relie les boucles; les retours reviennent à l’étape utile.",
    target: {
      eyebrow: "La mission",
      statement: ["Le pont vers", "l’Internet de demain."],
      note: "Un cycle · de petites boucles",
    },
    innerLoop:
      "L’entraînement est une boucle à part : le meilleur modèle d’un fournisseur fait ses preuves, puis un événement passe le relais au meilleur du fournisseur suivant, chacun itérant de lui-même, en local d’abord, puis en bêta, dans cette même boucle. La grande boucle attend que la petite soit bouclée.",
    subcycles: {
      concept: {
        title: "Boucle de découverte",
        steps: [
          "Découvrir",
          "Concevoir",
          "Prototyper",
          "Revoir",
          "Recommencer",
        ],
        criterion: "Un concept clair et un prototype revu.",
      },
      plan: {
        title: "Boucle de découverte",
        steps: [
          "Découvrir",
          "Concevoir",
          "Prototyper",
          "Revoir",
          "Recommencer",
        ],
        criterion: "Un concept clair et un prototype revu.",
      },
      tools: {
        title: "Boucle de développement",
        steps: ["Bâtir", "Tester", "Revoir", "Corriger", "Recommencer"],
        criterion: "Une version candidate validée.",
      },
      local: {
        title: "Boucle de développement",
        steps: ["Bâtir", "Tester", "Revoir", "Corriger", "Recommencer"],
        criterion: "Une version candidate validée.",
      },
      test: {
        title: "Boucle de développement",
        steps: ["Bâtir", "Tester", "Revoir", "Corriger", "Recommencer"],
        criterion: "Une version candidate validée.",
      },
      secure: {
        title: "Boucle de développement",
        steps: ["Bâtir", "Tester", "Revoir", "Corriger", "Recommencer"],
        criterion: "Une version candidate validée.",
      },
      deliver: {
        title: "Boucle de livraison",
        steps: ["Déployer", "Vérifier", "Observer", "Ajuster", "Revalider"],
        criterion: "Une version de production vérifiée.",
      },
      production: {
        title: "Boucle de livraison",
        steps: ["Déployer", "Vérifier", "Observer", "Ajuster", "Revalider"],
        criterion: "Une version de production vérifiée.",
      },
      sustain: {
        title: "Boucle d’apprentissage",
        steps: [
          "Mesurer",
          "Recueillir les retours",
          "Améliorer",
          "Évaluer",
          "Recommencer",
        ],
        criterion: "Une amélioration prête pour le plan.",
      },
      listen: {
        title: "Boucle d’apprentissage",
        steps: [
          "Mesurer",
          "Recueillir les retours",
          "Améliorer",
          "Évaluer",
          "Recommencer",
        ],
        criterion: "Une amélioration prête pour le plan.",
      },
      train: {
        title: "Boucle d’apprentissage",
        steps: [
          "Mesurer",
          "Recueillir les retours",
          "Améliorer",
          "Évaluer",
          "Recommencer",
        ],
        criterion: "Une amélioration prête pour le plan.",
      },
    },
    controls: {
      pause: "Mettre la boucle en pause",
      play: "Relancer la boucle",
      stepList: "Les étapes de la boucle",
      narrate: "Écouter la boucle",
      silence: "Arrêter la voix",
      pauseVoice: "Mettre la voix en pause",
      resumeVoice: "Reprendre la voix",
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
        id: "sustain",
        title: "Financement",
        summary:
          "Personne ne bâtit un logiciel gratuitement : chaque cycle doit donc se payer lui-même. C’est gratuit si vos conversations aident à entraîner les modèles, payant si vous préférez qu’elles n’y servent pas.",
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
          "Ce que le forfait gratuit accepte de partager entraîne les modèles, le payant n’y sert jamais, et chaque fournisseur de modèles a son tour.",
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
