import { test } from "node:test";
import assert from "node:assert/strict";
import { french, translate } from "../src/i18n";
import {
  PAID_PRICE_VARIABLE,
  PAID_URL_VARIABLE,
  PRICING_PLAN_IDS,
  paidPlanPrice,
  paidPlanUrl,
  planOffer,
  pricingCopy,
  pricingKeys,
  type PricingPlanId,
} from "../src/pricing";

const plan = (id: PricingPlanId) =>
  pricingCopy.plans.find((candidate) => candidate.id === id)!;

/** What the reader is actually shown for a plan, in one string. */
const spoken = (id: PricingPlanId, language: "en" | "fr") => {
  const entry = plan(id);
  return [
    entry.name,
    entry.amount,
    entry.cadence,
    entry.deal,
    ...entry.points,
    entry.action,
    entry.note,
  ]
    .map((key) => translate(language, key))
    .join(" ");
};

/** Runs body with the two configuration variables set, then puts them back. */
function withConfig(
  values: { price?: string; url?: string },
  body: () => void,
) {
  const before = {
    price: process.env[PAID_PRICE_VARIABLE],
    url: process.env[PAID_URL_VARIABLE],
  };
  const apply = (price: string | undefined, url: string | undefined) => {
    if (price === undefined) delete process.env[PAID_PRICE_VARIABLE];
    else process.env[PAID_PRICE_VARIABLE] = price;
    if (url === undefined) delete process.env[PAID_URL_VARIABLE];
    else process.env[PAID_URL_VARIABLE] = url;
  };
  apply(values.price, values.url);
  try {
    body();
  } finally {
    apply(before.price, before.url);
  }
}

test("there are two ways to use Ursly, free first and paid second", () => {
  assert.deepEqual([...PRICING_PLAN_IDS], ["free", "paid"]);
  assert.deepEqual(
    pricingCopy.plans.map((entry) => entry.id),
    ["free", "paid"],
  );
});

test("the section says out loud that the work is not done for free", () => {
  assert.match(
    translate("en", pricingCopy.intro),
    /nobody builds software for free/i,
  );
  assert.match(translate("en", pricingCopy.heading), /free/i);
  assert.match(translate("en", pricingCopy.heading), /paid/i);
  assert.match(translate("fr", pricingCopy.intro), /gratuitement/i);
  assert.match(translate("fr", pricingCopy.heading), /gratuit/i);
  assert.match(translate("fr", pricingCopy.heading), /payant/i);
});

test("the free plan states the training condition, the separate voice consent and deletion", () => {
  const free = plan("free");
  assert.match(translate("en", free.amount), /free/i);
  assert.match(translate("en", free.deal), /train/i);
  const english = spoken("free", "en");
  assert.match(english, /used to train the models/i);
  assert.match(
    english,
    /voice recordings are used only if you allow that separately/i,
  );
  assert.match(english, /delete/i);
  const francais = spoken("free", "fr");
  assert.match(translate("fr", free.deal), /entraîn/i);
  assert.match(francais, /entraîner les modèles/i);
  assert.match(francais, /autorisez à part/i);
  assert.match(francais, /supprim/i);
});

test("the paid plan states that nothing of yours is ever used for training", () => {
  const paid = plan("paid");
  assert.match(translate("en", paid.deal), /never|nothing/i);
  assert.match(translate("en", paid.deal), /train/i);
  const english = spoken("paid", "en");
  assert.match(english, /never used to train a model/i);
  assert.match(english, /same/i);
  const francais = spoken("paid", "fr");
  assert.match(translate("fr", paid.deal), /jamais|rien/i);
  assert.match(francais, /jamais/i);
  assert.match(francais, /entraîn/i);
});

test("consent is asked first, can be withdrawn, and never applies backwards", () => {
  assert.match(translate("en", pricingCopy.promise), /ask/i);
  assert.match(translate("en", pricingCopy.promise), /delete/i);
  assert.match(translate("en", pricingCopy.switchNote), /switch/i);
  assert.match(translate("en", pricingCopy.switchNote), /backwards/i);
  assert.match(translate("fr", pricingCopy.promise), /supprim/i);
  assert.match(translate("fr", pricingCopy.switchNote), /chang|pass/i);
});

test("billing is not open, and everyone is on the free terms until it is", () => {
  assert.match(translate("en", plan("paid").amount), /announced|not yet/i);
  assert.match(translate("en", pricingCopy.pending), /billing is not open/i);
  assert.match(translate("en", pricingCopy.pending), /free terms/i);
  assert.match(translate("fr", pricingCopy.pending), /facturation/i);
  assert.match(translate("fr", pricingCopy.pending), /gratuit/i);
});

