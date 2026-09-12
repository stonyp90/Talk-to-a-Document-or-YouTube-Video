import assert from "node:assert/strict";
import type { Step, World } from "./steps";
import {
  carriesOwnPhrasing,
  defaultTriggers,
  dictationText,
  isLikelyQuestion,
  isSpokenContent,
  matchCommands,
  spokenArgument,
  takesSpokenArgument,
  type VoiceActionId,
} from "../../packages/core/src/domain/voiceCommands";
import { parseMarkdown } from "../../apps/web/src/lib/markdown";
import { streamAnswer } from "../../apps/web/src/lib/streamAnswer";
import { POST as postTextChat } from "../../apps/web/app/api/text-chat/route";
import { POST as postTurns } from "../../apps/web/app/api/conversation/turns/route";
import { openSource, resolveSession } from "../../apps/web/src/composition";
import { POST as postStream } from "../../apps/web/app/api/text-chat/stream/route";

/**
 * The conversation, exercised in process. Speech is a pure decision over a
 * transcript, so a recogniser is not needed to prove what a sentence means; the
 * streamed answer is proved against the real reader, fed the frames a route
 * writes. Both are the code the browser runs, not a description of it.
 */
type State = {
  transcript?: string;
  language: "en" | "fr";
  actions: VoiceActionId[];
  argument?: string;
  dictated?: string;
  settled: boolean;
  deltas: string[];
  answer?: string;
  failure?: unknown;
  sourceId?: string;
  history: string[];
};

const states = new WeakMap<World, State>();
const state = (world: World): State => {
  let current = states.get(world);
  if (!current) {
    current = {
      language: "en",
      actions: [],
      settled: false,
      deltas: [],
      history: [],
    };
    states.set(world, current);
  }
  return current;
};

/** What the panel decides when a settled phrase arrives. */
function hear(world: World, transcript: string, final = true): void {
  const here = state(world);
  here.transcript = transcript;
  here.settled = final;
  if (!final) return;

  const matches = matchCommands(transcript, defaultTriggers(here.language), {
    language: here.language,
  });
  const leftover = dictationText(transcript, matches);
  const commands = matches.filter((match) => match.trigger.action !== "ask");

  // What a command leaves behind is only dictation if something was said.
  const said =
    commands.length === 0
      ? leftover
      : isSpokenContent(leftover)
        ? leftover
        : "";

  if (
    said &&
    isLikelyQuestion(said) &&
    commands.some((match) => carriesOwnPhrasing(match.trigger.action))
  ) {
    here.dictated = transcript;
    return;
  }

  const searching = commands.find((match) =>
    takesSpokenArgument(match.trigger.action),
  );
  here.argument = searching ? spokenArgument(leftover) : undefined;
  if (said && !here.argument) here.dictated = said;
  here.actions = commands.map((match) => match.trigger.action);
}

const ok = (response: Response) => {
  assert.ok(response.ok, `expected a successful reply, got ${response.status}`);
  return response;
};

