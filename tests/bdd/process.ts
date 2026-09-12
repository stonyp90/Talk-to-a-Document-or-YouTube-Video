import { expect, type Page } from "@playwright/test";
import {
  PROCESS_STEP_IDS,
  resolveProcessCopy,
} from "../../apps/web/app/content/process";
import type { Step, World } from "./steps";

type Helpers = { page: (w: World) => Promise<Page> };

/** The landing page explains the build loop and the mission to visitors. */
export function registerProcessChecks(step: Step, h: Helpers) {
  const copy = resolveProcessCopy("en");
  const section = (p: Page) => p.locator("#how-we-build");
  const stages = (p: Page) =>
    section(p)
      .getByRole("list", { name: copy.controls.stepList })
      .getByRole("listitem");

  step(
    "the build loop lists every stage from concept to training",
    async function () {
      const p = await h.page(this);
      await expect(stages(p)).toHaveCount(PROCESS_STEP_IDS.length);
      await expect(stages(p)).toContainText(copy.steps.map((s) => s.title));
      await expect(stages(p)).toContainText(copy.steps.map((s) => s.summary));
    },
  );
  step(
    "the build loop names security, compliance and continuous delivery",
    async function () {
      const p = await h.page(this);
      await expect(section(p)).toContainText(/security and compliance/i);
      await expect(section(p)).toContainText(
        /continuous integration and delivery/i,
      );
    },
  );
  step("the Ursly mission is stated in plain words", async function () {
    const p = await h.page(this);
    await expect(
      section(p).getByRole("heading", { name: copy.mission.heading }),
    ).toBeVisible();
    // The mission used to point at a workspace on the same page. It now
    // crosses to the application, so assert the shape of the route rather
    // than a fragment that no longer exists here.
    await expect(
      section(p).getByRole("link", { name: copy.mission.primary }),
    ).toHaveAttribute("href", /^\/(en|fr)\/app$/);
  });
  step("the mission call to action opens the app", async function () {
    const p = await h.page(this);
    // Stronger than the old href string: the link is followed and the
    // application is proven to be on the other side of it.
    await section(p).getByRole("link", { name: copy.mission.primary }).click();
    expect(new URL(p.url()).pathname).toMatch(/^\/(en|fr)\/app$/);
    await expect(p.locator("#workspace")).toBeVisible();
  });
  step("the build loop animation can be paused", async function () {
    const p = await h.page(this);
    const pause = section(p).getByRole("button", {
      name: copy.controls.pause,
    });
    await pause.scrollIntoViewIfNeeded();
    await pause.click();
    await expect(
      section(p).getByRole("button", { name: copy.controls.play }),
    ).toBeVisible();
    const secure = PROCESS_STEP_IDS.indexOf("secure");
    await stages(p).nth(secure).getByRole("button").click();
    await expect(stages(p).nth(secure).getByRole("button")).toHaveAttribute(
      "aria-current",
      "step",
    );
  });
}
