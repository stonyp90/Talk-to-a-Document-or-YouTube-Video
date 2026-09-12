import { test as firstVisit, type Page } from "@playwright/test";
import { expect, test } from "./base";
import { pdfFixture } from "../pdf-fixture";
import { APP_PATH, LANDING_PATH } from "../routes";

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" });

async function upload(
  page: Page,
  text = "The observatory studies Saturn. Its telescope is named Willow.",
) {
  await page.getByLabel("PDF file").setInputFiles({
    name: "ursly-production-check.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(text),
  });
  await page.getByRole("button", { name: "Continue to questions" }).click();
  await expect(
    page.getByLabel("Ask a question", { exact: true }),
  ).toBeFocused();
  await expect(page.locator(".source-picker")).not.toHaveAttribute("open", "");
  await expect(page.locator(".preview-text")).toBeHidden();
}

// The plain `test` keeps this the real first visit: the intro must play.
firstVisit("real PDF upload, grounded answer, source preview and replacement", async ({
  page,
  request,
}, testInfo) => {
  expect(await (await request.get("/api/health")).json()).toMatchObject({
    ok: true,
    mode: "live",
    directUpload: true,
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(LANDING_PATH);
  await page.getByRole("button", { name: "Skip intro" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#workspace")).toHaveCount(0);
  // The navigation the founder asked for, proven in production.
  await nav(page).getByRole("link", { name: "Open the app" }).click();
  await expect(page).toHaveURL(/\/(en|fr)\/app$/);
  await upload(page);
  await expect(
    page.locator('.progress-steps [aria-current="step"]'),
  ).toHaveText("2 Ask a question");
  await page
    .getByLabel("Ask a question", { exact: true })
    .fill("What is the telescope named?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".message.assistant")).toContainText("Willow");
  await page.locator(".preview summary").click();
  await expect(page.locator(".preview-text")).toContainText("Saturn");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({
    path: testInfo.outputPath("guided-answer.png"),
    fullPage: true,
  });
  await page.getByText("Change source", { exact: true }).click();
  await upload(page, "The new telescope is named Cedar and studies Jupiter.");
  await expect(page.locator(".message")).toHaveCount(0);
  await page
    .getByLabel("Ask a question", { exact: true })
    .fill("What is the telescope named?");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".message.assistant")).toContainText("Cedar");
  expect(errors).toEqual([]);
});

test("invalid source has an understandable recovery path", async ({ page }) => {
  await page.goto(APP_PATH);
  await page.getByRole("tab", { name: "YouTube video" }).click();
  await page.getByLabel("YouTube URL").fill("https://example.com/not-a-video");
  await page.getByRole("button", { name: "Continue to questions" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    /valid YouTube URL/i,
  );
  await page.getByRole("button", { name: "Use a PDF instead" }).click();
  await expect(page.getByLabel("PDF file")).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  // From the application, the way back to the story is one tap, and the
  // introduction is replayable once there.
  await nav(page).getByRole("link", { name: "Back to the story" }).click();
  await expect(page).toHaveURL(/\/(en|fr)$/);
  await nav(page).getByRole("button", { name: "Watch the intro" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "Skip intro" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("real voice transport connects, answers typed input, mutes and stops", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Real WebRTC checked in desktop Chromium; physical mobile audio requires a device.",
  );
  await page.goto(APP_PATH);
  await upload(page);
  await page.getByRole("button", { name: "Start Voice Chat" }).click();
  await expect(page.locator(".conversation-card .status")).toHaveText(
    "Connected",
  );
  await page
    .getByRole("button", { name: "Mute microphone", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Unmute microphone", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByLabel("Ask a question", { exact: true })
    .fill("What is the telescope named? Answer in English.");
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator(".message.assistant")).toContainText("Willow");
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.locator(".conversation-card .status")).toHaveText("Ended");
  await expect(
    page.getByRole("button", { name: "Start Voice Chat" }),
  ).toBeEnabled();
});

test("a fresh browser loads every app asset and hydrates the controls", async ({
  page,
}) => {
  const failedAssets: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("/_next/static/") && response.status() >= 400)
      failedAssets.push(`${response.status()} ${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    if (request.url().includes("/_next/static/"))
      failedAssets.push(request.url());
  });
  // Asset-loading regressions are possible on two pages now, so check both.
  await page.goto(LANDING_PATH);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("#how-we-build")).toBeVisible();
  await page.goto(APP_PATH);
  await expect(
    page.getByRole("radio", { name: "Voice to action" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "YouTube video" }).click();
  await expect(page.getByLabel("YouTube URL")).toBeVisible();
  expect(failedAssets).toEqual([]);
});
