import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PRICING_LOCALE,
  PAID_PRICE_VARIABLE,
  PAID_URL_VARIABLE,
  PRICING_PLAN_IDS,
  paidPlanPrice,
  paidPlanUrl,
  pricingCopy,
  resolvePricingCopy,
  type PricingCopy,
  type PricingPlanId,
} from "./pricing";

const locales = Object.keys(pricingCopy) as Array<keyof typeof pricingCopy>;
const plan = (copy: PricingCopy, id: PricingPlanId) =>
  copy.plans.find((candidate) => candidate.id === id)!;

function strings(value: unknown, path: string[] = []): Array<[string, string]> {
  if (typeof value === "string") return [[path.join("."), value]];
  if (Array.isArray(value))
    return value.flatMap((item, index) =>
      strings(item, [...path, String(index)]),
    );
  if (value && typeof value === "object")
    return Object.entries(value).flatMap(([key, item]) =>
      strings(item, [...path, key]),
    );
  return [];
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("pricing copy", () => {
  it("offers two ways in, free first, paid second, in every locale", () => {
    expect(PRICING_PLAN_IDS).toEqual(["free", "paid"]);
    for (const locale of locales)
      expect(pricingCopy[locale].plans.map((entry) => entry.id)).toEqual(
        PRICING_PLAN_IDS,
      );
  });

  it("says out loud that the work is not done for free", () => {
    expect(pricingCopy.en.intro).toMatch(/nobody builds software for free/i);
    expect(pricingCopy.fr.intro).toMatch(/gratuitement/i);
    expect(pricingCopy.en.heading).toMatch(/free/i);
    expect(pricingCopy.en.heading).toMatch(/paid/i);
    expect(pricingCopy.fr.heading).toMatch(/gratuit/i);
    expect(pricingCopy.fr.heading).toMatch(/payant/i);
  });

  it("makes the free plan's condition unmistakable: you help train the models", () => {
    const free = plan(pricingCopy.en, "free");
    expect(free.amount).toMatch(/free/i);
    expect(free.deal).toMatch(/train/i);
    expect(free.points.join(" ")).toMatch(/used to train the models/i);
    expect(free.points.join(" ")).toMatch(/delete/i);
    const libre = plan(pricingCopy.fr, "free");
    expect(libre.deal).toMatch(/entraîn/i);
    expect(libre.points.join(" ")).toMatch(/entraîner les modèles/i);
    expect(libre.points.join(" ")).toMatch(/supprim/i);
  });

  it("makes the paid plan's promise unmistakable: nothing of yours is trained on", () => {
    const paid = plan(pricingCopy.en, "paid");
    expect(paid.deal).toMatch(/never|nothing/i);
    expect(paid.deal).toMatch(/train/i);
    expect(paid.points.join(" ")).toMatch(/never (used to )?train/i);
    expect(paid.note).toMatch(/same/i);
    const payant = plan(pricingCopy.fr, "paid");
    expect(payant.deal).toMatch(/jamais|rien/i);
    expect(payant.deal).toMatch(/entraîn/i);
    expect(payant.points.join(" ")).toMatch(/jamais/i);
  });

  it("says consent is asked first and can be taken back", () => {
    expect(pricingCopy.en.promise).toMatch(/ask/i);
    expect(pricingCopy.en.promise).toMatch(/delete/i);
    expect(pricingCopy.en.switchNote).toMatch(/switch/i);
    expect(pricingCopy.fr.promise).toMatch(/supprim/i);
    expect(pricingCopy.fr.switchNote).toMatch(/chang|pass/i);
  });

  it("translates every English key, leaving nothing blank", () => {
    const source = strings(pricingCopy.en);
    for (const locale of locales) {
      const translated = strings(pricingCopy[locale]);
      expect(translated.map(([key]) => key)).toEqual(source.map(([key]) => key));
      for (const [key, text] of translated)
        expect(text.trim(), `${locale}: ${key}`).not.toBe("");
    }
  });

  it("falls back to English for unsupported locales", () => {
    expect(DEFAULT_PRICING_LOCALE).toBe("en");
    expect(resolvePricingCopy()).toBe(pricingCopy.en);
    expect(resolvePricingCopy("de-CH")).toBe(pricingCopy.en);
    expect(resolvePricingCopy("fr-CA")).toBe(pricingCopy.fr);
    expect(resolvePricingCopy("EN-GB")).toBe(pricingCopy.en);
  });

  it("takes the figure and the sign-up link from configuration, never from the code", () => {
    expect(PAID_PRICE_VARIABLE).toMatch(/^NEXT_PUBLIC_/);
    expect(PAID_URL_VARIABLE).toMatch(/^NEXT_PUBLIC_/);
    vi.stubEnv(PAID_PRICE_VARIABLE, "");
    vi.stubEnv(PAID_URL_VARIABLE, "   ");
    expect(paidPlanPrice()).toBeUndefined();
    expect(paidPlanUrl()).toBeUndefined();
    vi.stubEnv(PAID_PRICE_VARIABLE, " 9 $ / month ");
    vi.stubEnv(PAID_URL_VARIABLE, "https://ursly.io/paid");
    expect(paidPlanPrice()).toBe("9 $ / month");
    expect(paidPlanUrl()).toBe("https://ursly.io/paid");
  });

  it("keeps the unpriced plan honest until billing opens", () => {
    const paid = plan(pricingCopy.en, "paid");
    expect(paid.amount).toMatch(/announced|not yet/i);
    expect(pricingCopy.en.pending).toMatch(/free terms/i);
    expect(pricingCopy.fr.pending).toMatch(/gratuit/i);
  });
});
