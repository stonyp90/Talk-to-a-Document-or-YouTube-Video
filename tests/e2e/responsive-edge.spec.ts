import { expect, test } from "./base";
import { APP_PATH, LANDING_PATH } from "../routes";

test("long source names and unbroken chat text stay inside a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  // Deliberately hostile layout fixture, not a live provider claim.
  await page.route("**/api/ingest", (route) =>
    route.fulfill({
      json: {
        source: {
          kind: "youtube",
          sourceName: "x".repeat(250),
          text: "x".repeat(500),
          characters: 500,
        },
      },
    }),
  );
  await page.route("**/api/text-chat", (route) =>
    route.fulfill({
      json: { answer: "https://example.com/" + "x".repeat(500) },
    }),
  );
  await page.goto(APP_PATH);
  await page.getByRole("tab", { name: "YouTube video" }).click();
  await page.getByLabel("YouTube URL").fill("https://youtu.be/dQw4w9WgXcQ");
  await page.getByRole("button", { name: "Continue to questions" }).click();
  await expect(
    page.getByLabel("Ask a question", { exact: true }),
  ).toBeEnabled();
  await page
    .getByLabel("Ask a question", { exact: true })
    .fill("x".repeat(500));
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".message.assistant")).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});

for (const width of [320, 390, 768, 1440]) {
  test(`workspace navigation and source controls fit at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(APP_PATH);
    await expect(page.locator("#workspace")).toBeVisible();
    await page.getByRole("tab", { name: "PDF document" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(
      page.getByRole("tab", { name: "YouTube video" }),
    ).toBeFocused();
    await expect(page.getByLabel("YouTube URL")).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await page.screenshot({
      path: testInfo.outputPath(`ursly-workspace-${width}.png`),
      fullPage: true,
    });
    // The guide lives on the landing page now, so the footer link is a
    // cross-page journey: following it proves the application is never a dead
    // end, which is more than the old in-page jump proved.
    await page.getByRole("link", { name: /How it works/ }).click();
    await expect(page).toHaveURL(/\/(en|fr)#how-it-works$/);
    await expect(page.locator("#how-it-works")).toBeInViewport();
    await page
      .getByText("Having trouble with a source or your microphone?")
      .click();
    await expect(
      page.getByText("Scanned PDFs need a text layer", { exact: false }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
  });

  test(`the landing story fits at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(LANDING_PATH);
    await expect(page.locator("#workspace")).toHaveCount(0);
    for (const id of [
      "platform",
      "how-we-build",
      "how-it-works",
      "applications",
    ]) {
      await page.locator(`#${id}`).scrollIntoViewIfNeeded();
      await expect(page.locator(`#${id}`)).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
    }
    await page.screenshot({
      path: testInfo.outputPath(`ursly-landing-${width}.png`),
      fullPage: true,
    });
  });
}
