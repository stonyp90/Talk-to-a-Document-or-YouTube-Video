/**
 * Copy for the "What it costs" section. English is the source; other locales
 * translate the same keys and anything unsupported falls back to English.
 *
 * The product is paid for in one of two ways, and the page says which:
 * free, where what you say helps train the models, or paid, where it never
 * does. The figure and the sign-up link are configuration, not code, so the
 * page can state the model honestly before billing exists.
 */
export type PricingLocale = "en" | "fr";
export const DEFAULT_PRICING_LOCALE: PricingLocale = "en";

/** Free first: it is the way in, and its condition needs reading. */
export const PRICING_PLAN_IDS = ["free", "paid"] as const;
export type PricingPlanId = (typeof PRICING_PLAN_IDS)[number];

export const PAID_PRICE_VARIABLE = "NEXT_PUBLIC_PAID_PLAN_PRICE";
export const PAID_URL_VARIABLE = "NEXT_PUBLIC_PAID_PLAN_URL";

/** An unset or blank variable reads as "not configured", never as a value. */
function configured(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The paid figure, exactly as it should be printed. Written out in full so
 * the bundler can inline it into the browser build.
 */
export function paidPlanPrice(): string | undefined {
  return configured(process.env.NEXT_PUBLIC_PAID_PLAN_PRICE);
}

/** Where "Get the paid plan" goes. Until it is set, there is no button. */
export function paidPlanUrl(): string | undefined {
  return configured(process.env.NEXT_PUBLIC_PAID_PLAN_URL);
}

export type PricingPlan = {
  id: PricingPlanId;
  name: string;
  /** The paid plan's figure until configuration supplies a real one. */
  amount: string;
  cadence: string;
  /** The trade, in one line: what this plan costs you. */
  deal: string;
  points: string[];
  action: string;
  note: string;
};

export type PricingCopy = {
  eyebrow: string;
  heading: string;
  intro: string;
  planListLabel: string;
  plans: PricingPlan[];
  /** Shown in place of the action while billing is not open. */
  pending: string;
  promise: string;
  switchNote: string;
};

export const pricingCopy: Record<PricingLocale, PricingCopy> = {
  en: {
    eyebrow: "What it costs",
    heading:
      "Free if you help train the models. Paid if you would rather not.",
    intro:
      "Nobody builds software for free, and we would rather say so than hide it. So there are two ways to use Ursly, and you choose which one. Free costs no money: your questions and the answers you get are used to train the models, and your voice too if you allow that separately. Paid costs money: nothing you bring, say or record is used for training, ever.",
    planListLabel: "The two ways to use Ursly",
    plans: [
      {
        id: "free",
        name: "Free",
        amount: "Free",
        cadence: "You pay by helping us train.",
        deal: "Your conversations help train the models.",
        points: [
          "The whole product: PDF and captioned YouTube sources, live voice, motion and typing.",
          "Your questions and Ursly’s answers are used to train the models that answer you.",
          "Your voice recordings are used only if you allow that separately, and you can delete them in one tap.",
          "Switch to paid whenever you like; what you send from then on stays out of training.",
        ],
        action: "Start free",
        note: "No card, no trial clock. Helping us train is the price of free, and we ask before we keep anything.",
      },
      {
        id: "paid",
        name: "Paid",
        amount: "Price announced before billing opens",
        cadence: "per person, per month",
        deal: "Nothing you say or upload is ever used for training.",
        points: [
          "The same whole product. You are paying for privacy, not for extra features.",
          "Your sources, questions, answers and recordings are never used to train a model, ours or a provider’s.",
          "They are kept only as long as your conversation needs them, then deleted.",
          "Cancel whenever you like; the free terms apply again from that moment, never backwards.",
        ],
        action: "Get the paid plan",
        note: "The same features as free, minus the contribution to training.",
      },
    ],
    pending:
      "Billing is not open yet. Until it is, everyone is on the free terms, and we will ask before anything changes.",
    promise:
      "Either way, we ask before we keep anything, we say what it is for, and we delete it when you ask. Free means your data helps. It never means your data is taken.",
    switchNote:
      "Switch between the two whenever you want. The plan you are on decides what happens to what you send while you are on it, and nothing is applied backwards.",
  },
  fr: {
    eyebrow: "Ce que ça coûte",
    heading:
      "Gratuit si vous aidez à entraîner les modèles. Payant si vous préférez que non.",
    intro:
      "Personne ne bâtit un logiciel gratuitement, et nous préférons le dire plutôt que le cacher. Il y a donc deux façons d’utiliser Ursly, et c’est vous qui choisissez. Le gratuit ne coûte pas d’argent : vos questions et les réponses reçues servent à entraîner les modèles, et votre voix aussi si vous l’autorisez à part. Le payant coûte de l’argent : rien de ce que vous apportez, dites ou enregistrez ne sert à l’entraînement, jamais.",
    planListLabel: "Les deux façons d’utiliser Ursly",
    plans: [
      {
        id: "free",
        name: "Gratuit",
        amount: "Gratuit",
        cadence: "Vous payez en nous aidant à entraîner.",
        deal: "Vos conversations aident à entraîner les modèles.",
        points: [
          "Tout le produit : sources PDF et vidéos YouTube sous-titrées, voix en direct, mouvement et clavier.",
          "Vos questions et les réponses d’Ursly servent à entraîner les modèles qui vous répondent.",
          "Vos enregistrements vocaux ne servent que si vous l’autorisez à part, et vous pouvez les supprimer en une touche.",
          "Passez au payant quand vous voulez ; ce que vous envoyez à partir de là reste hors de l’entraînement.",
        ],
        action: "Commencer gratuitement",
        note: "Pas de carte, pas de compte à rebours. Aider à entraîner, c’est le prix du gratuit, et nous demandons avant de conserver quoi que ce soit.",
      },
      {
        id: "paid",
        name: "Payant",
        amount: "Prix annoncé avant l’ouverture de la facturation",
        cadence: "par personne, par mois",
        deal: "Rien de ce que vous dites ou téléversez ne sert jamais à l’entraînement.",
        points: [
          "Le même produit au complet. Vous payez pour la confidentialité, pas pour des options de plus.",
          "Vos sources, questions, réponses et enregistrements ne servent jamais à entraîner un modèle, ni le nôtre ni celui d’un fournisseur.",
          "Ils sont conservés le temps que votre conversation en a besoin, puis supprimés.",
          "Annulez quand vous voulez ; les conditions du gratuit reprennent à partir de ce moment, jamais rétroactivement.",
        ],
        action: "Prendre le forfait payant",
        note: "Les mêmes fonctions que le gratuit, sans la contribution à l’entraînement.",
      },
    ],
    pending:
      "La facturation n’est pas encore ouverte. D’ici là, tout le monde est aux conditions du gratuit, et nous demanderons avant tout changement.",
    promise:
      "Dans les deux cas, nous demandons avant de conserver quoi que ce soit, nous disons à quoi ça sert, et nous supprimons sur demande. Gratuit veut dire que vos données aident ; jamais qu’on vous les prend.",
    switchNote:
      "Changez de forfait quand vous voulez. Le forfait en cours décide de ce qui arrive à ce que vous envoyez pendant qu’il est actif, et rien n’est appliqué rétroactivement.",
  },
};

/** "fr-CA" resolves to French; anything unsupported resolves to English. */
export function resolvePricingCopy(locale?: string): PricingCopy {
  const language = locale?.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return Object.hasOwn(pricingCopy, language)
    ? pricingCopy[language as PricingLocale]
    : pricingCopy[DEFAULT_PRICING_LOCALE];
}
