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
    zoomIn: string;
    zoomOut: string;
    zoomReset: string;
    zoomHint: string;
    closeDetails: string;
    whyItMatters: string;
    exitSignal: string;
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
        "From concept to production and back through real-world feedback. We design, build, validate, and operate software as one continuous process—with security and quality throughout.",
    quote:
        "Shipping is a milestone. Learning closes the loop, and feedback returns where it matters.",
    target: {
      eyebrow: "The mission",
      statement: ["The bridge to", "tomorrow’s internet."],
      note: "One lifecycle · smaller loops",
    },
    innerLoop:
        "Improvement is a loop of its own: measure, gather feedback, change the product, evaluate the result, and repeat. The main lifecycle can return directly to the stage that needs the change.",
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
        steps: ["Design", "Build", "Test", "Review", "Repeat"],
        criterion: "A validated release candidate.",
      },
      local: {
        title: "Development loop",
        steps: ["Design", "Build", "Test", "Review", "Repeat"],
        criterion: "A validated release candidate.",
      },
      test: {
        title: "Development loop",
        steps: ["Design", "Build", "Test", "Review", "Repeat"],
        criterion: "A validated release candidate.",
      },
      secure: {
        title: "Development loop",
        steps: ["Design", "Build", "Test", "Review", "Repeat"],
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
        criterion: "A change ready to return to the right stage.",
      },
      listen: {
        title: "Learning loop",
        steps: ["Measure", "Gather feedback", "Improve", "Evaluate", "Repeat"],
        criterion: "A change ready to return to the right stage.",
      },
      train: {
        title: "Learning loop",
        steps: ["Measure", "Gather feedback", "Improve", "Evaluate", "Repeat"],
        criterion: "A change ready to return to the right stage.",
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
      zoomIn: "Zoom in on the lifecycle",
      zoomOut: "Zoom out of the lifecycle",
      zoomReset: "Reset lifecycle zoom",
      zoomHint: "Scroll to explore the enlarged lifecycle",
      closeDetails: "Close stage details",
      whyItMatters: "Why it matters",
      exitSignal: "Exit signal",
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
        title: "Design",
        summary:
          "Shape the experience, architecture, and constraints before implementation.",
      },
      {
        id: "local",
        title: "Build",
        summary:
          "Implement the smallest useful product with its dependencies and interfaces clear.",
      },
      {
        id: "test",
        title: "Integrate",
        summary:
          "Bring components together and test their contracts before release validation.",
      },
      {
        id: "secure",
        title: "Validate",
        summary:
          "Check behaviour, quality, privacy, and security throughout the delivery cycle.",
      },
      {
        id: "deliver",
        title: "Release",
        summary:
          "Make a validated version available with a reversible, observable release.",
      },
      {
        id: "production",
        title: "Operate",
        summary: "Keep the live product healthy, useful, and safe for its users.",
      },
      {
        id: "sustain",
        title: "Measure",
        summary:
          "Observe technical health, user experience, and outcomes—not only deployment status.",
      },
      {
        id: "listen",
        title: "Listen",
        summary:
          "Gather feedback from real people and turn it into a clear product signal.",
      },
      {
        id: "train",
        title: "Improve",
        summary:
          "Evaluate the signal, improve the product, and return the work to the stage that needs it.",
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
      "Du concept à la production, puis retour par les retours du monde réel. Nous concevons, bâtissons, validons et opérons le logiciel comme un seul processus continu, avec la sécurité et la qualité partout.",
    quote:
      "La sortie est un jalon. L’apprentissage ferme la boucle et les retours reviennent à l’étape utile.",
    target: {
      eyebrow: "La mission",
      statement: ["Le pont vers", "l’Internet de demain."],
      note: "Un cycle · de petites boucles",
    },
    innerLoop:
      "L’amélioration est une boucle à part : mesurer, recueillir les retours, modifier le produit, évaluer le résultat, puis recommencer. Le cycle principal peut revenir directement à l’étape qui doit changer.",
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
        steps: ["Concevoir", "Bâtir", "Tester", "Revoir", "Recommencer"],
        criterion: "Une version candidate validée.",
      },
      local: {
        title: "Boucle de développement",
        steps: ["Concevoir", "Bâtir", "Tester", "Revoir", "Recommencer"],
        criterion: "Une version candidate validée.",
      },
      test: {
        title: "Boucle de développement",
        steps: ["Concevoir", "Bâtir", "Tester", "Revoir", "Recommencer"],
        criterion: "Une version candidate validée.",
      },
      secure: {
        title: "Boucle de développement",
        steps: ["Concevoir", "Bâtir", "Tester", "Revoir", "Recommencer"],
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
        criterion: "Un changement prêt à revenir à l’étape utile.",
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
        criterion: "Un changement prêt à revenir à l’étape utile.",
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
        criterion: "Un changement prêt à revenir à l’étape utile.",
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
      zoomIn: "Agrandir le cycle de vie",
      zoomOut: "Réduire le cycle de vie",
      zoomReset: "Réinitialiser le zoom du cycle",
      zoomHint: "Faire défiler pour explorer le cycle agrandi",
      closeDetails: "Fermer les détails de l’étape",
      whyItMatters: "Pourquoi c’est important",
      exitSignal: "Signal de sortie",
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
        title: "Concevoir",
        summary:
          "Façonner l’expérience, l’architecture et les contraintes avant l’implémentation.",
      },
      {
        id: "local",
        title: "Bâtir",
        summary:
          "Implémenter le plus petit produit utile, avec ses dépendances et ses interfaces claires.",
      },
      {
        id: "test",
        title: "Intégrer",
        summary:
          "Réunir les composants et tester leurs contrats avant la validation de sortie.",
      },
      {
        id: "secure",
        title: "Valider",
        summary:
          "Vérifier le comportement, la qualité, la confidentialité et la sécurité pendant tout le cycle.",
      },
      {
        id: "deliver",
        title: "Sortir",
        summary:
          "Rendre une version validée disponible avec une sortie réversible et observable.",
      },
      {
        id: "production",
        title: "Opérer",
        summary: "Garder le produit en ligne sain, utile et sûr pour ses utilisateurs.",
      },
      {
        id: "sustain",
        title: "Mesurer",
        summary:
          "Observer la santé technique, l’expérience et les résultats, pas seulement l’état du déploiement.",
      },
      {
        id: "listen",
        title: "Écoute",
        summary:
          "Recueillir les retours de vraies personnes et en faire un signal produit clair.",
      },
      {
        id: "train",
        title: "Améliorer",
        summary:
          "Évaluer le signal, améliorer le produit et renvoyer le travail à l’étape qui en a besoin.",
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