test("every line of the section is translated, and English stays the source", () => {
  const keys = pricingKeys();
  assert.ok(keys.length > 0);
  for (const key of keys) {
    assert.ok(
      Object.hasOwn(french, key),
      `"${key}" is shown by the pricing section but has no French translation`,
    );
    assert.equal(translate("en", key), key);
    assert.ok(
      translate("fr", key).trim(),
      `"${key}" translates to blank French`,
    );
    assert.notEqual(
      translate("fr", key),
      key,
      `"${key}" was left in English on the French side`,
    );
  }
  assert.equal(new Set(keys).size, keys.length, "the section repeats a line");
});

test("the French lines use typographic apostrophes and non-breaking spaces", () => {
  const lines = pricingKeys().map((key) => translate("fr", key));
  for (const line of lines) {
    assert.doesNotMatch(line, /'/, `"${line}" uses a straight apostrophe`);
    assert.doesNotMatch(
      line,
      /\u0020[;:?!\u00BB]/,
      `"${line}" leaves a breaking space before two-part punctuation`,
    );
  }
  assert.ok(
    lines.some((line) => /\u00A0[;:?!\u00BB]/.test(line)),
    "no French line pins two-part punctuation with a non-breaking space",
  );
});

test("the figure and the sign-up link come from configuration, never from the code", () => {
  assert.match(PAID_PRICE_VARIABLE, /^EXPO_PUBLIC_/);
  assert.match(PAID_URL_VARIABLE, /^EXPO_PUBLIC_/);
  const before = {
    price: process.env[PAID_PRICE_VARIABLE],
    url: process.env[PAID_URL_VARIABLE],
  };
  try {
    delete process.env[PAID_PRICE_VARIABLE];
    delete process.env[PAID_URL_VARIABLE];
    assert.equal(paidPlanPrice(), undefined);
    assert.equal(paidPlanUrl(), undefined);

    process.env[PAID_PRICE_VARIABLE] = "   ";
    process.env[PAID_URL_VARIABLE] = "";
    assert.equal(
      paidPlanPrice(),
      undefined,
      "a blank figure must read as unset",
    );
    assert.equal(paidPlanUrl(), undefined, "a blank link must read as unset");

    process.env[PAID_PRICE_VARIABLE] = " 9 $ / month ";
    process.env[PAID_URL_VARIABLE] = "https://ursly.io/paid";
    assert.equal(paidPlanPrice(), "9 $ / month");
    assert.equal(paidPlanUrl(), "https://ursly.io/paid");
  } finally {
    for (const [name, value] of [
      [PAID_PRICE_VARIABLE, before.price],
      [PAID_URL_VARIABLE, before.url],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});

test("with nothing configured, the paid plan can only say billing is not open", () => {
  withConfig({}, () => {
    const paid = planOffer(plan("paid"));
    assert.equal(paid.pending, true, "no link means no sign-up button");
    assert.equal(paid.href, undefined);
    assert.equal(
      paid.announced,
      true,
      "no figure means the announcement stands",
    );
    assert.equal(paid.amount, undefined);

    const free = planOffer(plan("free"));
    assert.equal(
      free.pending,
      false,
      "the free plan is open whatever billing does",
    );
    assert.equal(free.announced, false);
    assert.equal(
      free.href,
      undefined,
      "free needs no destination inside the app",
    );
  });
});

test("a configured figure and link replace the announcement and open the sign-up", () => {
  withConfig({ price: "9 $ / month", url: "https://ursly.io/paid" }, () => {
    const paid = planOffer(plan("paid"));
    assert.equal(paid.amount, "9 $ / month");
    assert.equal(paid.announced, false);
    assert.equal(paid.href, "https://ursly.io/paid");
    assert.equal(paid.pending, false);
    assert.equal(planOffer(plan("free")).href, undefined);
  });
});

test("a link without a figure opens, and a figure without a link does not", () => {
  withConfig({ url: "https://ursly.io/paid" }, () => {
    const paid = planOffer(plan("paid"));
    assert.equal(
      paid.pending,
      false,
      "a link is enough to let someone sign up",
    );
    assert.equal(
      paid.announced,
      true,
      "the figure is still only an announcement",
    );
  });
  withConfig({ price: "9 $ / month" }, () => {
    const paid = planOffer(plan("paid"));
    assert.equal(paid.amount, "9 $ / month");
    assert.equal(paid.pending, true, "a figure nobody can pay is not a button");
  });
});
