import type { Page } from "@playwright/test";
import { expect, test } from "./base";
import { APP_PATH } from "../routes";

/**
 * The live discussion channel, driven through the application itself.
 *
 * The unit and contract suites already hold the client and the socket server
 * to their protocol. What is proven here is the thing neither of them can see:
 * that a reader with a source in the workspace really is talking over an open
 * socket — the status line says so, the answers arrive on it, and the
 * request/response endpoints that exist for a closed channel are never called.
 * A regression that quietly drops back to `/api/text-chat` would still answer
 * every question, which is exactly why it needs a journey to catch it.
 */

/** The key the workspace remembers the chosen control mode under. */
const MODE_STORAGE_KEY = "ursly-mode-v1";

/**
 * Long enough that the mocked provider writes it in several fragments, and
 * distinctive enough to recognise inside an answer that quotes the source.
 */
const SOURCE_TEXT =
  "The live discussion channel carries a question as one short frame on a connection that is already open, and writes the answer back in fragments.";

/**
 * What the browser saw while an answer was arriving: every channel state the
 * status line went through, and every time an assistant message was marked as
 * still being written. A Playwright poll can miss both between two renders;
 * an observer inside the page cannot.
 */
type ChannelWatch = {
  states: string[];
  streamingSightings: number;
  textWhileStreaming: string[];
};
declare global {
  interface Window {
    channelWatch: ChannelWatch;
  }
}

const conversation = (page: Page) =>
  page.getByRole("region", { name: "2. Ask a question" });
const channelState = (page: Page) => page.locator(".channel-state");
const thread = (page: Page) => conversation(page).locator(".message");
const answers = (page: Page) =>
  conversation(page).locator(".message.assistant .message-text");

/** A ready source, without spending anything on reading one. */
async function addSource(page: Page) {
  await page.route("**/api/ingest", (route) =>
    route.fulfill({
      json: {
        source: {
          kind: "youtube",
          sourceName: "Live channel test video",
          text: SOURCE_TEXT,
          characters: SOURCE_TEXT.length,
        },
        context: {
          usedCharacters: SOURCE_TEXT.length,
          totalCharacters: SOURCE_TEXT.length,
          truncated: false,
        },
      },
    }),
  );
  await page.getByRole("tab", { name: "YouTube video" }).click();
  await page.getByLabel("YouTube URL").fill("https://youtu.be/live-channel");
  await page.getByRole("button", { name: "Continue to questions" }).click();
  await expect(page.locator(".source-ready")).toBeVisible();
}

/**
 * Waits for the workspace to report a channel at all.
 *
 * The status line is rendered from the moment the client starts connecting, so
 * its absence means the effect never ran: this build has no socket address
 * compiled into it. That is a legitimate way to run the application — answers
 * fall back to the request/response API — so it is skipped rather than failed.
 * A channel that is configured and does not come up is a failure, below.
 */
async function openChannel(page: Page) {
  const configured = await channelState(page)
    .waitFor({ state: "attached", timeout: 15_000 })
    .then(
      () => true,
      () => false,
    );
  test.skip(
    !configured,
    "This build reports no live channel, so NEXT_PUBLIC_CHAT_SOCKET_URL was not set when the application was compiled. Run the suite through `npm run dev`, which starts the channel and points the app at it.",
  );
  await expect(channelState(page)).toHaveClass(/\blive\b/);
}

/** Starts recording what the page does, from a channel that is already open. */
async function watchTheChannel(page: Page) {
  await page.evaluate(() => {
    const watch: Window["channelWatch"] = (window.channelWatch = {
      states: [],
      streamingSightings: 0,
      textWhileStreaming: [],
    });
    const look = () => {
      const state = document
        .querySelector(".channel-state")
        ?.className.replace("channel-state", "")
        .trim();
      if (state && watch.states.at(-1) !== state) watch.states.push(state);
      for (const message of document.querySelectorAll(
        ".message.assistant[data-streaming]",
      )) {
        watch.streamingSightings += 1;
        watch.textWhileStreaming.push(
          message.querySelector(".message-text")?.textContent ?? "",
        );
      }
    };
    new MutationObserver(look).observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    look();
  });
}

