import type { Page } from "@playwright/test";
import { expect, test } from "./base";
import { pdfFixture } from "../pdf-fixture";
import {
  answerStream,
  failSpeech,
  hear,
  installSpeech,
  spokenReplies,
} from "./voice-harness";
import { APP_PATH, appPath } from "../routes";
import { installVoiceCaptureFixture } from "./human-sense-harness";

const nav = (page: Page) => page.getByRole("navigation", { name: "Primary" });
const modes = (page: Page) =>
  nav(page).getByRole("radiogroup", { name: "Control mode" });
const mode = (page: Page, name: string | RegExp) =>
  modes(page).getByRole("radio", { name });
const startButton = (page: Page) =>
  page.getByRole("button", { name: "Start experience", exact: true });
const stopExperience = (page: Page) =>
  page.getByRole("button", { name: "Stop experience", exact: true });
const commandStatus = (page: Page) =>
  page.locator('[data-sense-channel="voice"] [role="status"]');
const draftLabel = (page: Page) => page.locator(".voice-draft-label");
const draftText = (page: Page) => page.locator(".voice-draft-text");
const toast = (page: Page) =>
  page.locator('[role="status"]').filter({
    has: page.locator(
      '[aria-label="Dismiss notification"], [aria-label="Fermer la notification"]',
    ),
  });
const question = (page: Page) =>
  page.getByLabel("Ask a question", { exact: true });

test.beforeEach(async ({ page }) => {
  await installVoiceCaptureFixture(page);
  // This suite never reaches paid providers or a configured live channel.
  await page.route("**/api/**", (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/auth/session")
      return route.fulfill({ json: { email: "voice@example.test" } });
    if (path === "/api/health")
      return route.fulfill({
        json: { commandSpeech: "browser", directUpload: false },
      });
    return route.fulfill({
      status: 503,
      json: { error: "Unmocked test endpoint" },
    });
  });
  await page.routeWebSocket(
    (url) => !url.pathname.startsWith("/_next/"),
    (socket) => socket.close(),
  );
});

async function openClean(page: Page) {
  await page.goto(APP_PATH);
  await page.evaluate(() => localStorage.removeItem("ursly-voice-triggers-v1"));
  await page.reload();
}

/** Voice is immediately available in the shared human-sense dock. */
async function openVoiceActions(page: Page) {
  await openClean(page);
  await expect(startButton(page)).toBeVisible();
}

/** Opens the trigger builder, which lives behind a “Customize commands” summary. */
async function openCustomize(page: Page) {
  const settings = page.getByRole("dialog", { name: "Workspace settings" });
  if (!(await settings.isVisible()))
    await page.getByRole("button", { name: "Workspace settings" }).click();
  const customize = page
    .locator("details")
    .filter({ has: page.locator("#voice-trigger-builder") });
  if (!(await customize.evaluate((element) => element.hasAttribute("open"))))
    await page.locator('summary[title="Customize commands"]').click();
  await expect(page.getByLabel("Trigger word or phrase")).toBeVisible();
}

async function saveTrigger(page: Page, phrase: string, action: string) {
  await openCustomize(page);
  await page.getByLabel("Trigger word or phrase").fill(phrase);
  await page.getByLabel("When I say it…").selectOption(action);
  await page.getByRole("button", { name: "Save trigger" }).click();
  const editor = page
    .getByRole("dialog", { name: "Workspace settings" })
    .locator("#voice-trigger-builder");
  await expect(editor.getByRole("status")).toContainText(`Saved “${phrase}”.`);
  await expect(editor.getByRole("status")).toBeVisible();
  await expect(
    editor.locator(".saved-trigger-phrase").filter({ hasText: `“${phrase}”` }),
  ).toBeVisible();
}

async function closeSettings(page: Page) {
  const settings = page.getByRole("dialog", { name: "Workspace settings" });
  if (await settings.isVisible())
    await settings.getByRole("button", { name: "Close settings" }).click();
}

