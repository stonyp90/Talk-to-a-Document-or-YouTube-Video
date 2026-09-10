import { expect, test } from "@playwright/test";

test("reduced motion keeps source tabs usable without animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const skipGuide = page.getByRole("button", { name: "Skip guide" });
  await skipGuide.click({ timeout: 2_000 }).catch(() => undefined);
  await page.getByRole("button", { name: "Use upload instead" }).click();
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

test("decorative motion settles instead of continuously distracting", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  const skipGuide = page.getByRole("button", { name: "Skip guide" });
  await skipGuide.click({ timeout: 2_000 }).catch(() => undefined);
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

test("motion hover preview has its own desktop layer and a safe mobile fallback", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const motionTab = page.getByRole("tab", { name: "Motion beta" });
  await motionTab.hover();

  const desktopPreview = await page
    .locator("#motion-beta-tip")
    .evaluate((element) => {
      const preview = element.getBoundingClientRect();
      const dock = element.closest(".control-dock")!.getBoundingClientRect();
      const onboarding = document
        .querySelector(".onboarding")!
        .getBoundingClientRect();
      const overlaps = (a: DOMRect, b: DOMRect) =>
        a.left < b.right &&
        a.right > b.left &&
        a.top < b.bottom &&
        a.bottom > b.top;
      const style = getComputedStyle(element);
      return {
        position: style.position,
        pointerEvents: style.pointerEvents,
        visible: style.opacity === "1",
        withinViewport:
          preview.left >= 0 &&
          preview.right <= innerWidth &&
          preview.top >= 0 &&
          preview.bottom <= innerHeight,
        overlapsDock: overlaps(preview, dock),
        overlapsIntro: overlaps(preview, onboarding),
      };
    });

  expect(desktopPreview).toEqual({
    position: "fixed",
    pointerEvents: "none",
    visible: true,
    withinViewport: true,
    overlapsDock: false,
    overlapsIntro: false,
  });

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotion = await page
    .locator("#motion-beta-tip")
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        transitionDuration: style.transitionDuration,
        transform: style.transform,
      };
    });
  expect(reducedMotion).toEqual({
    transitionDuration: "0s",
    transform: "none",
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("tab", { name: "Motion beta" }).click();
  await expect(page.locator(".motion-actions-card")).toBeVisible();
  await expect(page.locator("#motion-beta-tip")).toBeHidden();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
