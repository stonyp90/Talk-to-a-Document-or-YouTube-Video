import type { Page } from "@playwright/test";
import { expect, test } from "./base";
import { pdfFixture } from "../pdf-fixture";
import { APP_PATH } from "../routes";

// Compose's configured origin is localhost; exercise the real browser upload
// and API paths, including CORS and the object store, without request mocks.
test.use({ baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000" });

const pdfText = "The demo observatory studies Saturn and its rings.";
const conversation = (page: Page) =>
  page.getByRole("region", { name: "2. Ask a question" });
const status = (page: Page) =>
  page.getByRole("region", { name: "2. Ask a question" }).locator(".status");

async function uploadPdf(page: Page, text = pdfText) {
  if (await page.locator(".source-picker:not([open])").count())
    await page.getByText("Change source", { exact: true }).click();
  await page.getByRole("tab", { name: "PDF document" }).click();
  await page.getByLabel("PDF file").setInputFiles({
    name: "observatory.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture(text),
  });
  const extracted = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/uploads/extract") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Continue to questions" }).click();
  const response = await extracted;
  expect(response.ok(), await response.text()).toBeTruthy();
  await expect(page.locator(".preview-text")).toHaveText(text);
  if (await page.locator(".preview:not([open])").count())
    await page.locator(".preview summary").click();
}