async function arm(page: Page) {
  const customize = page
    .locator("details[open]")
    .filter({ has: page.locator("#voice-trigger-builder") });
  if (await customize.count()) await customize.locator("summary").click();
  await closeSettings(page);
  await startButton(page).click();
  await expect(stopExperience(page)).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('section[aria-label="Speak"]')).toHaveAttribute(
    "data-armed",
    "true",
  );
}

/** A ready source, without spending anything on reading one. */
async function addSource(page: Page) {
  await page.route("**/api/ingest", (route) =>
    route.fulfill({
      json: {
        source: {
          kind: "youtube",
          sourceName: "Voice action test video",
          text: "A source for testing voice action routing.",
          characters: 41,
        },
        sourceId: "voice-action-test-source",
        context: { usedCharacters: 41, totalCharacters: 41, truncated: false },
      },
    }),
  );
  await page.getByRole("button", { name: "Add a source" }).click();
  await page.getByRole("tab", { name: "YouTube video" }).click();
  await page.getByLabel("YouTube URL").fill("https://youtu.be/voice-action");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(
    page.getByRole("button", { name: "Change source", exact: true }),
  ).toBeVisible();
}

/** One answer, already written, so a spoken question can be followed home. */
async function mockAnswer(page: Page, answer: string) {
  await page.route("**/api/text-chat/stream", (route) =>
    route.fulfill({
      contentType: "text/event-stream",
      body: answerStream([answer]),
    }),
  );
}

