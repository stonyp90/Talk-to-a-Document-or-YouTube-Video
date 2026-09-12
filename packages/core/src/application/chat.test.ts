import { beforeEach, describe, expect, it } from "vitest";
import { createChatChannel } from "./chat";
import { createSessions } from "./sessions";
import type {
  ConversationPort,
  ConversationTurn,
  SessionStorePort,
  SourceSession,
} from "./ports";
import type { ServerMessage } from "../domain/chat";
import { InputValidationError, type IngestedSource } from "../domain/ingestion";

const source: IngestedSource = {
  kind: "pdf",
  sourceName: "brief.pdf",
  text: "The budget is 42.",
  characters: 17,
};

function memoryStore(): SessionStorePort {
  const sessions = new Map<string, SourceSession>();
  let next = 0;
  return {
    async open(opened) {
      const session: SourceSession = {
        id: `session-${++next}`,
        source: opened,
        turns: [],
        expiresAt: Number.MAX_SAFE_INTEGER,
      };
      sessions.set(session.id, session);
      return session;
    },
    async read(id) {
      return sessions.get(id);
    },
    async appendTurns(id, turns) {
      const session = sessions.get(id);
      if (session) session.turns = [...session.turns, ...turns];
    },
  };
}

function stubConversation(
  answer: (question: string, history?: ConversationTurn[]) => string[],
): ConversationPort & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    async createRealtimeSession() {
      throw new Error("not used");
    },
    async createRealtimeCallAnswer() {
      throw new Error("not used");
    },
    async answerTextQuestion(_source, question, history) {
      return answer(question, history).join("");
    },
    async *streamTextAnswer(_source, question, history) {
      asked.push(question);
      yield* answer(question, history);
    },
  };
}

describe("a live discussion over one channel", () => {
  let sent: ServerMessage[];
  const collect = (message: ServerMessage) => {
    sent.push(message);
  };
  beforeEach(() => {
    sent = [];
  });

  const channelWith = (conversation: ConversationPort) =>
    createChatChannel({
      sessions: createSessions(memoryStore()),
      conversation,
      newMessageId: (() => {
        let next = 0;
        return () => `message-${++next}`;
      })(),
    });

  it("opens a conversation from a source and reports how much of it fits", async () => {
    const channel = channelWith(stubConversation(() => ["ok"]));
    await channel.handle(JSON.stringify({ type: "attach", source }), collect);
    expect(sent).toEqual([
      {
        type: "ready",
        sourceId: "session-1",
        context: {
          usedCharacters: 17,
          totalCharacters: 17,
          truncated: false,
        },
      },
    ]);
  });

  it("streams an answer as it arrives rather than after it is finished", async () => {
    const channel = channelWith(
      stubConversation(() => ["The ", "budget ", "is 42."]),
    );
    await channel.handle(JSON.stringify({ type: "attach", source }), collect);
    sent = [];
    await channel.handle(
      JSON.stringify({
        type: "ask",
        askId: "ask-1",
        sourceId: "session-1",
        question: "What is the budget?",
      }),
      collect,
    );
    expect(sent.map((message) => message.type)).toEqual([
      "answer.started",
      "answer.delta",
      "answer.delta",
      "answer.delta",
      "answer.completed",
    ]);
    expect(sent.at(-1)).toEqual({
      type: "answer.completed",
      askId: "ask-1",
      messageId: "message-1",
      text: "The budget is 42.",
      sourceId: "session-1",
    });
  });

  it("carries the earlier exchange into a follow-up question", async () => {
    const conversation = stubConversation((question, history) => [
      `${history?.length ?? 0} earlier turns, asked: ${question}`,
    ]);
    const channel = channelWith(conversation);
    await channel.handle(JSON.stringify({ type: "attach", source }), collect);
    const ask = (askId: string, question: string) =>
      channel.handle(
        JSON.stringify({ type: "ask", askId, sourceId: "session-1", question }),
        collect,
      );
    await ask("ask-1", "What is the budget?");
    sent = [];
    await ask("ask-2", "And who approved it?");
    expect(sent.at(-1)).toMatchObject({
      text: "2 earlier turns, asked: And who approved it?",
    });
  });

  it("keeps the discussion going after the client sends only an id", async () => {
    const channel = channelWith(stubConversation(() => ["ok"]));
    await channel.handle(JSON.stringify({ type: "attach", source }), collect);
    sent = [];
    await channel.handle(
      JSON.stringify({ type: "attach", sourceId: "session-1" }),
      collect,
    );
    expect(sent).toEqual([
      {
        type: "ready",
        sourceId: "session-1",
        context: {
          usedCharacters: 17,
          totalCharacters: 17,
          truncated: false,
        },
      },
    ]);
  });

  it("tells the client to send the source again when the server has forgotten it", async () => {
    const channel = channelWith(stubConversation(() => ["ok"]));
    await channel.handle(
      JSON.stringify({ type: "attach", sourceId: "session-9" }),
      collect,
    );
    expect(sent).toEqual([
      {
        type: "error",
        code: "SOURCE_EXPIRED",
        message: expect.stringContaining("again"),
      },
    ]);
  });

  it("names the question that failed so one bad ask does not stall the rest", async () => {
    const channel = channelWith({
      ...stubConversation(() => []),
      async *streamTextAnswer() {
        throw new InputValidationError("Ask something shorter.", "TOO_LONG");
      },
    });
    await channel.handle(JSON.stringify({ type: "attach", source }), collect);
    sent = [];
    await channel.handle(
      JSON.stringify({
        type: "ask",
        askId: "ask-1",
        sourceId: "session-1",
        question: "What is the budget?",
      }),
      collect,
    );
    expect(sent.at(-1)).toEqual({
      type: "error",
      code: "TOO_LONG",
      message: "Ask something shorter.",
      askId: "ask-1",
    });
  });

  it("never forwards an internal failure to the client", async () => {
    const channel = channelWith({
      ...stubConversation(() => []),
      async *streamTextAnswer() {
        throw new Error("OpenAI key sk-canary rejected at api.openai.com");
      },
    });
    await channel.handle(JSON.stringify({ type: "attach", source }), collect);
    sent = [];
    await channel.handle(
      JSON.stringify({
        type: "ask",
        askId: "ask-1",
        sourceId: "session-1",
        question: "What is the budget?",
      }),
      collect,
    );
    const failure = sent.at(-1) as { code: string; message: string };
    expect(failure.code).toBe("INTERNAL_ERROR");
    expect(failure.message).not.toContain("sk-canary");
  });

  it("answers a keepalive so an idle discussion is not dropped", async () => {
    const channel = channelWith(stubConversation(() => ["ok"]));
    await channel.handle(JSON.stringify({ type: "ping" }), collect);
    expect(sent).toEqual([{ type: "pong" }]);
  });

  it("reports an unreadable frame without closing the discussion", async () => {
    const channel = channelWith(stubConversation(() => ["ok"]));
    await channel.handle("not json", collect);
    expect(sent.at(-1)).toMatchObject({ code: "INVALID_MESSAGE" });
  });
});