/** Every call to the endpoints that answer a question without the channel. */
function watchTheAnswerApi(page: Page) {
  const calls: string[] = [];
  page.on("request", (request) => {
    if (/\/api\/text-chat(\/stream)?(\?|$)/.test(request.url()))
      calls.push(request.url());
  });
  return calls;
}

async function ask(page: Page, question: string) {
  await page.getByLabel("Ask a question", { exact: true }).fill(question);
  await page.getByRole("button", { name: "Send", exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  // The channel belongs to the typed conversation, so the workspace is opened
  // in the mode that has one. The choice is remembered per browser, which is
  // how a returning reader arrives in it too.
  await page.addInitScript(
    (key) => localStorage.setItem(key, "text"),
    MODE_STORAGE_KEY,
  );
  await page.goto(APP_PATH);
  await addSource(page);
  await openChannel(page);
  await watchTheChannel(page);
});

test("tells the reader the live channel is open", async ({ page }) => {
  await expect(channelState(page)).toHaveClass(/\blive\b/);
  await expect(channelState(page)).toContainText("Live channel open");
});

test("answers over the channel, without calling the answer API", async ({
  page,
}) => {
  const apiCalls = watchTheAnswerApi(page);
  const question = "What does the channel carry?";
  await ask(page, question);

  await expect(
    conversation(page).locator(".message.user .message-text"),
  ).toHaveText([question]);
  await expect(answers(page)).toHaveCount(1);
  // The mocked provider answers by quoting the source it was given, so an
  // answer that reached the page really came back through the channel.
  await expect(answers(page).first()).toContainText(SOURCE_TEXT);
  await expect(page.locator(".error")).toHaveCount(0);

  expect(
    apiCalls,
    "A question asked on an open channel must not also be sent to the request/response endpoints.",
  ).toEqual([]);
});

test("answers a follow-up on the same connection, keeping the thread in order", async ({
  page,
}) => {
  const apiCalls = watchTheAnswerApi(page);
  const first = "What does the channel carry?";
  const second = "And how does the answer come back?";

  await ask(page, first);
  await expect(answers(page)).toHaveCount(1);
  await ask(page, second);
  await expect(answers(page)).toHaveCount(2);

  await expect(
    conversation(page).locator(".message.user .message-text"),
  ).toHaveText([first, second]);
  await expect(thread(page)).toHaveCount(4);
  expect(
    await thread(page).evaluateAll((messages) =>
      messages.map((message) =>
        message.classList.contains("user") ? "user" : "assistant",
      ),
    ),
  ).toEqual(["user", "assistant", "user", "assistant"]);
  for (const answer of await answers(page).allTextContents())
    expect(answer).toContain(SOURCE_TEXT);

  // One connection, not two: the status line never left `live`, so nothing
  // was reopened between the two questions, and nothing fell back to HTTP.
  expect(await page.evaluate(() => window.channelWatch.states)).toEqual([
    "live",
  ]);
  expect(apiCalls).toEqual([]);
});

test("shows the answer being written rather than all at once", async ({
  page,
}) => {
  await ask(page, "How does the answer arrive?");
  await expect(answers(page)).toHaveCount(1);
  await expect(answers(page).first()).toContainText(SOURCE_TEXT);
  // The caret is gone once the answer is whole.
  await expect(
    conversation(page).locator(".message.assistant[data-streaming]"),
  ).toHaveCount(0);

  const watch = await page.evaluate(() => window.channelWatch);
  expect(
    watch.streamingSightings,
    "The assistant message was never marked as streaming, so the answer appeared in one block.",
  ).toBeGreaterThan(0);
  // And what it held the first time it was seen was not yet the answer.
  const whole = (await answers(page).first().textContent()) ?? "";
  expect(whole.length).toBeGreaterThan(0);
  expect(watch.textWhileStreaming[0].length).toBeLessThan(whole.length);
});