test("human sense keeps voice, motion and keyboard in one workspace", async ({
  page,
}) => {
  await openClean(page);
  await expect(mode(page, "Sense")).toHaveAttribute("aria-checked", "true");
  await expect(mode(page, "Keyboard to action")).toHaveAttribute(
    "aria-checked",
    "false",
  );
  await expect(nav(page).getByText(/legacy/i)).toBeVisible();
  await expect(nav(page).getByText(/beta/i)).toBeVisible();
  await expect(
    page.getByRole("group", { name: "Sense controls" }),
  ).toBeVisible();
  await expect(startButton(page)).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.getByRole("button", { name: "Speak", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Start motion", exact: true }),
  ).toHaveCount(0);
  await expect(question(page)).toHaveCount(0);

  await page.getByRole("button", { name: "Add a source" }).click();
  const picker = page.getByRole("dialog", { name: "Add a source" });
  await expect(picker.getByLabel("PDF file")).toBeVisible();
  await picker.getByRole("tab", { name: "YouTube video" }).click();
  await expect(picker.getByLabel("YouTube URL")).toBeVisible();
  await picker.getByRole("button", { name: "Close source picker" }).click();
  await mode(page, "Keyboard to action").click();
  await expect(mode(page, "Keyboard to action")).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(startButton(page)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Start motion", exact: true }),
  ).toHaveCount(0);
});

test("the dock omits idle instructions and reveals customization on request", async ({
  page,
}) => {
  await openVoiceActions(page);
  await expect(commandStatus(page)).toHaveCount(0);
  await expect(page.locator(".voice-example-row")).toHaveCount(0);
  await expect(page.getByLabel("Trigger word or phrase")).toBeHidden();
  await openCustomize(page);
  await expect(
    page.getByRole("heading", { name: "Build a trigger" }),
  ).toBeVisible();
  await page.locator('summary[title="Customize commands"]').click();
  await expect(page.getByLabel("Trigger word or phrase")).toBeHidden();
});

test("changing keyboard preference never hides voice or takes the camera", async ({
  page,
}) => {
  await openClean(page);
  const experience = startButton(page);
  await expect(experience).toBeVisible();
  await expect(page.getByLabel("Motion preview")).toBeHidden();
  await mode(page, "Keyboard to action").click();
  await expect(startButton(page)).toBeVisible();
  await expect(experience).toHaveAttribute("aria-pressed", "false");
  await mode(page, "Sense").click();
  await expect(startButton(page)).toBeVisible();
  await expect(page.getByLabel("Motion preview")).toBeHidden();
});

test("a saved trigger heard inside a sentence opens the PDF picker", async ({
  page,
}) => {
  await installSpeech(page);
  await openVoiceActions(page);

  await openCustomize(page);
  await expect(page.getByLabel("When I say it…")).toHaveValue("summarize");
  await expect(
    page.getByRole("button", { name: "Save trigger" }),
  ).toBeDisabled();
  await page.getByLabel("Trigger word or phrase").fill("  open upload  ");
  await page.getByLabel("When I say it…").selectOption("upload");
  await page.getByRole("button", { name: "Save trigger" }).click();
  await expect(
    page
      .locator("#voice-trigger-builder .saved-trigger-phrase")
      .filter({ hasText: "“open upload”" }),
  ).toBeVisible();

  await arm(page);

  const fileChooser = page.waitForEvent("filechooser");
  await hear(page, "Can you OPEN UPLOAD");
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
  await expect(commandStatus(page)).toContainText("Open the PDF upload picker");
  await expect(toast(page)).toContainText("Upload is ready");
  // The padding around a command is padding, not the start of a question, so
  // nothing is left sitting in the composer waiting to be sent.
  await expect(question(page)).toHaveCount(0);
  await expect(page.locator(".voice-draft")).toHaveCount(0);
});

test("words that are not a command gather into one question", async ({
  page,
}) => {
  await installSpeech(page);
  await mockAnswer(page, "The observatory chapter covers the rings.");
  await openVoiceActions(page);
  await addSource(page);
  await arm(page);

  // Two words are an aside, not a question: they wait, and can be dropped.
  await hear(page, "observatory chapter");
  await expect(draftLabel(page)).toHaveText("Your question");
  await expect(draftText(page)).toContainText("observatory chapter");
  await expect(question(page)).toHaveValue("observatory chapter");
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(question(page)).toHaveValue("");

  // A second thought is added to the first rather than replacing it, and the
  // pause that follows the whole question is what sends it.
  await hear(page, "observatory chapter");
  await hear(page, "and its rings");
  await expect(page.locator(".message.user .message-text")).toHaveText(
    "observatory chapter and its rings",
    { timeout: 15_000 },
  );
  await expect(page.locator(".message.assistant .message-text")).toContainText(
    "The observatory chapter covers the rings.",
  );
});

test("spoken actions route to their controls and listening outlives the source", async ({
  page,
}) => {
  await installSpeech(page);
  await openVoiceActions(page);
  await arm(page);
  await hear(page, "youtube");
  await expect(
    page.getByRole("tab", { name: "YouTube video" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("YouTube URL")).toBeFocused();
  await expect(toast(page)).toContainText("YouTube is ready");
  await page.getByRole("button", { name: "Close source picker" }).click();
  await hear(page, "summarize this");
  await expect(question(page)).toHaveCount(0);
  await expect(toast(page)).toContainText(/Add a PDF or YouTube source first/);
  await hear(page, "let's talk");
  await expect(commandStatus(page)).toContainText(
    "Add a PDF or YouTube source first, then say it again.",
  );
  await page.route("**/api/realtime/session", (route) =>
    route.fulfill({
      json: { mode: "mock", sourceId: "voice-action-test-source" },
    }),
  );
  await addSource(page);
  await expect(stopExperience(page)).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: "Start motion", exact: true }),
  ).toHaveCount(0);
  await hear(page, "let's talk");
  await expect(stopExperience(page)).toBeEnabled();
  await expect(page.locator('section[aria-label="Speak"]')).toHaveAttribute(
    "data-armed",
    "false",
  );
});

test("an unsettled hypothesis is shown but never runs a command", async ({
  page,
}) => {
  await installSpeech(page);
  await openVoiceActions(page);
  await arm(page);

  await hear(page, "back", false);
  await expect(draftLabel(page)).toHaveText("Heard");
  await expect(draftText(page)).toHaveText("back");
  await expect(toast(page)).toHaveCount(0);

  // The speaker was on their way to a different word all along.
  await hear(page, "backpack straps");
  await expect(toast(page)).toHaveCount(0);
  await expect(draftText(page)).toContainText("backpack straps");
  await expect(question(page)).toHaveCount(0);
});

