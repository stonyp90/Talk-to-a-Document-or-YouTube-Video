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
  /**
   * The first screen and the whole of how we build are one element now: the
   * page no longer promises the loop in a hero and explains it in a section
   * below. Both names are kept because both are what the page is asked for —
   * the menu's anchor and the screen a visitor arrives on — and either would
   * catch the day they stop being the same thing.
   */
  const section = (p: Page) => p.locator("#how-we-build");
  const hero = (p: Page) => p.locator(".landing-hero");
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
      // The summaries are off the screen now — the caption under the drawing
      // recites the lit stage instead — but they are still in the page for
      // anyone reading it aloud, and text assertions read `textContent`,
      // which a visually hidden span is part of. Losing them entirely would
      // still fail here, which is the point of keeping the assertion.
      await expect(stages(p)).toContainText(copy.steps.map((s) => s.summary));
    },
  );
  step(
    "the build loop names security, compliance and continuous delivery",
    async function () {
      const p = await h.page(this);
      // Both sentences live in those hidden summaries. They are a promise the
      // page makes about how it is built, so it has to keep making it to
      // everyone, whether or not the sentence is currently drawn.
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
    // The picture, its control and the rail of stages now stand on the one
    // screen, and both the ring and the rail move the same walk: a stage
    // chosen in the words is the stage lit in the drawing.
    const pause = hero(p).getByRole("button", { name: copy.controls.pause });
    await pause.scrollIntoViewIfNeeded();
    await pause.click();
    await expect(
      hero(p).getByRole("button", { name: copy.controls.play }),
    ).toBeVisible();
    const secure = PROCESS_STEP_IDS.indexOf("secure");
    await stages(p).nth(secure).getByRole("button").click();
    await expect(stages(p).nth(secure).getByRole("button")).toHaveAttribute(
      "aria-current",
      "step",
    );
    await expect(hero(p).locator('[data-stage="secure"]')).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  step("the page opens on the build loop itself", async function () {
    const p = await h.page(this);
    const diagram = hero(p).getByTestId("loop-diagram");
    await expect(diagram).toBeVisible();
    // In the first screen, before anything has been scrolled past.
    await expect(diagram).toBeInViewport();
    await expect(hero(p).getByTestId("loop-caption")).toContainText(
      copy.steps[0].title,
    );
    await expect(p.getByRole("heading", { level: 1 })).toContainText(
      /build software/i,
    );
  });

  step(
    "the loop, every stage of it and the way in stand on one screen",
    async function () {
      const p = await h.page(this);
      // On a desktop screen, because the claim is about a screen rather than
      // about a phone's scroll. The argument used to be told three times down
      // the page — named in the lede, drawn on the ring, then listed again a
      // screen below — and this is the step that stops the third telling
      // drifting back under the fold.
      await p.setViewportSize({ width: 1440, height: 900 });
      await p.evaluate(() => window.scrollTo(0, 0));
      // Whole, not merely touching the bottom edge: a rail half off the
      // screen is a rail a reader has to go looking for.
      for (const part of [
        hero(p).getByTestId("loop-diagram"),
        hero(p).getByRole("list", { name: copy.controls.stepList }),
        hero(p).locator('.hero-actions a[href$="/app"]'),
      ])
        await expect(part).toBeInViewport({ ratio: 1 });
    },
  );
}