test.describe("source conversation journey", () => {
  test.beforeEach(async ({ page, request }) => {
    const response = await request.get("/api/health");
    expect(response.ok()).toBeTruthy();
    expect(
      await response.json(),
      "Run against freshly built Compose with object-store uploads and mock AI",
    ).toMatchObject({ ok: true, mode: "mock", directUpload: true });
    await page.goto(APP_PATH);
    await expect(page.getByLabel("PDF file")).toBeVisible();
  });

  test("uploads a real PDF through object storage and previews extracted text", async ({
    page,
  }) => {
    await expect(
      page.getByRole("button", { name: "Start voice chat" }),
    ).toBeHidden();
    // The composer is on screen from the start; only sending waits for a source.
    await expect(
      page.getByLabel("Ask a question", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send", exact: true }),
    ).toBeDisabled();
    const prepare = page.waitForResponse(
      (r) =>
        r.url().endsWith("/api/uploads") && r.request().method() === "POST",
    );
    await uploadPdf(page);
    expect((await prepare).ok()).toBeTruthy();
    await expect(
      conversation(page).getByText("observatory.pdf", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Start voice chat" }),
    ).toBeEnabled();
    await page.locator(".preview summary").click();
    await expect(page.locator(".preview-text")).toBeHidden();
    await page.locator(".preview summary").click();
    await expect(page.locator(".preview-text")).toBeVisible();
  });

  test("rejects a corrupt PDF without enabling chat", async ({ page }) => {
    await page.getByLabel("PDF file").setInputFiles({
      name: "broken.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4\nThis is not a valid PDF document."),
    });
    const extraction = page.waitForResponse((r) =>
      r.url().endsWith("/api/uploads/extract"),
    );
    await page.getByRole("button", { name: "Continue to questions" }).click();
    expect((await extraction).ok()).toBeFalsy();
    const alert = page
      .getByRole("region", { name: "1. Add a source" })
      .getByRole("alert");
    await expect(alert).toBeVisible();
    await expect(alert).not.toBeEmpty();
    await expect(page.locator(".preview-text")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Start voice chat" }),
    ).toBeHidden();
    // The composer is on screen from the start; only sending waits for a source.
    await expect(
      page.getByLabel("Ask a question", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send", exact: true }),
    ).toBeDisabled();
  });

  test("rejects an invalid YouTube URL", async ({ page }) => {
    await page.getByRole("tab", { name: "YouTube video" }).click();
    await page
      .getByLabel("YouTube URL")
      .fill("https://example.com/watch?v=dQw4w9WgXcQ");
    const ingestion = page.waitForResponse((r) =>
      r.url().endsWith("/api/ingest"),
    );
    await page.getByRole("button", { name: "Continue to questions" }).click();
    expect((await ingestion).status()).toBe(400);
    await expect(
      page.getByRole("region", { name: "1. Add a source" }).getByRole("alert"),
    ).toContainText(/valid YouTube URL/i);
    await expect(
      page.getByRole("button", { name: "Start voice chat" }),
    ).toBeHidden();
    // The composer is on screen from the start; only sending waits for a source.
    await expect(
      page.getByLabel("Ask a question", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send", exact: true }),
    ).toBeDisabled();
  });

  test("ingests YouTube and displays the actual text fallback API answer", async ({
    page,
  }) => {
    await page.getByRole("tab", { name: "YouTube video" }).click();
    await page
      .getByLabel("YouTube URL")
      .fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    const ingestion = page.waitForResponse((r) =>
      r.url().endsWith("/api/ingest"),
    );
    await page.getByRole("button", { name: "Continue to questions" }).click();
    const response = await ingestion;
    expect(response.ok()).toBeTruthy();
    const { source } = await response.json();
    expect(source.text.length).toBeGreaterThan(20);
    await expect(page.locator(".preview-text")).toHaveText(source.text);
    await expect(
      page.getByRole("button", { name: "Send", exact: true }),
    ).toBeDisabled();
    const question = "What is this about?";
    await page.getByLabel("Ask a question", { exact: true }).fill(question);
    const answerResponse = page.waitForResponse((r) =>
      r.url().endsWith("/api/text-chat"),
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const answer = await answerResponse;
    expect(answer.ok()).toBeTruthy();
    const payload = await answer.json();
    expect(payload.answer.length).toBeGreaterThan(20);
    await expect(
      conversation(page).locator(".message.user .message-text"),
    ).toHaveText(question);
    await expect(
      conversation(page).locator(".message.assistant .message-text"),
    ).toHaveText(payload.answer);
    await expect(
      page.getByLabel("Ask a question", { exact: true }),
    ).toHaveValue("");
  });

  test("mock voice supports typed turns, mute, unmute, stop and restart", async ({
    page,
  }) => {
    await uploadPdf(page);
    await page.getByRole("button", { name: "Start voice chat" }).click();
    await expect(status(page)).toHaveText("Connected");
    await expect(conversation(page).getByRole("status")).toContainText(
      "Demo simulation",
    );
    await expect(
      page.getByRole("button", { name: "Start voice chat" }),
    ).toBeDisabled();
    await page
      .getByLabel("Ask a question", { exact: true })
      .fill("Tell me about Saturn");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      conversation(page).locator(".message.user .message-text"),
    ).toHaveText("Tell me about Saturn");
    await expect(
      conversation(page).locator(".message.assistant .message-text"),
    ).toContainText(pdfText);
    await page
      .getByRole("button", { name: "Mute microphone", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Unmute microphone", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Unmute microphone", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Mute microphone", exact: true }),
    ).toBeEnabled();
    await page.getByRole("button", { name: "Stop", exact: true }).click();
    await expect(status(page)).toHaveText("Ended");
    await expect(
      page.getByRole("button", { name: "Stop", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Mute microphone", exact: true }),
    ).toBeHidden();
    await expect(conversation(page).locator(".message-text")).toHaveCount(2);
    await page.getByRole("button", { name: "Start voice chat" }).click();
    await expect(status(page)).toHaveText("Connected");
  });

  test("replacing the source stops voice and clears the previous conversation", async ({
    page,
  }) => {
    await uploadPdf(page);
    await page.getByRole("button", { name: "Start voice chat" }).click();
    await expect(status(page)).toHaveText("Connected");
    await page
      .getByLabel("Ask a question", { exact: true })
      .fill("Discuss the old source");
    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(
      conversation(page).locator(".message.assistant .message-text"),
    ).toContainText(pdfText);
    await page
      .getByRole("button", { name: "Mute microphone", exact: true })
      .click();
    await uploadPdf(page, "The new source describes Jupiter.");
    await expect(status(page)).toHaveText("Ready");
    await expect(
      page.getByRole("button", { name: "Stop", exact: true }),
    ).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Mute microphone", exact: true }),
    ).toBeHidden();
    await expect(conversation(page).locator(".message-text")).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Start voice chat" }),
    ).toBeEnabled();
    // Subsequent text must use fallback HTTP, not the previous voice client.
    await page
      .getByLabel("Ask a question", { exact: true })
      .fill("What planet?");
    const answer = page.waitForResponse((r) =>
      r.url().endsWith("/api/text-chat"),
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    expect((await answer).ok()).toBeTruthy();
    await expect(
      conversation(page).locator(".message.assistant .message-text"),
    ).toContainText("Jupiter");
    await expect(
      conversation(page).locator(".message.assistant .message-text"),
    ).not.toContainText("Saturn");
  });

  test("fits a 390 pixel mobile viewport before and after ingestion", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const assertWidth = async () => {
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(390);
      for (const element of await page
        .locator("button, input, .preview")
        .all()) {
        if (!(await element.isVisible())) continue;
        const box = await element.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(391);
      }
    };
    await assertWidth();
    await uploadPdf(page);
    await assertWidth();
  });
});

test("keyboard source selection and a suggested question work with a second video", async ({
  page,
}) => {
  await page.goto(APP_PATH);
  const pdfTab = page.getByRole("tab", { name: "PDF document" });
  const youtubeTab = page.getByRole("tab", { name: "YouTube video" });
  await pdfTab.focus();
  await pdfTab.press("ArrowRight");
  await expect(youtubeTab).toBeFocused();
  await expect(youtubeTab).toHaveAttribute("aria-selected", "true");
  await youtubeTab.press("Home");
  await expect(pdfTab).toBeFocused();
  await pdfTab.press("End");
  await page.getByLabel("YouTube URL").fill("https://youtu.be/jNQXAC9IVRw");
  await page.getByRole("button", { name: "Continue to questions" }).click();
  await expect(page.locator(".preview-text")).not.toBeEmpty();
  await expect(conversation(page)).toContainText("jNQXAC9IVRw");
  await page.getByRole("button", { name: "Explain this simply" }).click();
  await expect(
    page.getByLabel("Ask a question", { exact: true }),
  ).toBeFocused();
  await expect(page.getByLabel("Ask a question", { exact: true })).toHaveValue(
    "Explain this simply",
  );
  await page.getByLabel("Ask a question", { exact: true }).press("Enter");
  await expect(
    page.locator(".message.assistant .message-text"),
  ).not.toBeEmpty();
  await expect(page.locator(".message.user .message-text")).toHaveText(
    "Explain this simply",
  );
});