test("a built-in command is heard inside an ordinary sentence", async ({
  page,
}) => {
  await installSpeech(page);
  await openVoiceActions(page);
  await arm(page);

  await hear(page, "can you go back please");
  await expect(toast(page)).toContainText(
    "Going back — the source controls are ready.",
  );
  await expect(commandStatus(page)).toContainText(
    "Go back or undo the last step",
  );
  // Listening is continuous: the next command needs no second press.
  await hear(page, "next");
  await expect(toast(page)).toContainText(
    "Next step: choose a PDF or paste a YouTube link.",
  );
  await page.getByRole("button", { name: "Close source picker" }).click();
  await expect(stopExperience(page)).toHaveAttribute("aria-pressed", "true");
});

test("French voice commands work on the French route", async ({ page }) => {
  await installSpeech(page);
  await page.goto(appPath("fr"));
  await page.evaluate(() => localStorage.removeItem("ursly-voice-triggers-v1"));
  await page.reload();

  const parler = page.getByRole("button", {
    name: "Démarrer l’expérience",
    exact: true,
  });
  await expect(parler).toBeVisible();
  await parler.click();
  await expect(
    page.getByRole("button", { name: "Arrêter l’expérience" }),
  ).toHaveAttribute("aria-pressed", "true");

  // The English wording is not part of the French vocabulary.
  await hear(page, "go back please");
  await expect(toast(page)).toHaveCount(0);

  await hear(page, "retour");
  await expect(toast(page)).toContainText(
    "Retour en arrière : les contrôles de la source sont prêts.",
  );
});

test("a spoken question is sent on its own, without pressing anything", async ({
  page,
}) => {
  await installSpeech(page);
  await mockAnswer(page, "The rings are mostly water ice.");
  await openVoiceActions(page);
  await addSource(page);
  await arm(page);

  await hear(page, "what do the rings of Saturn contain");
  await expect(draftText(page)).toContainText(
    "what do the rings of Saturn contain",
  );
  // Nothing was pressed: the pause after the question is what sends it.
  await expect(page.locator(".message.user .message-text")).toHaveText(
    "what do the rings of Saturn contain",
    { timeout: 15_000 },
  );
  await expect(page.locator(".message.assistant .message-text")).toContainText(
    "The rings are mostly water ice.",
  );
  await expect(question(page)).toHaveValue("");
});

test("a reworded shortcut asks what was said, not the canned request", async ({
  page,
}) => {
  await installSpeech(page);
  await mockAnswer(page, "One. Two. Three.");
  await openVoiceActions(page);
  await addSource(page);
  await arm(page);

  await hear(page, "summarize this in three short points");
  await expect(page.locator(".message.user .message-text")).toHaveText(
    "summarize this in three short points",
    { timeout: 15_000 },
  );
  await expect(page.locator(".message.user .message-text")).not.toHaveText(
    "Summarize the key ideas",
  );
});

test("an aside waits, and “send it” sends it", async ({ page }) => {
  await installSpeech(page);
  await mockAnswer(page, "Ice, dust and rock.");
  await openVoiceActions(page);
  await addSource(page);
  await arm(page);

  // Two words are an aside, not a question: they are held, never sent.
  await hear(page, "Saturn rings");
  await expect(question(page)).toHaveValue("Saturn rings");
  // Long enough for the pause that ends a question to have passed twice over.
  await page.waitForTimeout(3200);
  await expect(page.locator(".message.user")).toHaveCount(0);

  await hear(page, "send it");
  await expect(page.locator(".message.user .message-text")).toHaveText(
    "Saturn rings",
  );
  await expect(page.locator(".message.assistant .message-text")).toContainText(
    "Ice, dust and rock.",
  );
});

