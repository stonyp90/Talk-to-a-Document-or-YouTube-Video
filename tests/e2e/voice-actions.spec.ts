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

async function openVoiceActions(page: Page) {
  await openClean(page);
  await page.getByRole("tab", { name: "Voice action" }).click();
}

async function emitSpeech(page: Page, transcript: string) {
  await page.evaluate((value) => {
    const speech = (window as VoiceTestWindow).__urslySpeech;
    speech?.instances.at(-1)?.emit(value);
  }, transcript);
}

test("voice action is the default entry and keeps source controls opt-in", async ({
  page,
}) => {
  await openClean(page);

  await expect(page.locator(".control-dock")).toBeVisible();
  await expect(page.getByRole("tab", { name: "Voice action" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(page.getByRole("tab", { name: "Text action" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "Motion beta" })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "1. Start with your voice" }),
  ).toBeVisible();
  await expect(page.getByLabel("PDF file")).toHaveCount(0);
  await expect(page.getByLabel("YouTube URL")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "2. Ask a question" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Ask a question", { exact: true }),
  ).toBeEnabled();
  await expect(page.getByRole("tab", { name: "Voice action" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  const motionTab = page.getByRole("tab", { name: "Motion beta" });
  await motionTab.hover();
  await expect(page.locator("#motion-beta-tip")).toHaveCSS("opacity", "1");
  await expect(page.locator("#motion-beta-tip")).toContainText(
    "deliberate movement",
  );

  await page.getByRole("button", { name: "Use upload instead" }).click();
  await expect(page.getByLabel("PDF file")).toBeVisible();
  await page.getByRole("tab", { name: "YouTube video" }).click();
  await expect(page.getByLabel("YouTube URL")).toBeVisible();
  await page.getByRole("button", { name: "Back to voice actions" }).click();
  await expect(
    page.getByRole("heading", { name: "Say a word. Take the next step." }),
  ).toBeFocused();
  await expect(page.getByLabel("PDF file")).toHaveCount(0);
  await expect(page.getByLabel("YouTube URL")).toHaveCount(0);
});

test("voice action examples reveal their spoken trigger without running it", async ({
  page,
}) => {
  await openVoiceActions(page);

  const reveal = page.getByRole("button", { name: "Show trigger" }).first();
  await reveal.click();
  await expect(
    page.getByRole("button", { name: "Hide trigger" }).first(),
  ).toHaveAttribute("aria-expanded", "true");
  await expect(page.getByText("Say this", { exact: true })).toBeVisible();
  await expect(page.getByText("“YouTube”", { exact: true })).toBeVisible();

  await page
    .getByRole("button", { name: "Hide trigger" })
    .click({ force: true });
  await expect(page.getByText("Say this", { exact: true })).toHaveCount(0);
});

test("motion beta is a safe, hover-only concept preview", async ({ page }) => {
  await openClean(page);

  await page.getByRole("tab", { name: "Motion beta" }).click();
  await expect(
    page.getByRole("heading", { name: "Move once. Imagine the next layer." }),
  ).toBeVisible();
  await expect(
    page.getByText("Preview only · no click-triggered actions"),
  ).toBeVisible();
  await expect(
    page.getByText("Future direction: a deliberate phone movement"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "A hands-free layer for later." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Enable motion beta" }),
  ).toHaveCount(0);
  await expect(page.getByLabel("PDF file")).toHaveCount(0);

  await page.getByRole("tab", { name: "Motion beta" }).hover();
  await expect(page.locator("#motion-beta-tip")).toContainText(
    "no pointer clicks",
  );

  await page.getByRole("tab", { name: "Voice action" }).click();
  await expect(
    page.getByRole("heading", { name: "Your voice is the shortcut." }),
  ).toBeVisible();
});

test("default upload action runs from a spoken trigger through the PDF picker", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openVoiceActions(page);

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
  await openVoiceActions(page);

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
  await openVoiceActions(page);

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
  await openVoiceActions(page);

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

test("manual stop prevents a late recognition result from triggering an action", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openVoiceActions(page);

  await page.getByRole("button", { name: "Create voice trigger" }).click();
  await page.getByLabel("Trigger word or phrase").fill("late upload");
  await page.getByRole("button", { name: "Save trigger" }).click();
  await page.getByRole("button", { name: "Arm voice actions" }).click();
  await expect(page.getByText("Voice actions are listening")).toBeVisible();

  await page.getByRole("button", { name: "Stop listening" }).click();
  await emitSpeech(page, "late upload");

  await expect(page.getByText("Voice actions are off")).toBeVisible();
  await expect(page.getByText(/Triggered “late upload”/)).toHaveCount(0);
});

test("hiding the page stops an armed voice recognizer", async ({ page }) => {
  await installSpeechHarness(page);
  await openVoiceActions(page);

  await page.getByRole("button", { name: "Create voice trigger" }).click();
  await page.getByLabel("Trigger word or phrase").fill("background check");
  await page.getByRole("button", { name: "Save trigger" }).click();
  await page.getByRole("button", { name: "Arm voice actions" }).click();
  await expect(page.getByText("Voice actions are listening")).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(
    page.getByText("Voice actions stopped when this page was hidden."),
  ).toBeVisible();
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
  await openVoiceActions(page);

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
  await openVoiceActions(page);

  await page.getByRole("button", { name: "Create voice trigger" }).click();
  const save = page.getByRole("button", { name: "Save trigger" });
  const phrase = page.getByLabel("Trigger word or phrase");
  await phrase.fill("!!!");
  await expect(save).toBeDisabled();

  await phrase.fill("Upload");
  await save.click();
  await expect(
    page
      .locator("#voice-trigger-builder .saved-trigger-phrase")
      .filter({ hasText: "“Upload”" }),
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
  await page.getByRole("tab", { name: "Voice action" }).click();
  await page.getByRole("button", { name: "Create voice trigger" }).click();
  await expect(page.getByText(/No saved triggers yet/)).toBeVisible();
});

test("back, next and cancel are active defaults and can be edited", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openVoiceActions(page);

  await page.getByRole("button", { name: "Create voice trigger" }).click();
  await expect(page.getByText("“back”", { exact: true })).toBeVisible();
  await expect(page.getByText("“next”", { exact: true })).toBeVisible();
  await expect(page.getByText("“cancel”", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit trigger back" }).click();
  await page.getByLabel("Trigger word or phrase").fill("previous");
  await page.getByRole("button", { name: "Update trigger" }).click();
  await expect(page.getByText("“previous”", { exact: true })).toBeVisible();
  await expect(page.getByText("“back”", { exact: true })).toHaveCount(0);

  await page.getByRole("button", { name: "Arm voice actions" }).click();
  await emitSpeech(page, "previous");
  await expect(
    page.getByText("Going back — the source controls are ready."),
  ).toBeVisible();

  await emitSpeech(page, "next");
  await expect(
    page.getByText("Next step: choose a PDF or paste a YouTube link."),
  ).toBeVisible();

  await emitSpeech(page, "cancel");
  await expect(page.getByText("Voice actions are off")).toBeVisible();
  await expect(
    page.getByText("Cancelled — the current action has been stopped."),
  ).toBeVisible();
});
