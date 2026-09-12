import assert from "node:assert/strict";
import { WebSocket } from "ws";
import { startChatServer } from "../../services/chat/src/server";
import { createChatChannel } from "../../packages/core/src/application/chat";
import { createSessions } from "../../packages/core/src/application/sessions";
import { createConversation } from "../../packages/core/src/application/conversation";
import { createMemorySessionStore } from "../../packages/adapters/src/sessionStore";
import { createConversationAdapter } from "../../packages/adapters/src/openai";
import type {
  ConversationTurn,
  ConversationPort,
} from "../../packages/core/src/application/ports";
import type { ServerMessage } from "../../packages/core/src/domain/chat";
import type { Step, World } from "./steps";

/**
 * The live discussion, exercised over a real socket against the real
 * application. Only the provider is stood in for, so what these scenarios
 * prove is the channel a reader actually talks through: the protocol, the
 * streaming, the session the server holds, and what it refuses.
 */

const source = {
  kind: "pdf" as const,
  sourceName: "budget.pdf",
  text: "The budget is forty-two.",
  characters: 24,
};

type Client = {
  socket: WebSocket;
  received: ServerMessage[];
  sent: Record<string, unknown>[];
};

type State = {
  server?: Awaited<ReturnType<typeof startChatServer>>;
  client?: Client;
  sourceId?: string;
  asks: number;
  /** Every history the provider was handed, so a follow-up can be inspected. */
  histories: ConversationTurn[][];
  refused?: boolean;
};

/** A provider that writes in fragments, so streaming is observable. */
function streamingProvider(state: State): ConversationPort {
  const real = createConversationAdapter({ getKey: async () => "" });
  return {
    createRealtimeSession: real.createRealtimeSession,
    createRealtimeCallAnswer: real.createRealtimeCallAnswer,
    answerTextQuestion: real.answerTextQuestion,
    async *streamTextAnswer(_source, question, history) {
      state.histories.push(history ?? []);
      const answer = `Answer to ${question} The budget is forty-two.`;
      yield* answer.match(/\S+\s*/g) ?? [answer];
    },
  };
}

const of = (client: Client, type: string) =>
  client.received.filter((message) => message.type === type);

async function waitFor(
  client: Client,
  type: string,
  count = 1,
  timeoutMs = 10_000,
): Promise<ServerMessage> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const matching = of(client, type);
    if (matching.length >= count) return matching[count - 1];
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(
    `No ${type} frame arrived: ${JSON.stringify(client.received)}`,
  );
}