test("“YouTube” and an artist searches for the video instead of asking for a link", async ({
  page,
}) => {
  await installSpeech(page);
  const searched: string[] = [];
  await page.route("**/api/videos/search", async (route) => {
    searched.push((route.request().postDataJSON() as { query: string }).query);
    await route.fulfill({
      json: {
        results: [
          {
            videoId: "around-the-world",
            title: "Around the World",
            channel: "Daft Punk",
            url: "https://youtu.be/around-the-world",
          },
          {
            videoId: "one-more-time",
            title: "One More Time",
            channel: "Daft Punk",
            url: "https://youtu.be/one-more-time",
          },
        ],
      },
    });
  });
  await page.route("**/api/ingest", (route) =>
    route.fulfill({
      json: {
        source: {
          kind: "youtube",
          sourceName: "Around the World",
          text: "A captioned music video.",
          characters: 24,
        },
        sourceId: "around-the-world",
        context: { usedCharacters: 24, totalCharacters: 24, truncated: false },
      },
    }),
  );
  await openVoiceActions(page);
  await arm(page);

  await hear(page, "YouTube Daft Punk Around the World");
  await expect(toast(page)).toContainText("Opening “Around the World”.");
  expect(searched).toEqual(["Daft Punk Around the World"]);
  await expect(
    page.getByRole("button", { name: "Change source", exact: true }),
  ).toContainText("Around the World");

  await page
    .getByRole("button", { name: "Change source", exact: true })
    .click();
  await expect(page.getByLabel("YouTube URL")).toHaveValue(
    "https://youtu.be/around-the-world",
  );
  // The first answer is not always the intended one, so the rest stay offered.
  await page.getByText("Other videos", { exact: true }).click();
  await expect(
    page.getByRole("button", { name: "One More Time", exact: true }),
  ).toBeVisible();
});

test("Ursly’s spoken confirmation is not heard as another command", async ({
  page,
}) => {
  await installSpeech(page, { replies: true });
  await openVoiceActions(page);
  await arm(page);

  const chooser = page.waitForEvent("filechooser");
  await hear(page, "upload");
  await (
    await chooser
  ).setFiles({
    name: "first.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture("One picker is enough."),
  });
  await expect.poll(() => spokenReplies(page)).toContain("Opening your files.");

  // The reply comes out of the speakers and straight back into the microphone.
  const echoed = page
    .waitForEvent("filechooser", { timeout: 1000 })
    .catch(() => undefined);
  await hear(page, "upload");
  expect(await echoed).toBeUndefined();
});

test("a refused microphone disarms voice; a dropped one does not", async ({
  page,
}) => {
  await installSpeech(page);
  await openVoiceActions(page);
  await arm(page);

  await failSpeech(page, "network");
  await expect(page.locator(".voice-error")).toContainText(
    "The microphone dropped out.",
  );
  // A dropped connection is not a refusal; listening picks itself back up.
  await expect(stopExperience(page)).toHaveAttribute("aria-pressed", "true");

  await failSpeech(page, "not-allowed");
  await expect(page.locator('section[aria-label="Speak"]')).toHaveAttribute(
    "data-armed",
    "false",
  );
  await expect(stopExperience(page)).toBeEnabled();
  await expect(page.locator(".voice-error")).toContainText(
    "Microphone access was denied.",
  );
});

test("manual stop prevents a late recognition result from triggering an action", async ({
  page,
}) => {
  await installSpeech(page);
  await openVoiceActions(page);
  await arm(page);

  await stopExperience(page).click();
  await expect(startButton(page)).toHaveAttribute("aria-pressed", "false");
  await hear(page, "upload");

  await expect(toast(page)).toHaveCount(0);
  await expect(commandStatus(page)).toHaveCount(0);
});

