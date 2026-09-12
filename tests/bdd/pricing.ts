import { expect, type Page } from "@playwright/test";
import { resolveProcessCopy } from "../../apps/web/app/content/process";
import { resolvePricingCopy } from "../../apps/web/app/content/pricing";
import type { Step, World } from "./steps";

type Helpers = { page: (w: World) => Promise<Page> };

/** The landing page says what Ursly costs, and what "free" costs you. */
export function registerPricingChecks(step: Step, h: Helpers) {
  const copy = resolvePricingCopy("en");
  const [free, paid] = copy.plans;
  const section = (p: Page) => p.locator("#pricing");
  const card = (p: Page, id: string) =>
    section(p).locator(`[data-plan="${id}"]`);

  step("the two ways to pay are stated side by side", async function () {
    const p = await h.page(this);
    await expect(section(p)).toContainText(copy.heading);
    await expect(section(p)).toContainText(copy.intro);
    await expect(card(p, "free")).toBeVisible();
    await expect(card(p, "paid")).toBeVisible();
    await expect(section(p)).toContainText(copy.promise);
  });

  step(
    "the free way says conversations help train the models",
    async function () {
      const p = await h.page(this);
      await expect(card(p, "free")).toContainText(free.deal);
      await expect(card(p, "free")).toContainText(/used to train the models/i);
      await expect(
        card(p, "free").getByRole("link", { name: free.action }),
      ).toHaveAttribute("href", /^\/(en|fr)\/app$/);
    },
  );

  step(
    "the paid way says nothing of mine is used for training",
    async function () {
      const p = await h.page(this);
      await expect(card(p, "paid")).toContainText(paid.deal);
      await expect(card(p, "paid")).toContainText(
        /never used to train a model/i,
      );
    },
  );

  step(
    "the build loop names paying for the work as one of its stages",
    async function () {
      const p = await h.page(this);
      const sustain = resolveProcessCopy("en").steps.find(
        (candidate) => candidate.id === "sustain",
      )!;
      await expect(p.locator("#how-we-build")).toContainText(sustain.title);
      await expect(p.locator("#how-we-build")).toContainText(sustain.summary);
    },
  );
}
