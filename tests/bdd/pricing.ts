import { expect, type Page } from "@playwright/test";
import { resolveProcessCopy } from "../../apps/web/app/content/process";
import type { Step, World } from "./steps";

type Helpers = { page: (w: World) => Promise<Page> };

/** The build loop names the sustain stage, which is where paying for the work lives. */
export function registerPricingChecks(step: Step, h: Helpers) {
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