test("hiding the page stops an armed voice recognizer", async ({ page }) => {
  await installSpeech(page);
  await openVoiceActions(page);
  await arm(page);

  await page.evaluate(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(commandStatus(page)).toContainText(
    "Listening stopped when this page was hidden.",
  );
  await expect(page.locator('section[aria-label="Speak"]')).toHaveAttribute(
    "data-armed",
    "false",
  );
  await expect(stopExperience(page)).toBeEnabled();
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

  await startButton(page).click();
  await expect(page.locator(".voice-error")).toContainText(
    "This browser does not recognise speech.",
  );
  await expect(page.locator('section[aria-label="Speak"]')).toHaveAttribute(
    "data-armed",
    "false",
  );
  await openCustomize(page);
  await expect(page.locator(".voice-error")).toContainText(
    "You can still type or add a source.",
  );
  await expect(
    page.getByText(/example buttons still run every action/),
  ).toHaveCount(0);

  await page.locator('summary[title="Customize commands"]').click();
  await closeSettings(page);
  await page.getByRole("button", { name: "Add a source" }).click();
  await page.getByRole("tab", { name: "YouTube video" }).click();
  await expect(page.getByLabel("YouTube URL")).toBeEditable();
});

test("invalid and duplicate trigger phrases cannot become catch-all actions", async ({
  page,
}) => {
  await installSpeech(page);
  await openVoiceActions(page);

  await openCustomize(page);
  const save = page.getByRole("button", { name: "Save trigger" });
  const phrase = page.getByLabel("Trigger word or phrase");
  await phrase.fill("!!!");
  await expect(save).toBeDisabled();

  // A built-in wording is already saved, under the action it belongs to.
  await phrase.fill("Upload");
  await save.click();
  await expect(
    page
      .getByRole("dialog", { name: "Workspace settings" })
      .locator("#voice-trigger-builder")
      .getByRole("alert"),
  ).toHaveText(/is already saved/);

  await phrase.fill("Open my files");
  await page.getByLabel("When I say it…").selectOption("upload");
  await save.click();
  await expect(
    page
      .locator("#voice-trigger-builder .saved-trigger-phrase")
      .filter({ hasText: "“Open my files”" }),
  ).toHaveText("“Open my files”");
  await phrase.fill(" open my files ");
  await save.click();
  await expect(
    page
      .getByRole("dialog", { name: "Workspace settings" })
      .locator("#voice-trigger-builder")
      .getByRole("alert"),
  ).toHaveText(/is already saved/);

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
  await expect(startButton(page)).toBeVisible();
  await openCustomize(page);
  await expect(
    page.getByText("No saved triggers. The built-in wordings still work."),
  ).toBeVisible();

  // Nothing saved is not nothing heard: the built-in wordings carry on.
  await arm(page);
  const chooser = page.waitForEvent("filechooser");
  await hear(page, "upload");
  await (
    await chooser
  ).setFiles({
    name: "built-in.pdf",
    mimeType: "application/pdf",
    buffer: pdfFixture("The built-in wordings still work."),
  });
  await expect(page.getByText("built-in.pdf", { exact: true })).toBeVisible();
});

test("back, next and cancel are active defaults and can be edited", async ({
  page,
}) => {
  await installSpeech(page);
  await openVoiceActions(page);

  await openCustomize(page);
  const saved = page.locator("#voice-trigger-builder .saved-trigger-phrase");
  await expect(saved.filter({ hasText: "“back”" })).toBeVisible();
  await expect(saved.filter({ hasText: "“next”" })).toBeVisible();
  await expect(saved.filter({ hasText: "“cancel”" })).toBeVisible();

  await page.getByRole("button", { name: "Edit trigger back" }).click();
  await page.getByLabel("Trigger word or phrase").fill("previous");
  await page.getByRole("button", { name: "Update trigger" }).click();
  await expect(saved.filter({ hasText: "“previous”" })).toBeVisible();
  await expect(saved.filter({ hasText: "“back”" })).toHaveCount(0);

  await arm(page);
  await hear(page, "previous");
  await expect(toast(page)).toContainText(
    "Going back — the source controls are ready.",
  );

  await hear(page, "cancel");
  await expect(toast(page)).toContainText(
    "Cancelled — the current action has been stopped.",
  );
  await page.getByRole("button", { name: "Close source picker" }).click();
  // Cancel stops listening: the button offers to start again.
  await expect(commandStatus(page)).toContainText(
    "Cancelled. Nothing was sent.",
  );
  await expect(stopExperience(page)).toBeVisible();
  await expect(page.locator('section[aria-label="Speak"]')).toHaveAttribute(
    "data-armed",
    "false",
  );
});

test("a saved trigger drives an action the reader chose for it", async ({
  page,
}) => {
  await installSpeech(page);
  await openVoiceActions(page);

  // Nothing in the phrase is a built-in wording, so only the saved one can
  // explain the action that follows.
  await saveTrigger(page, "roll the tape", "youtube");
  await arm(page);
  await hear(page, "roll the tape");

  await expect(
    page.getByRole("tab", { name: "YouTube video" }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(toast(page)).toContainText("YouTube is ready");
});