export function registerDiscussionChecks(step: Step) {
  const states = new WeakMap<World, State>();
  const state = (world: World): State => {
    const existing = states.get(world);
    if (existing) return existing;
    const created: State = { asks: 0, histories: [] };
    states.set(world, created);
    return created;
  };

  async function listen(world: World, askLimit?: number) {
    const current = state(world);
    await current.server?.close();
    current.server = await startChatServer({
      port: 0,
      host: "127.0.0.1",
      allowedOrigins: ["http://localhost:3000"],
      rateLimitDisabled: false,
      ...(askLimit === undefined ? {} : { askLimit, askWindowMs: 60_000 }),
      channel: createChatChannel({
        sessions: createSessions(createMemorySessionStore()),
        conversation: createConversation(streamingProvider(current)),
      }),
    });
  }

  async function open(
    world: World,
    origin = "http://localhost:3000",
  ): Promise<Client> {
    const current = state(world);
    const socket = new WebSocket(
      `ws://127.0.0.1:${current.server?.port}/ws/chat`,
      { origin },
    );
    const client: Client = { socket, received: [], sent: [] };
    socket.on("message", (raw) =>
      client.received.push(JSON.parse(raw.toString())),
    );
    await new Promise<void>((resolve, reject) => {
      socket.once("open", resolve);
      socket.once("error", reject);
    });
    return client;
  }

  function send(world: World, message: Record<string, unknown>) {
    const client = state(world).client;
    assert.ok(client, "The reader has no open discussion.");
    client.sent.push(message);
    client.socket.send(JSON.stringify(message));
  }

  step("a live discussion channel is running", async function () {
    await listen(this);
  });

  // Restarting the channel drops the discussion the background opened, so the
  // reader is reconnected to the channel they are about to test the budget of.
  step("the channel allows one question a minute", async function () {
    await listen(this, 1);
    await openDiscussion.call(this);
  });

  async function openDiscussion(this: World) {
    const current = state(this);
    current.client?.socket.terminate();
    current.client = await open(this);
    send(this, { type: "attach", source });
    const ready = (await waitFor(current.client, "ready")) as {
      sourceId: string;
    };
    current.sourceId = ready.sourceId;
  }

  step("a reader has opened a discussion about their source", openDiscussion);

  step("the channel confirms the conversation and names it", function () {
    assert.ok(
      state(this).sourceId,
      "The channel did not name the conversation.",
    );
  });

  step(
    "the channel reports how much of the source the assistant can see",
    function () {
      const ready = of(state(this).client!, "ready")[0] as {
        context: { usedCharacters: number; totalCharacters: number };
      };
      assert.equal(ready.context.totalCharacters, source.characters);
      assert.equal(ready.context.usedCharacters, source.characters);
    },
  );

  const ask = async function (this: World, question: string) {
    const current = state(this);
    const askId = `ask-${++current.asks}`;
    send(this, { type: "ask", askId, sourceId: current.sourceId, question });
    await waitFor(current.client!, "answer.completed", current.asks);
  };

  step('the reader asks "What is the budget?"', function () {
    return ask.call(this, "What is the budget?");
  });

  step('the reader asks "And who approved it?"', function () {
    return ask.call(this, "And who approved it?");
  });

  step("the answer arrives in more than one fragment", function () {
    assert.ok(
      of(state(this).client!, "answer.delta").length > 1,
      "The answer arrived in one piece.",
    );
  });

  step("the fragments add up to the finished answer", function () {
    const client = state(this).client!;
    const streamed = of(client, "answer.delta")
      .map((message) => (message as { text: string }).text)
      .join("");
    const completed = of(client, "answer.completed")[0] as { text: string };
    assert.equal(streamed, completed.text);
  });

  step(
    "only the conversation's name crossed the network with the follow-up",
    function () {
      const asks = state(this).client!.sent.filter(
        (message) => message.type === "ask",
      );
      assert.equal(asks.length, 2);
      for (const message of asks) {
        assert.ok(
          message.sourceId,
          "A question did not name its conversation.",
        );
        assert.equal(
          message.source,
          undefined,
          "The source was sent again with a question.",
        );
      }
    },
  );

  step("both answers arrived on the same connection", function () {
    assert.equal(of(state(this).client!, "answer.completed").length, 2);
  });

  step("the assistant was given the earlier exchange", function () {
    const [first, second] = state(this).histories;
    assert.equal(first.length, 0);
    assert.equal(second.length, 2);
    assert.equal(second[0].text, "What is the budget?");
  });

  step("the connection drops and the reader reconnects", async function () {
    const current = state(this);
    current.client?.socket.terminate();
    current.client = await open(this);
    send(this, { type: "attach", sourceId: current.sourceId, source });
    await waitFor(current.client, "ready");
  });

  step("the discussion resumes under the same name", function () {
    const current = state(this);
    const ready = of(current.client!, "ready").at(-1) as { sourceId: string };
    assert.equal(ready.sourceId, current.sourceId);
  });

  step("an unreadable message reaches the channel", async function () {
    const current = state(this);
    current.client!.socket.send("not a frame this server can read");
    await waitFor(current.client!, "error");
  });

  step("the channel reports the problem", function () {
    const failure = of(state(this).client!, "error")[0] as { code: string };
    assert.equal(failure.code, "INVALID_MESSAGE");
  });

  step("the discussion is still open", async function () {
    const current = state(this);
    send(this, { type: "ping" });
    await waitFor(current.client!, "pong");
  });

  step("the channel is asked whether it is still there", async function () {
    send(this, { type: "ping" });
    await waitFor(state(this).client!, "pong");
  });

  step("the channel answers that it is", function () {
    assert.equal(of(state(this).client!, "pong").length, 1);
  });

  step(
    "a page on another origin tries to open a discussion",
    async function () {
      const current = state(this);
      current.refused = false;
      try {
        await open(this, "https://not-this-site.example");
      } catch {
        current.refused = true;
      }
    },
  );

  step("the connection is refused", function () {
    assert.equal(state(this).refused, true);
  });

  step("the reader asks two questions at once", async function () {
    const current = state(this);
    for (const question of ["What is the budget?", "And who approved it?"])
      send(this, {
        type: "ask",
        askId: `ask-${++current.asks}`,
        sourceId: current.sourceId,
        question,
      });
    await waitFor(current.client!, "error");
  });

  step(
    "the second is refused with a reason the reader can act on",
    function () {
      const failure = of(state(this).client!, "error")[0] as {
        code: string;
        message: string;
      };
      assert.equal(failure.code, "RATE_LIMITED");
      assert.match(failure.message, /wait/i);
    },
  );

  return async function stopDiscussion(world: World) {
    const current = states.get(world);
    current?.client?.socket.terminate();
    await current?.server?.close();
  };
}
