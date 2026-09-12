import type { Page } from "@playwright/test";
import { expect, test } from "./base";
import { pdfFixture } from "../pdf-fixture";
import { answerStream, installAnswerStream, say } from "./voice-harness";
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
      page.getByRole("button", { name: "Start Voice Chat" }),
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
      page.getByRole("button", { name: "Start Voice Chat" }),
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
      page.getByRole("button", { name: "Start Voice Chat" }),
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
      page.getByRole("button", { name: "Start Voice Chat" }),
    ).toBeHidden();
    // The composer is on screen from the start; only sending waits for a source.
    await expect(
      page.getByLabel("Ask a question", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send", exact: true }),
    ).toBeDisabled();
  });

  test("ingests YouTube and streams an answer from the server-sent endpoint", async ({
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
      r.url().endsWith("/api/text-chat/stream"),
    );
    await page.getByRole("button", { name: "Send", exact: true }).click();
    const answer = await answerResponse;
    expect(answer.ok()).toBeTruthy();
    expect(answer.headers()["content-type"]).toContain("text/event-stream");
    await expect(
      conversation(page).locator(".message.user .message-text"),
    ).toHaveText(question);
    // The answer arrives as Markdown and reaches the reader as elements.
    const rendered = conversation(page).locator(
      ".message.assistant .message-text.rendered .markdown",
    );
    await expect(rendered).toBeVisible();
    expect(((await rendered.textContent()) ?? "").length).toBeGreaterThan(20);
    await expect(
      page.getByLabel("Ask a question", { exact: true }),
    ).toHaveValue("");
  });

  test("mock voice supports typed turns, mute, unmute, stop and restart", async ({
    page,
  }) => {
    await uploadPdf(page);
    await page.getByRole("button", { name: "Start Voice Chat" }).click();
    await expect(status(page)).toHaveText("Connected");
    await expect(conversation(page).getByRole("status")).toContainText(
      "Demo simulation",
    );
    await expect(
      page.getByRole("button", { name: "Start Voice Chat" }),
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
    await page.getByRole("button", { name: "Start Voice Chat" }).click();
    await expect(status(page)).toHaveText("Connected");
  });

  test("replacing the source stops voice and clears the previous conversation", async ({
    page,
  }) => {
    await uploadPdf(page);
    await page.getByRole("button", { name: "Start Voice Chat" }).click();
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
      page.getByRole("button", { name: "Start Voice Chat" }),
    ).toBeEnabled();
    // Subsequent text must use fallback HTTP, not the previous voice client.
    await page
      .getByLabel("Ask a question", { exact: true })
      .fill("What planet?");
    const answer = page.waitForResponse((r) =>
      r.url().endsWith("/api/text-chat/stream"),
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

/**
 * The conversation surface itself: how an answer arrives, how it reads, and
 * how it is written. These journeys mock the answer so that what is asserted
 * is the interface and not a provider's wording, and so they spend nothing.
 */
test.describe("answers and the composer", () => {
  /** A ready source, without spending anything on reading one. */
  async function addSource(page: Page) {
    await page.route("**/api/ingest", (route) =>
      route.fulfill({
        json: {
          source: {
            kind: "youtube",
            sourceName: "Composer test video",
            text: "A source for testing the conversation surface.",
            characters: 45,
          },
          sourceId: "composer-test-source",
          context: {
            usedCharacters: 45,
            totalCharacters: 45,
            truncated: false,
          },
        },
      }),
    );
    await page.getByRole("tab", { name: "YouTube video" }).click();
    await page.getByLabel("YouTube URL").fill("https://youtu.be/composer");
    await page.getByRole("button", { name: "Continue to questions" }).click();
    await expect(page.locator(".source-ready")).toBeVisible();
  }

  async function ask(page: Page, text: string) {
    await page.getByLabel("Ask a question", { exact: true }).fill(text);
    await page.getByRole("button", { name: "Send", exact: true }).click();
  }

  test("an answer renders as Markdown elements, never as asterisks", async ({
    page,
    context,
  }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.goto(APP_PATH);
    await addSource(page);
    await page.route("**/api/text-chat/stream", (route) =>
      route.fulfill({
        contentType: "text/event-stream",
        body: answerStream([
          "## Rings\n\n",
          "They are **mostly ice**, with:\n\n- dust\n- rock\n",
        ]),
      }),
    );
    await ask(page, "What are the rings made of?");

    const answer = page.locator(
      ".message.assistant .message-text.rendered .markdown",
    );
    await expect(answer.locator("h4")).toHaveText("Rings");
    await expect(answer.locator("strong")).toHaveText("mostly ice");
    await expect(answer.locator("li")).toHaveText(["dust", "rock"]);
    await expect(answer).not.toContainText("**");

    // A finished answer carries its own tools, revealed by hover or focus.
    const message = page.locator(".message.assistant");
    await message.hover();
    await expect(message.locator(".message-actions")).toHaveCSS("opacity", "1");
    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await expect(page.getByRole("button", { name: "Copied" })).toBeVisible();
    await page.getByRole("button", { name: "Try again" }).click();
    await expect(page.locator(".message.user")).toHaveCount(2);
  });

  test("an answer arrives progressively, and Stop keeps what has arrived", async ({
    page,
  }) => {
    await installAnswerStream(page);
    await page.goto(APP_PATH);
    await addSource(page);
    await ask(page, "Tell me about the rings");

    await say(page, "The rings ");
    await expect(page.locator(".message.assistant")).toContainText("The rings");
    // Nothing has finished yet: the composer offers to stop instead of send.
    const stop = page.getByRole("button", { name: "Stop", exact: true });
    await expect(stop).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Send", exact: true }),
    ).toHaveCount(0);

    await say(page, "are mostly ice");
    await expect(page.locator(".message.assistant")).toContainText(
      "The rings are mostly ice",
    );

    // Stopping is the reader's decision, so the words already read survive it.
    await stop.click();
    await expect(
      page.getByRole("button", { name: "Send", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".message.assistant")).toContainText(
      "The rings are mostly ice",
    );
    await expect(page.locator(".message.assistant")).not.toHaveAttribute(
      "data-streaming",
      "true",
    );
  });

  test("Enter sends, Shift+Enter starts a new line, and the box grows", async ({
    page,
  }) => {
    await page.goto(APP_PATH);
    await addSource(page);
    await page.route("**/api/text-chat/stream", (route) =>
      route.fulfill({
        contentType: "text/event-stream",
        body: answerStream(["Both lines heard."]),
      }),
    );
    await expect(
      page.getByText("Enter sends · Shift + Enter starts a new line"),
    ).toBeVisible();

    const box = page.getByLabel("Ask a question", { exact: true });
    await box.fill("first line");
    const oneLine = (await box.boundingBox())!.height;
    await box.press("Shift+Enter");
    await box.pressSequentially("second line");
    await expect(box).toHaveValue("first line\nsecond line");
    // A newline is not a send, and the box makes room for what it holds.
    await expect(page.locator(".message.user")).toHaveCount(0);
    expect((await box.boundingBox())!.height).toBeGreaterThan(oneLine);

    await box.press("Enter");
    await expect(page.locator(".message.user .message-text")).toContainText(
      "second line",
    );
    await expect(box).toHaveValue("");
  });

  test("Jump to latest appears once the log is scrolled away from the end", async ({
    page,
  }) => {
    await page.goto(APP_PATH);
    await addSource(page);
    await page.route("**/api/text-chat/stream", (route) =>
      route.fulfill({
        contentType: "text/event-stream",
        body: answerStream([
          Array.from({ length: 60 }, (_, line) => `Line ${line + 1}.`).join(
            "\n\n",
          ),
        ]),
      }),
    );
    await ask(page, "Give me a long answer");
    await expect(page.locator(".message.assistant")).toContainText("Line 60.");

    const jump = page.getByRole("button", { name: /Jump to latest/ });
    await expect(jump).toHaveCount(0);
    await page.locator(".chat").evaluate((log) => {
      log.scrollTop = 0;
    });
    await expect(jump).toBeVisible();
    await jump.click();
    await expect(jump).toHaveCount(0);
  });

  test("the top menu hands over the mobile builds and the release they came from", async ({
    page,
  }) => {
    await page.goto(APP_PATH);
    const menu = page.getByRole("navigation", { name: "Primary" });
    // The label is hidden below 960px and the icon is decorative, so at this
    // viewport the button has no accessible name to find it by.
    const downloads = menu.locator(".nav-download");
    await expect(downloads).toHaveAttribute("aria-expanded", "false");
    await downloads.click();
    await expect(downloads).toHaveAttribute("aria-expanded", "true");

    const items = menu.getByRole("menuitem");
    const android = items.filter({ hasText: "Android APK" });
    const ios = items.filter({ hasText: "iOS Simulator build" });
    await expect(android).toHaveAttribute(
      "href",
      /\/releases\/download\/[^/]+\/ursly-[^/]+-android\.apk$/,
    );
    await expect(ios).toHaveAttribute(
      "href",
      /\/releases\/download\/[^/]+\/ursly-[^/]+-ios-simulator-arm64\.tar\.gz$/,
    );
    await expect(
      menu.getByRole("menuitem", { name: "All builds and instructions" }),
    ).toHaveAttribute("href", "#applications");

    // Both builds and the notes name one release, so a reader never installs
    // an application the notes do not describe.
    const notes = menu.getByRole("menuitem", { name: /Release notes/ });
    const tag = ((await notes.getAttribute("href")) ?? "").split(
      "/releases/tag/",
    )[1];
    expect(tag).toBeTruthy();
    for (const build of [android, ios])
      expect(await build.getAttribute("href")).toContain(
        `/releases/download/${tag}/`,
      );

    await page.keyboard.press("Escape");
    await expect(downloads).toHaveAttribute("aria-expanded", "false");
    // At a width that shows the label, the same control names itself.
    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(
      menu.getByRole("button", { name: "Get the app" }),
    ).toBeVisible();
  });

  test("a signed-out reader is asked to sign in instead of shown the workspace", async ({
    page,
  }) => {
    await page.route("**/api/auth/session", (route) =>
      route.fulfill({
        status: 401,
        json: { error: "Sign in to continue.", code: "UNAUTHENTICATED" },
      }),
    );
    await page.goto(APP_PATH);

    await expect(
      page.getByRole("heading", { name: "Sign in to keep going" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email address")).toBeVisible();
    // Nothing that spends money is on screen until the reader is known.
    await expect(page.locator("#workspace")).toBeHidden();
    await expect(page.locator(".voice-commands")).toHaveCount(0);
  });
});
