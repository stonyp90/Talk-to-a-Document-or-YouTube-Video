import type { Page } from "@playwright/test";
import { expect, test } from "./base";
import { APP_PATH, LANDING_PATH } from "../routes";

const modes = (page: Page) =>
  page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("radiogroup", { name: "Control mode" });

test("reduced motion keeps source tabs usable without animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(APP_PATH);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("tab", { name: "YouTube video" }).click();
  await expect(page.getByLabel("YouTube URL")).toBeVisible();
  const motion = await page.evaluate(() => ({
    animations: document
      .getAnimations()
      .filter((animation) => animation.playState === "running").length,
    transition: getComputedStyle(document.querySelector(".tabs")!, "::before")
      .transitionDuration,
  }));
  expect(motion).toEqual({ animations: 0, transition: "0s" });
  await page.getByRole("tab", { name: "PDF document" }).click();
  await expect(page.getByLabel("PDF file")).toBeVisible();
});

for (const [name, path] of [
  ["the landing page", LANDING_PATH],
  ["the application", APP_PATH],
] as const) {
  test(`decorative motion on ${name} settles instead of continuously distracting`, async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.goto(path);
    await expect
      .poll(
        () =>
          page.evaluate(
            () =>
              document
                .getAnimations()
                .filter(
                  (animation) =>
                    animation.playState === "running" &&
                    animation.timeline instanceof DocumentTimeline,
                ).length,
          ),
        { timeout: 6500 },
      )
      .toBe(0);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  });
}

const running = (page: Page) =>
  page.evaluate(
    () =>
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === "running" &&
            animation.timeline instanceof DocumentTimeline,
        ).length,
  );

test("the build loop moves only while it is on screen", async ({ page }) => {
  // The section that carries the page's decorative motion now sits alone on
  // the landing page, so the bound on it belongs here: it steps while a
  // reader is looking at the picture, and stops when they are not. Without
  // this, "settles within 6.5s" would pass on a page whose only animation is
  // below the fold, which proves nothing about the animation.
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto(LANDING_PATH);
  await page.locator("#how-we-build").scrollIntoViewIfNeeded();
  await expect.poll(() => running(page), { timeout: 4000 }).toBeGreaterThan(0);
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(() => running(page), { timeout: 6500 }).toBe(0);
  // And a reader who wants it still can stop it while looking straight at it.
  await page.locator("#how-we-build").scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: /Pause/ }).click();
  await expect.poll(() => running(page), { timeout: 6500 }).toBe(0);
});

test("the landing page adds no animation under reduced motion", async ({
  page,
}) => {
  // Even with the picture straight on screen, and including the new hero.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(LANDING_PATH);
  await page.locator("#how-we-build").scrollIntoViewIfNeeded();
  expect(
    await page.evaluate(
      () =>
        document
          .getAnimations()
          .filter((animation) => animation.playState === "running").length,
    ),
  ).toBe(0);
});

test("choosing motion hands the reader the panel, with the camera still off", async ({
  page,
}) => {
  // No camera is granted here on purpose. Everything below is what a reader
  // sees before they decide to start one, which is the part a browser can be
  // held to without a webcam.
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(APP_PATH);
  const motion = modes(page).getByRole("radio", { name: /Motion to action/ });
  await motion.click();
  await expect(motion).toHaveAttribute("aria-checked", "true");
  await expect(
    modes(page).getByRole("radio", { name: "Voice to action" }),
  ).toHaveAttribute("aria-checked", "false");

  const panel = page.getByRole("region", { name: "Motion to action" });
  await expect(panel).toBeVisible();
  await expect(
    panel.getByRole("button", { name: /Start motion/ }),
  ).toBeVisible();
  await expect(panel.locator(".motion-legend li")).toHaveCount(5);
  for (const meaning of [
    "Next question",
    "Previous question",
    "Ask it",
    "Summarize the source",
    "Stop",
  ])
    await expect(panel.locator(".motion-legend")).toContainText(meaning);

  // The camera is a thing a reader turns on, never a thing a page takes.
  await expect(panel.locator(".motion-idle")).toContainText(
    "The camera is off. Nothing is recorded or sent.",
  );
  await expect(panel.locator(".motion-stage")).not.toHaveAttribute(
    "data-watching",
    "true",
  );
  await expect(
    panel.getByRole("button", { name: /Stop motion/ }),
  ).toHaveCount(0);

  // And the mode is reachable on a phone without the page growing sideways.
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(panel).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
