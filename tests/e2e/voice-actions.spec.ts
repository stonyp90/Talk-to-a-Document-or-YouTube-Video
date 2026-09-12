import type { Page } from "@playwright/test";
import { expect, test } from "./base";
import { pdfFixture } from "../pdf-fixture";
import { APP_PATH } from "../routes";

type SpeechHarnessInstance = {
  emit: (transcript: string) => void;
  fail: () => void;
};

type VoiceTestWindow = Window & {
  __urslySpeech?: { instances: SpeechHarnessInstance[] };
};

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" });
const modes = (page: Page) =>
  nav(page).getByRole("radiogroup", { name: "Control mode" });
const mode = (page: Page, name: string | RegExp) =>
  modes(page).getByRole("radio", { name });
const tooltip = (page: Page) => modes(page).locator(".mode-tooltip");
const speakButton = (page: Page) =>
  page.getByRole("button", { name: "Speak a command" });
const stopButton = (page: Page) =>
  page.getByRole("button", { name: "Stop listening" });
const commandStatus = (page: Page) => page.locator(".voice-commands-status");
const example = (page: Page, name: RegExp) =>
  page.locator(".voice-example-row").getByRole("button", { name });

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
  await page.goto(APP_PATH);
  await page.evaluate(() => localStorage.removeItem("ursly-voice-triggers-v1"));
  await page.reload();
}

/** Voice to action is the default control mode, so opening the page is enough. */
async function openVoiceActions(page: Page) {
  await openClean(page);
  await expect(speakButton(page)).toBeVisible();
}

/** Opens the trigger builder, which lives behind a “Customize commands” summary. */
async function openCustomize(page: Page) {
  const customize = page.locator(".voice-customize");
  if (!(await customize.evaluate((element) => element.hasAttribute("open"))))
    await page.getByText("Customize commands", { exact: true }).click();
  await expect(page.getByLabel("Trigger word or phrase")).toBeVisible();
}

async function saveTrigger(page: Page, phrase: string) {
  await openCustomize(page);
  await page.getByLabel("Trigger word or phrase").fill(phrase);
  await page.getByRole("button", { name: "Save trigger" }).click();
  await expect(page.getByText(`“${phrase}”`, { exact: true })).toBeVisible();
}

async function arm(page: Page) {
  await speakButton(page).click();
  await expect(stopButton(page)).toHaveAttribute("aria-pressed", "true");
  await expect(commandStatus(page)).toContainText("Listening for a command");
}

async function emitSpeech(page: Page, transcript: string) {
  await page.evaluate((value) => {
    const speech = (window as VoiceTestWindow).__urslySpeech;
    speech?.instances.at(-1)?.emit(value);
  }, transcript);
}

