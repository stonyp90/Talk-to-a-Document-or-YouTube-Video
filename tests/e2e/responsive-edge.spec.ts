import { expect, test } from "./base";
import { answerStream } from "./voice-harness";
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
  await page.route("**/api/text-chat/stream", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: answerStream(["https://example.com/" + "x".repeat(500)]),
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

test("the hamburger menu opens and its links are reachable on a mobile viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(LANDING_PATH);
  const trigger = page.getByRole("button", { name: /Open menu/i });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const panel = page.locator("#mobile-navigation");
  await expect(panel).toBeVisible();
  for (const name of [/How it works/i, /Get the app/i]) {
    const link = panel.getByRole("link", { name });
    await expect(link).toBeVisible();
  }
  const close = panel.getByRole("button", { name: /Close/i });
  await expect(close).toBeVisible();
  await close.click();
  await expect(panel).not.toBeVisible();
});

test("a short landscape viewport keeps the workspace controls on screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto(APP_PATH);
  await expect(page.locator("#workspace")).toBeVisible();
  await expect(page.getByRole("tab", { name: "PDF document" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "YouTube video" })).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(844);
});

test("primary action buttons meet the 44px touch-target floor", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(APP_PATH);
  const boxes = await page.evaluate(() => {
    const buttons = Array.from(
      document.querySelectorAll<HTMLButtonElement>(
        'button[type="button"], button:not([type])',
      ),
    );
    return buttons.slice(0, 20).map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        label:
          button.getAttribute("aria-label") ||
          button.textContent?.trim().slice(0, 40) ||
          "",
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    });
  });
  const tooSmall = boxes.filter((box) => box.height > 0 && box.height < 43);
  expect(tooSmall).toEqual([]);
});
