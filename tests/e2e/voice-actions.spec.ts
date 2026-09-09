import { expect, test, type Page } from "@playwright/test";
import { pdfFixture } from "../pdf-fixture";

type SpeechHarnessInstance = {
  emit: (transcript: string) => void;
  fail: () => void;
};

type VoiceTestWindow = Window & {
  __urslySpeech?: { instances: SpeechHarnessInstance[] };
};

async function installSpeechHarness(page: Page) {
  await page.addInitScript(() => {
    class FakeSpeechRecognition {
      static instances: FakeSpeechRecognition[] = [];
      continuous = false;
      interimResults = false;
      lang = "en-US";
      onerror: ((event: Event) => void) | null = null;
      onend: (() => void) | null = null;
      onresult: ((event: unknown) => void) | null = null;
      onstart: (() => void) | null = null;

      constructor() {
        FakeSpeechRecognition.instances.push(this);
      }

      start() {
        this.onstart?.();
      }

      stop() {
        this.onend?.();
      }

      emit(transcript: string) {
        this.onresult?.({
          resultIndex: 0,
          results: {
            0: { 0: { transcript } },
            length: 1,
          },
        });
      }

      fail() {
        this.onerror?.(new Event("error"));
      }
    }

    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: FakeSpeechRecognition,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "__urslySpeech", {
      configurable: true,
      value: { instances: FakeSpeechRecognition.instances },
    });
  });
}

async function openClean(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.removeItem("ursly-voice-triggers-v1"));
  await page.reload();
  await page
    .getByRole("button", { name: "Skip guide" })
    .click({ timeout: 2_000 })
    .catch(() => undefined);
}

async function emitSpeech(page: Page, transcript: string) {
  await page.evaluate((value) => {
    const speech = (window as VoiceTestWindow).__urslySpeech;
    speech?.instances.at(-1)?.emit(value);
  }, transcript);
}

