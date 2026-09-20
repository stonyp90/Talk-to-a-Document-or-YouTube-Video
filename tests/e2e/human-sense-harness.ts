import { expect, type Locator, type Page } from "@playwright/test";
import { pdfFixture } from "../pdf-fixture";
import { answerStream, installSpeech } from "./voice-harness";

export const SOURCE_NAME = "Sense to Action fixture.pdf";
export const SOURCE_TEXT =
  "Sense to Action combines voice, movement and keyboard in one workspace.";
export const ANSWER =
  "Voice, movement and keyboard share the same source and conversation.";
export const SOURCE_ID = "human-sense-fixture";

export const workspace = (page: Page) =>
  page.getByRole("main", { name: "Sense to Action", exact: true });
export const mode = (page: Page, name: string) =>
  page
    .getByRole("navigation", { name: "Primary" })
    .getByRole("radio", { name, exact: true });
export const sourcePicker = (page: Page) =>
  page.getByRole("dialog", { name: "Add a source", exact: true });
export const question = (page: Page) =>
  page.getByRole("textbox", { name: "Ask a question", exact: true });

/** Synthetic bytes and tracks only: this fixture never opens a real device. */
export async function installVoiceCaptureFixture(page: Page) {
  await page.addInitScript(() => {
    const capture = { opens: 0, releases: 0 };
    Object.defineProperty(window, "__humanSenseCapture", {
      configurable: true,
      value: capture,
    });
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      configurable: true,
      value: async () => {
        capture.opens++;
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = 240;
        const context = canvas.getContext("2d")!;
        const draw = () => context.fillRect(0, 0, canvas.width, canvas.height);
        draw();
        const stream = canvas.captureStream(10);
        const frames = window.setInterval(draw, 100);
        for (const track of stream.getTracks()) {
          const stop = track.stop.bind(track);
          let released = false;
          Object.defineProperty(track, "stop", {
            value: () => {
              if (!released) capture.releases++;
              released = true;
              clearInterval(frames);
              stop();
            },
          });
        }
        return stream;
      },
    });
    class SyntheticRecorder {
      state = "inactive";
      mimeType = "audio/webm";
      ondataavailable: ((event: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      start() {
        this.state = "recording";
      }
      stop() {
        if (this.state === "inactive") return;
        this.state = "inactive";
        this.ondataavailable?.({
          data: new Blob(["synthetic voice fixture"], { type: this.mimeType }),
        });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, "MediaRecorder", {
      configurable: true,
      value: SyntheticRecorder,
    });
  });
}

export function voiceCaptureState(page: Page) {
  return page.evaluate(
    () =>
      (
        window as Window & {
          __humanSenseCapture?: { opens: number; releases: number };
        }
      ).__humanSenseCapture,
  );
}

export function speechActivationState(page: Page) {
  return page.evaluate(() => {
    const instances =
      (
        window as Window & {
          __urslySpeech?: {
            instances: Array<{ startCount: number; stopCount: number }>;
          };
        }
      ).__urslySpeech?.instances ?? [];
    return {
      starts: instances.reduce((sum, instance) => sum + instance.startCount, 0),
      stops: instances.reduce((sum, instance) => sum + instance.stopCount, 0),
    };
  });
}

/** The browser contract is real; provider and account responses stay local. */
export async function installWorkspaceFixtures(page: Page) {
  await installSpeech(page);
  await installVoiceCaptureFixture(page);
  await page.route("**/api/auth/session", (route) =>
    route.fulfill({ json: { email: "human-sense@example.test" } }),
  );
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: { mode: "mock", commandSpeech: "browser", directUpload: false },
    }),
  );
  await page.route("**/api/ingest", (route) =>
    route.fulfill({
      json: {
        source: {
          kind: "pdf",
          sourceName: SOURCE_NAME,
          text: SOURCE_TEXT,
          characters: SOURCE_TEXT.length,
        },
        sourceId: SOURCE_ID,
        context: {
          usedCharacters: SOURCE_TEXT.length,
          totalCharacters: SOURCE_TEXT.length,
          truncated: false,
        },
      },
    }),
  );
  await page.route("**/api/text-chat/stream", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: answerStream([ANSWER], SOURCE_ID),
    }),
  );
  // A configured socket must not bypass the mocked answer endpoint.
  await page.routeWebSocket(
    (url) => !url.pathname.startsWith("/_next/"),
    (socket) => socket.close(),
  );
}

export async function expectSingleViewport(page: Page) {
  const bounds = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    documentWidth: document.documentElement.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    bodyWidth: document.body.scrollWidth,
    bodyHeight: document.body.scrollHeight,
    scrollY,
  }));
  expect(bounds.documentWidth).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.bodyWidth).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.documentHeight).toBeLessThanOrEqual(bounds.height + 1);
  expect(bounds.bodyHeight).toBeLessThanOrEqual(bounds.height + 1);
  expect(bounds.scrollY).toBe(0);
  await expect(workspace(page)).toBeInViewport();
}

export async function expectInputControls(page: Page, listening = false) {
  for (const control of [
    page.getByRole("button", {
      name: listening ? "Stop experience" : "Start experience",
      exact: true,
    }),
    mode(page, "Sense"),
    mode(page, "Keyboard to action"),
  ]) {
    await expect(control).toBeVisible();
    await expect(control).toBeInViewport();
  }
  await expect(
    page.getByRole("button", { name: "Speak", exact: true }),
  ).toBeHidden();
  await expect(
    page.getByRole("button", { name: "Start motion", exact: true }),
  ).toBeHidden();
}

/** Probe both boundaries, so a modal cannot strand focus behind its surface. */
export async function expectFocusTrap(page: Page, dialog: Locator) {
  const controls = dialog.locator(
    'button:visible:not([disabled]):not([tabindex="-1"]), input:visible:not([disabled]):not([tabindex="-1"]), textarea:visible:not([disabled]):not([tabindex="-1"]), select:visible:not([disabled]):not([tabindex="-1"]), a[href]:visible, summary:visible',
  );
  await expect(controls.first()).toBeVisible();
  await controls.first().focus();
  await page.keyboard.press("Shift+Tab");
  await expect(controls.last()).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(controls.first()).toBeFocused();
}

export async function addPdf(page: Page) {
  await page.getByRole("button", { name: "Add a source", exact: true }).click();
  const dialog = sourcePicker(page);
  await dialog.getByLabel("PDF file", { exact: true }).setInputFiles({
    name: SOURCE_NAME,
    mimeType: "application/pdf",
    buffer: pdfFixture(SOURCE_TEXT),
  });
  const ingested = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/ingest") && request.method() === "POST",
  );
  await dialog.getByRole("button", { name: "Continue", exact: true }).click();
  expect((await ingested).postData()).toContain(SOURCE_NAME);
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Change source", exact: true }),
  ).toBeVisible();
  await expect(question(page)).toBeEnabled();
}