test("voice to action is the default mode and the source picker is immediate", async ({
  page,
}) => {
  await openClean(page);

  await expect(modes(page)).toBeVisible();
  await expect(mode(page, "Voice to action")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(mode(page, "Keyboard to action")).toBeVisible();
  await expect(mode(page, "Keyboard to action")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  const motion = mode(page, /Motion to action/);
  await expect(motion).toBeVisible();
  await expect(motion).toHaveAttribute("aria-disabled", "true");

  await expect(
    page.getByRole("heading", { name: "1. Add a source" }),
  ).toBeVisible();
  await expect(page.getByLabel("PDF file")).toBeVisible();
  await expect(speakButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("heading", { name: "2. Ask a question" }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Ask a question", { exact: true }),
  ).toBeEnabled();

  await motion.hover();
  await expect(tooltip(page)).toHaveCSS("opacity", "1");
  await expect(tooltip(page)).toContainText("not available yet");

  await page.getByRole("tab", { name: "YouTube video" }).click();
  await expect(page.getByLabel("YouTube URL")).toBeVisible();

  await mode(page, "Keyboard to action").click();
  await expect(mode(page, "Keyboard to action")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(speakButton(page)).toHaveCount(0);
  await expect(page.getByLabel("YouTube URL")).toBeVisible();
});

test("voice command examples name their phrase and effect, and the builder stays tucked away", async ({
  page,
}) => {
  await openVoiceActions(page);

  await expect(commandStatus(page)).toContainText(
    "Press once, then say a command such as “Upload” or “YouTube”.",
  );
  await expect(page.locator(".voice-example-row .voice-example")).toHaveCount(
    4,
  );
  for (const name of [
    "“YouTube” switch to YouTube",
    "“Upload” open the PDF picker",
    "“Let’s talk” try a voice action",
    "“Summarize this” ask for a summary",
  ])
    await expect(page.getByRole("button", { name, exact: true })).toBeVisible();

  const customize = page.locator(".voice-customize");
  await expect(customize).not.toHaveAttribute("open", "");
  await expect(page.getByLabel("Trigger word or phrase")).toBeHidden();
  await openCustomize(page);
  await expect(customize).toHaveAttribute("open", "");
  await expect(
    page.getByRole("heading", { name: "Build a trigger" }),
  ).toBeVisible();
});

test("motion to action stays a disabled beta that only explains itself", async ({
  page,
}) => {
  await openClean(page);

  const motion = mode(page, /Motion to action/);
  await motion.click({ force: true });
  await expect(motion).toHaveAttribute("aria-checked", "false");
  await expect(mode(page, "Voice to action")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(modes(page)).toHaveAttribute("data-explaining", "true");
  await expect(tooltip(page)).toHaveCSS("opacity", "1");
  await expect(tooltip(page)).toContainText("not available yet");
  await expect(page.getByLabel("PDF file")).toBeVisible();
  await expect(speakButton(page)).toBeVisible();

  await mode(page, "Keyboard to action").click();
  await expect(mode(page, "Keyboard to action")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await motion.click({ force: true });
  await expect(mode(page, "Keyboard to action")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(motion).toHaveAttribute("aria-checked", "false");
});

test("default upload action runs from a spoken trigger through the PDF picker", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openVoiceActions(page);

  await openCustomize(page);
  await expect(page.getByLabel("When I say it…")).toHaveValue("upload");
  await expect(
    page.getByRole("button", { name: "Save trigger" }),
  ).toBeDisabled();
  await page.getByLabel("Trigger word or phrase").fill("  open upload  ");
  await page.getByRole("button", { name: "Save trigger" }).click();
  await expect(page.getByText("“open upload”", { exact: true })).toBeVisible();

  await arm(page);

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

test("example actions route to their controls and guard voice without a source", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openVoiceActions(page);

  await example(page, /“YouTube” switch to YouTube/).click();
  await expect(
    page.getByRole("tab", { name: "YouTube video" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("YouTube URL")).toBeFocused();

  await example(page, /“Summarize this” ask for a summary/).click();
  await expect(page.getByLabel("Ask a question", { exact: true })).toHaveValue(
    "",
  );
  await expect(page.locator(".toast")).toContainText(
    /Add a PDF or YouTube source first/,
  );

  await example(page, /“Let’s talk”/).click();
  await expect(commandStatus(page)).toContainText(
    /Add a PDF or YouTube source first, then say “Let’s talk” again/,
  );
  await expect(page.locator(".conversation-card .status")).toHaveText("Ready");

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

  // Once a source exists the command panel steps aside for the conversation.
  await expect(speakButton(page)).toHaveCount(0);
  await page.getByRole("button", { name: "Summarize the key ideas" }).click();
  await expect(page.getByLabel("Ask a question", { exact: true })).toHaveValue(
    "Summarize the key ideas",
  );
  await expect(
    page.getByLabel("Ask a question", { exact: true }),
  ).toBeFocused();

  await page.getByRole("button", { name: "Start voice chat" }).click();
  await expect(
    page.getByRole("region", { name: "2. Ask a question" }).locator(".status"),
  ).toHaveText("Connected");
});

test("speech matching ignores unrelated input and suppresses an immediate duplicate", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openVoiceActions(page);

  await saveTrigger(page, "upload this");
  await arm(page);

  await emitSpeech(page, "nothing relevant");
  await expect(stopButton(page)).toHaveAttribute("aria-pressed", "true");
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

  await saveTrigger(page, "listen now");
  await arm(page);

  await page.evaluate(() => {
    const speech = (window as VoiceTestWindow).__urslySpeech;
    speech?.instances.at(-1)?.fail();
  });
  await expect(speakButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(commandStatus(page)).toContainText("Voice to action");
  await expect(commandStatus(page)).toContainText(
    /stopped unexpectedly|need microphone access/,
  );
});

test("manual stop prevents a late recognition result from triggering an action", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openVoiceActions(page);

  await saveTrigger(page, "late upload");
  await arm(page);

  await stopButton(page).click();
  await emitSpeech(page, "late upload");

  await expect(page.getByText("Voice actions are off")).toBeVisible();
  await expect(page.getByText(/Triggered “late upload”/)).toHaveCount(0);
});

test("hiding the page stops an armed voice recognizer", async ({ page }) => {
  await installSpeechHarness(page);
  await openVoiceActions(page);

  await saveTrigger(page, "background check");
  await arm(page);

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

  await saveTrigger(page, "hello");
  await speakButton(page).click();
  await expect(
    page.getByText(/does not support speech recognition/),
  ).toBeVisible();
  await expect(speakButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByText(/Live speech recognition is not available in this browser/),
  ).toBeVisible();
});

test("invalid and duplicate trigger phrases cannot become catch-all actions", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openVoiceActions(page);

  await openCustomize(page);
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
  await expect(speakButton(page)).toBeVisible();
  await openCustomize(page);
  await expect(page.getByText(/No saved triggers yet/)).toBeVisible();
});

test("back, next and cancel are active defaults and can be edited", async ({
  page,
}) => {
  await installSpeechHarness(page);
  await openVoiceActions(page);

  await openCustomize(page);
  await expect(page.getByText("“back”", { exact: true })).toBeVisible();
  await expect(page.getByText("“next”", { exact: true })).toBeVisible();
  await expect(page.getByText("“cancel”", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Edit trigger back" }).click();
  await page.getByLabel("Trigger word or phrase").fill("previous");
  await page.getByRole("button", { name: "Update trigger" }).click();
  await expect(page.getByText("“previous”", { exact: true })).toBeVisible();
  await expect(page.getByText("“back”", { exact: true })).toHaveCount(0);

  await arm(page);
  await emitSpeech(page, "previous");
  await expect(
    page.getByText("Going back — the source controls are ready."),
  ).toBeVisible();

  // Ursly speaks its confirmation before it listens again, so the next word
  // is only heard once the microphone is back on.
  await expect(page.getByText("Listening for a command")).toBeVisible({
    timeout: 15_000,
  });
  await emitSpeech(page, "next");
  await expect(
    page.getByText("Next step: choose a PDF or paste a YouTube link."),
  ).toBeVisible();

  await expect(page.getByText("Listening for a command")).toBeVisible({
    timeout: 15_000,
  });
  await emitSpeech(page, "cancel");
  // Cancel stops listening: the button offers to start again.
  await expect(
    page.getByRole("button", { name: "Speak a command" }),
  ).toBeVisible();
  await expect(page.getByText("Listening for a command")).toHaveCount(0);
  await expect(
    page.getByText("Cancelled — the current action has been stopped."),
  ).toBeVisible();
});