test("default upload action runs from a spoken trigger through the PDF picker", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openClean(page);

  await page.getByRole("button", { name: "Create voice trigger" }).click();
  await expect(page.getByLabel("When I say it…")).toHaveValue("upload");
  await expect(
    page.getByRole("button", { name: "Save trigger" }),
  ).toBeDisabled();
  await page.getByLabel("Trigger word or phrase").fill("  open upload  ");
  await page.getByRole("button", { name: "Save trigger" }).click();
  await expect(page.getByText("“open upload”", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Arm voice actions" }).click();
  await expect(page.getByText("Voice actions are listening")).toBeVisible();

  const fileChooser = page.waitForEvent("filechooser");
  await emitSpeech(page, "Please, OPEN UPLOAD!!!");
  await (
    await fileChooser
  ).setFiles({
    name: "voice-trigger.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture("A source selected by a voice trigger."),
  });

  await expect(
    page.getByText("voice-trigger.pdf", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/Triggered “open upload”/)).toBeVisible();
});

test("all example actions route to their intended controls and guard voice without a source", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openClean(page);

  await page
    .getByRole("button", { name: /“YouTube” switch to YouTube/ })
    .click();
  await expect(
    page.getByRole("tab", { name: "YouTube video" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("YouTube URL")).toBeFocused();

  await page
    .getByRole("button", { name: /“Summarize this” ask for a summary/ })
    .click();
  await expect(page.getByLabel("Ask a question", { exact: true })).toHaveValue(
    "",
  );
  await expect(
    page.getByText(/Add a PDF or YouTube source first/),
  ).toBeVisible();

  await page.route("**/api/ingest", (route) =>
    route.fulfill({
      json: {
        source: {
          kind: "youtube",
          sourceName: "Voice action test video",
          text: "A source for testing voice action routing.",
          characters: 39,
        },
        sourceId: "voice-action-test-source",
        context: { usedCharacters: 39, totalCharacters: 39, truncated: false },
      },
    }),
  );
  await page.route("**/api/realtime/session", (route) =>
    route.fulfill({
      json: { mode: "mock", sourceId: "voice-action-test-source" },
    }),
  );
  await page.getByLabel("YouTube URL").fill("https://youtu.be/voice-action");
  await page.getByRole("button", { name: "Continue to questions" }).click();
  await expect(
    page.getByLabel("Ask a question", { exact: true }),
  ).toBeEnabled();

  await page
    .getByRole("button", { name: /“Summarize this” ask for a summary/ })
    .click();
  await expect(page.getByLabel("Ask a question", { exact: true })).toHaveValue(
    "Summarize the key ideas",
  );
  await expect(
    page.getByLabel("Ask a question", { exact: true }),
  ).toBeFocused();

  await page.getByRole("button", { name: /“Let's talk”/ }).click();
  await expect(
    page.getByRole("region", { name: "2. Ask a question" }).locator(".status"),
  ).toHaveText("Connected");
});

test("speech matching ignores unrelated input and suppresses an immediate duplicate", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openClean(page);

  await page.getByRole("button", { name: "Create voice trigger" }).click();
  await page.getByLabel("Trigger word or phrase").fill("upload this");
  await page.getByRole("button", { name: "Save trigger" }).click();
  await page.getByRole("button", { name: "Arm voice actions" }).click();

  await emitSpeech(page, "nothing relevant");
  await expect(page.getByText("Voice actions are listening")).toBeVisible();
  await expect(page.getByText("Heard: nothing relevant")).toBeVisible();

  const firstChooser = page.waitForEvent("filechooser");
  await emitSpeech(page, "upload this");
  await (
    await firstChooser
  ).setFiles({
    name: "duplicate-check.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture("Duplicate actions should be ignored briefly."),
  });

  const duplicateChooser = page
    .waitForEvent("filechooser", { timeout: 500 })
    .catch(() => undefined);
  await emitSpeech(page, "UPLOAD THIS!!!");
  expect(await duplicateChooser).toBeUndefined();
});

test("speech-recognition failures leave voice actions safely disarmed", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openClean(page);

  await page.getByRole("button", { name: "Create voice trigger" }).click();
  await page.getByLabel("Trigger word or phrase").fill("listen now");
  await page.getByRole("button", { name: "Save trigger" }).click();
  await page.getByRole("button", { name: "Arm voice actions" }).click();
  await expect(page.getByText("Voice actions are listening")).toBeVisible();

  await page.evaluate(() => {
    const speech = (window as VoiceTestWindow).__urslySpeech;
    speech?.instances.at(-1)?.fail();
  });
  await expect(page.getByText("Voice actions are off")).toBeVisible();
  await expect(page.getByText(/need microphone access/)).toBeVisible();
});

test("unsupported speech recognition explains the fallback path", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      configurable: true,
      value: undefined,
    });
  });
  await openClean(page);

  await page.getByRole("button", { name: "Create voice trigger" }).click();
  await page.getByLabel("Trigger word or phrase").fill("hello");
  await page.getByRole("button", { name: "Save trigger" }).click();
  await page.getByRole("button", { name: "Arm voice actions" }).click();
  await expect(
    page.getByText(/does not support speech recognition/),
  ).toBeVisible();
  await expect(page.getByText("Voice actions are off")).toBeVisible();
});

test("invalid and duplicate trigger phrases cannot become catch-all actions", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openClean(page);

  await page.getByRole("button", { name: "Create voice trigger" }).click();
  const save = page.getByRole("button", { name: "Save trigger" });
  const phrase = page.getByLabel("Trigger word or phrase");
  await phrase.fill("!!!");
  await expect(save).toBeDisabled();

  await phrase.fill("Upload");
  await save.click();
  await expect(
    page.locator("#voice-trigger-builder .saved-trigger-phrase"),
  ).toHaveText("“Upload”");
  await phrase.fill(" upload ");
  await save.click();
  await expect(
    page.getByText(/is already saved\. Choose a different phrase/),
  ).toBeVisible();

  await page.evaluate(() => {
    localStorage.setItem(
      "ursly-voice-triggers-v1",
      JSON.stringify([
        { id: "bad-action", phrase: "valid", action: "not-an-action" },
        { id: "catch-all", phrase: "!!!", action: "upload" },
      ]),
    );
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Skip guide" })
    .click({ timeout: 2_000 })
    .catch(() => undefined);
  await page.getByRole("button", { name: "Create voice trigger" }).click();
  await expect(page.getByText(/No saved triggers yet/)).toBeVisible();
});