const jsonRequest = (path: string, body: unknown) =>
  new Request(`http://localhost${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

/** Runs a block with `fetch` wired to a route handler instead of a network. */
async function withRoute<T>(
  handler: (request: Request) => Promise<Response>,
  run: () => Promise<T>,
): Promise<T> {
  const original = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
    handler(new Request(input as string, init))) as typeof fetch;
  try {
    return await run();
  } finally {
    globalThis.fetch = original;
  }
}

/**
 * A conversation with a source already read. Opening it directly keeps these
 * scenarios about the conversation: extraction has its own feature file, and
 * borrowing it here would make a caption provider a dependency of the chat.
 */
const openFixtureSource = () =>
  openSource({
    kind: "youtube",
    sourceName: "Fixture transcript",
    text: "A deterministic transcript, so an answer has something to be about.",
    characters: 66,
  });

/** A response that writes the given frames, the way the stream route does. */
function eventStream(frames: unknown[], split = false): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const frame of frames) {
        const text = `data: ${JSON.stringify(frame)}\n\n`;
        if (!split) controller.enqueue(encoder.encode(text));
        else {
          const middle = Math.floor(text.length / 2);
          controller.enqueue(encoder.encode(text.slice(0, middle)));
          controller.enqueue(encoder.encode(text.slice(middle)));
        }
      }
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

export function registerConversationChecks(step: Step) {
  // Each sentence is registered with the words it stands for, so the step reads
  // as the thing that was said rather than as a lookup.
  for (const said of [
    "can you go back please",
    "what does this source actually claim",
    "summarize this in three short points",
    "YouTube Miles Davis Kind of Blue",
  ])
    step(`the reader says "${said}"`, function () {
      hear(this, said);
    });

  step('the reader says "peux-tu résumer ça" in French', function () {
    state(this).language = "fr";
    hear(this, "peux-tu résumer ça");
  });

  step('the recogniser offers "back" as an unsettled guess', function () {
    hear(this, "back", false);
  });

  step("the back action runs", function () {
    assert.deepEqual(state(this).actions, ["back"]);
  });

  step("the summarize action is recognised", function () {
    assert.ok(state(this).actions.includes("summarize"));
  });

  step("nothing is left waiting to be sent", function () {
    assert.equal(state(this).dictated, undefined);
  });

  step("no action runs", function () {
    assert.deepEqual(state(this).actions, []);
  });

  step("the words are only shown as heard so far", function () {
    assert.equal(state(this).settled, false);
    assert.equal(state(this).transcript, "back");
  });

  step("the words become the question", function () {
    assert.equal(state(this).dictated, "what does this source actually claim");
  });

  step("the question is sent once the reader stops speaking", function () {
    assert.ok(isLikelyQuestion(state(this).dictated ?? ""));
  });

  step("the whole sentence is sent as the question", function () {
    assert.equal(state(this).dictated, "summarize this in three short points");
  });

  step("the built-in summary shortcut does not run", function () {
    assert.ok(!state(this).actions.includes("summarize"));
  });

  step("the words after the command are used as a search", function () {
    assert.equal(state(this).argument, "Miles Davis Kind of Blue");
  });

  step("the command does not ask the reader for a link", function () {
    assert.deepEqual(state(this).actions, ["youtube"]);
    assert.ok(state(this).argument);
  });

  step(
    "a source is ready and the reader has asked a question",
    async function () {
      state(this).sourceId = (await openFixtureSource()).sourceId;
    },
  );

  step("the answer is produced", async function () {
    const here = state(this);
    // The reader talks to the real route, in this process. Nothing listens on a
    // port during the acceptance run, so the request goes straight to the
    // handler and the frames it writes are the ones the reader parses.
    const result = await withRoute(postStream, () =>
      streamAnswer(
        "http://localhost/api/text-chat/stream",
        { sourceId: here.sourceId, question: "What is this about?" },
        (delta) => here.deltas.push(delta),
        new AbortController().signal,
      ),
    );
    here.answer = result.answer;
  });

  step("the words appear as they arrive", function () {
    assert.ok(
      state(this).deltas.length > 1,
      "the answer arrived in one piece, so nothing was watched arriving",
    );
  });

  step("the finished answer is shown in full", function () {
    const here = state(this);
    assert.equal(here.answer, here.deltas.join(""));
    // Whatever shape the answer takes, the reader sees text and not markup.
    assert.ok(parseMarkdown(here.answer ?? "").length > 0);
  });

  step("an answer is still being written", function () {
    state(this).deltas = [];
  });

  step("the reader stops it", async function () {
    const here = state(this);
    const controller = new AbortController();
    const frames = [
      { type: "delta", text: "Half an " },
      { type: "delta", text: "answer" },
    ];
    const original = globalThis.fetch;
    globalThis.fetch = (async () => eventStream(frames)) as typeof fetch;
    try {
      controller.abort();
      await streamAnswer(
        "http://localhost/api/text-chat/stream",
        {},
        (delta) => here.deltas.push(delta),
        controller.signal,
      );
      here.failure = undefined;
    } catch (caught) {
      here.failure = caught;
      // The reader had already seen these before pressing stop.
      here.answer = "Half an answer";
    } finally {
      globalThis.fetch = original;
    }
  });

  step("the words already written remain", function () {
    assert.equal(state(this).answer, "Half an answer");
  });

  step("the failure state is not shown", function () {
    const failure = state(this).failure;
    assert.ok(
      failure instanceof DOMException && failure.name === "AbortError",
      "a stop must be told apart from a fault",
    );
  });

  step("the connection cannot carry an event stream", function () {
    state(this).deltas = [];
  });

  step("the reader asks a question", async function () {
    const here = state(this);
    here.sourceId = (await openFixtureSource()).sourceId;
    const original = globalThis.fetch;
    globalThis.fetch = (async () => {
      const response = new Response(null, { status: 200 });
      Object.defineProperty(response, "body", { value: null });
      return response;
    }) as typeof fetch;
    try {
      await streamAnswer(
        "http://localhost/api/text-chat/stream",
        {},
        () => {},
        new AbortController().signal,
      );
      here.failure = undefined;
    } catch (caught) {
      here.failure = caught;
    } finally {
      globalThis.fetch = original;
    }
  });

  step("the answer is fetched in one piece instead", function () {
    const failure = state(this).failure as { code?: string } | undefined;
    assert.equal(
      failure?.code,
      "STREAM_UNSUPPORTED",
      "the client needs a signal it can fall back on",
    );
  });

  step("the reader still receives it", async function () {
    const here = state(this);
    const reply = (await ok(
      await postTextChat(
        jsonRequest("/api/text-chat", {
          sourceId: here.sourceId,
          question: "What is this about?",
        }),
      ),
    ).json()) as { answer: string };
    assert.ok(reply.answer.trim());
  });

  step(
    "the reader has spoken an exchange in a live voice session",
    async function () {
      const here = state(this);
      here.sourceId = (await openFixtureSource()).sourceId;
      here.history = ["What did the opening say?", "It introduced the topic."];
      ok(
        await postTurns(
          jsonRequest("/api/conversation/turns", {
            sourceId: here.sourceId,
            turns: [
              { role: "user", text: here.history[0] },
              { role: "assistant", text: here.history[1] },
            ],
          }),
        ),
      );
    },
  );

  step("the reader then types a follow-up question", async function () {
    const here = state(this);
    ok(
      await postTextChat(
        jsonRequest("/api/text-chat", {
          sourceId: here.sourceId,
          question: "And after that?",
        }),
      ),
    );
  });

  step(
    "the spoken exchange is part of the history the answer reads",
    async function () {
      const here = state(this);
      const session = await resolveSession({ sourceId: here.sourceId });
      const said = session.turns.map((turn) => turn.text);
      for (const spoken of here.history) assert.ok(said.includes(spoken));
    },
  );
}
