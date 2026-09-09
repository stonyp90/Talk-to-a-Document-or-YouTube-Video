import { expect, test, type Page } from "@playwright/test";
import { pdfFixture } from "../pdf-fixture";

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

test("real PDF upload, grounded answer, source preview and replacement", async ({
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
  await page.goto("/");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Open Ursly" }).click();
  await page.getByRole("button", { name: "Use upload instead" }).click();
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
  await page.goto("/");
  await page.getByRole("button", { name: "Skip guide" }).click();
  await page.getByRole("button", { name: "Use upload instead" }).click();
  await page.getByRole("tab", { name: "YouTube video" }).click();
  await page.getByLabel("YouTube URL").fill("https://example.com/not-a-video");
  await page.getByRole("button", { name: "Continue to questions" }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    /valid YouTube URL/i,
  );
  await page.getByRole("button", { name: "Use a PDF instead" }).click();
  await expect(page.getByLabel("PDF file")).toBeVisible();
  await expect(page.locator("main").getByRole("alert")).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Quick tour" })).toBeVisible();
  await page.getByRole("button", { name: "Quick tour" }).click();
  await expect(page.locator("#welcome-title")).toBeFocused();
});

test("real voice transport connects, answers typed input, mutes and stops", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name === "mobile",
    "Real WebRTC checked in desktop Chromium; physical mobile audio requires a device.",
  );
  await page.goto("/");
  await page.getByRole("button", { name: "Skip guide" }).click();
  await page.getByRole("button", { name: "Use upload instead" }).click();
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
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Skip guide" })).toBeVisible();
  await page.getByRole("button", { name: "Skip guide" }).click();
  await page.getByRole("tab", { name: "YouTube video" }).click();
  await expect(page.getByLabel("YouTube URL")).toBeVisible();
  expect(failedAssets).toEqual([]);
});
