import { expect, test } from "@playwright/test";

test("reduced motion keeps source tabs usable without animation", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const skipGuide = page.getByRole("button", { name: "Skip guide" });
  await skipGuide.click({ timeout: 2_000 }).catch(() => undefined);
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
