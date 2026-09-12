/**
 * What Ursly costs, said in the app in the same words as the web section
 * (apps/web/app/content/pricing.ts): free, where your questions and answers
 * help train the models and your voice only with a separate consent, or paid,
 * where nothing of yours is ever used for training.
 *
 * Every line is a TranslationKey, so the compiler refuses copy that has no
 * French translation, and the figure and the sign-up link are configuration
 * rather than code. That is what lets the app state the deal honestly before
 * billing exists: with nothing configured there is no button and no number,
 * only the standing promise that everyone is on the free terms.
 */
import type { TranslationKey } from "./i18n";

/** Free first: it is the way in, and its condition needs reading. */
export const PRICING_PLAN_IDS = ["free", "paid"] as const;
export type PricingPlanId = (typeof PRICING_PLAN_IDS)[number];

export const PAID_PRICE_VARIABLE = "EXPO_PUBLIC_PAID_PLAN_PRICE";
export const PAID_URL_VARIABLE = "EXPO_PUBLIC_PAID_PLAN_URL";

/** An unset or blank variable reads as "not configured", never as a value. */
function configured(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * The paid figure, exactly as it should be printed. Written out in full so
 * the Expo bundler can inline it into the native build.
 */
export function paidPlanPrice(): string | undefined {
  return configured(process.env.EXPO_PUBLIC_PAID_PLAN_PRICE);
}

/** Where "Get the paid plan" goes. Until it is set, there is no button. */
export function paidPlanUrl(): string | undefined {
  return configured(process.env.EXPO_PUBLIC_PAID_PLAN_URL);
}

export type PricingPlan = {
  id: PricingPlanId;
  name: TranslationKey;
  /** The paid plan's figure until configuration supplies a real one. */
  amount: TranslationKey;
  cadence: TranslationKey;
  /** The trade, in one line: what this plan costs you. */
  deal: TranslationKey;
  points: readonly TranslationKey[];
  action: TranslationKey;
  note: TranslationKey;
};

export type PricingCopy = {
  eyebrow: TranslationKey;
  heading: TranslationKey;
  intro: TranslationKey;
  planListLabel: TranslationKey;
  plans: readonly PricingPlan[];
  /** Shown in place of the action while billing is not open. */
  pending: TranslationKey;
  promise: TranslationKey;
  switchNote: TranslationKey;
};

export const pricingCopy: PricingCopy = {
  eyebrow: "What it costs",
  heading: "Free if you help train the models. Paid if you would rather not.",
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
};

/** What configuration lets a plan actually offer the reader right now. */
export type PlanOffer = {
  /** The configured figure, or undefined while none is set. */
  amount: string | undefined;
  /** True while the plan's printed figure is still only an announcement. */
  announced: boolean;
  /** Where the action leads, or undefined when it stays inside the app. */
  href: string | undefined;
  /** True when the plan has nothing to offer but the "not open yet" line. */
  pending: boolean;
};

/**
 * The honesty rule, kept out of the view so it can be held to a test: the paid
 * plan shows a figure only once one is configured, and a button only once
 * there is somewhere for it to go. Free is always open, and needs no
 * destination because the reader is already in the app.
 */
export function planOffer(plan: PricingPlan): PlanOffer {
  if (plan.id !== "paid")
    return {
      amount: undefined,
      announced: false,
      href: undefined,
      pending: false,
    };
  const amount = paidPlanPrice();
  const href = paidPlanUrl();
  return { amount, announced: !amount, href, pending: !href };
}

/** Every line the section puts on screen, so tests can hold it to one standard. */
export function pricingKeys(): TranslationKey[] {
  const { plans, ...rest } = pricingCopy;
  return [
    ...Object.values(rest),
    ...plans.flatMap((plan) => [
      plan.name,
      plan.amount,
      plan.cadence,
      plan.deal,
      ...plan.points,
      plan.action,
      plan.note,
    ]),
  ].filter((key, index, all) => all.indexOf(key) === index);
}
