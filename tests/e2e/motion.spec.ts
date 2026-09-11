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
    if (path === LANDING_PATH)
      // Make sure the animated section has actually been on screen, or this
      // would pass for the wrong reason: the build loop only moves in view.
      await page.locator("#how-we-build").scrollIntoViewIfNeeded();
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

test("the landing page adds no animation under reduced motion", async ({
  page,
}) => {
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

test("motion tooltip has its own desktop layer and a safe mobile fallback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(APP_PATH);
  const motion = modes(page).getByRole("radio", { name: /Motion to action/ });
  const tooltip = modes(page).locator(".mode-tooltip");
  await motion.hover();
  await expect(tooltip).toHaveCSS("opacity", "1");

  const desktopPreview = await tooltip.evaluate((element) => {
    const preview = element.getBoundingClientRect();
    const group = element.closest(".modes")!.getBoundingClientRect();
    const overlaps = (a: DOMRect, b: DOMRect) =>
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top;
    return {
      position: getComputedStyle(element).position,
      withinViewport:
        preview.left >= 0 &&
        preview.right <= innerWidth &&
        preview.top >= 0 &&
        preview.bottom <= innerHeight,
      overlapsModes: overlaps(preview, group),
    };
  });
  expect(desktopPreview).toEqual({
    position: "absolute",
    withinViewport: true,
    overlapsModes: false,
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  expect(
    await tooltip.evaluate(
      (element) => getComputedStyle(element).transitionDuration,
    ),
  ).toBe("0s");

  await page.setViewportSize({ width: 390, height: 844 });
  await motion.click({ force: true });
  await expect(motion).toHaveAttribute("aria-checked", "false");
  await expect(
    modes(page).getByRole("radio", { name: "Voice to action" }),
  ).toHaveAttribute("aria-checked", "true");
  await expect(modes(page)).toHaveAttribute("data-explaining", "true");
  await expect(tooltip).toHaveCSS("opacity", "1");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
