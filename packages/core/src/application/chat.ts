import {
  decodeClientMessage,
  parseClientFrame,
  type ClientMessage,
  type ServerMessage,
} from "../domain/chat";
import { buildContextWindow } from "../domain/context";
import { InputValidationError } from "../domain/ingestion";
import type { ConversationPort } from "./ports";
import { SessionExpiredError, type createSessions } from "./sessions";

/** Where a server message goes. A socket writes it; a gateway posts it. */
export type ChatSend = (message: ServerMessage) => void | Promise<void>;

/**
 * What the transport knows about this one connection and the application does
 * not: whether the reader has already asked more than their share.
 */
export type ChatFrameOptions = { allowAsk?: () => boolean };

type Sessions = ReturnType<typeof createSessions>;

export type ChatChannelDependencies = {
  sessions: Sessions;
  conversation: ConversationPort;
  contextBudget?: number;
  newMessageId?: () => string;
  maxFrameCharacters?: number;
  /** Where an unexpected failure is recorded before it is hidden from the client. */
  logFailure?: (error: unknown) => void;
};

/**
 * Matches by class and by name, because a monorepo can load the same module
 * under two specifiers and an error that crosses that boundary would otherwise
 * be reported as an internal failure.
 */
const named = (error: unknown, name: string): error is Error =>
  error instanceof Error && error.name === name;

/** Turns a thrown value into something the client can act on, and nothing more. */
export function describeChatFailure(error: unknown): {
  code: string;
  message: string;
} {
  if (
    error instanceof InputValidationError ||
    named(error, "InputValidationError")
  )
    return {
      code: (error as { code?: string }).code ?? "INVALID_INPUT",
      message: (error as Error).message,
    };
  if (
    error instanceof SessionExpiredError ||
    named(error, "SessionExpiredError")
  )
    return { code: "SOURCE_EXPIRED", message: (error as Error).message };
  return {
    code: "INTERNAL_ERROR",
    message: "The answer could not be produced. Please retry.",
  };
}

/**
 * One discussion, independent of the socket that carries it.
 *
 * Every frame is answered on the same channel, and a failure is reported as a
 * message rather than thrown, so a single bad question never ends a
 * conversation the reader is in the middle of. Answers are streamed: the
 * client hears the first words while the provider is still writing the rest.
 */
export function createChatChannel(dependencies: ChatChannelDependencies) {
  const {
    sessions,
    conversation,
    contextBudget,
    maxFrameCharacters,
    logFailure = (error: unknown) => console.error("[chat]", error),
  } = dependencies;
  const newMessageId = dependencies.newMessageId ?? (() => crypto.randomUUID());

  async function attach(message: ClientMessage & { type: "attach" }) {
    const session = await sessions.resolve(message);
    const window = buildContextWindow(session.source.text, contextBudget);
    return {
      type: "ready",
      sourceId: session.id,
      context: {
        usedCharacters: window.usedCharacters,
        totalCharacters: window.totalCharacters,
        truncated: window.truncated,
      },
    } satisfies ServerMessage;
  }

  async function ask(
    message: ClientMessage & { type: "ask" },
    send: ChatSend,
    allowAsk?: () => boolean,
  ): Promise<void> {
    if (allowAsk && !allowAsk())
      throw new InputValidationError(
        "That is a lot of questions at once. Wait a moment and ask again.",
        "RATE_LIMITED",
      );
    const session = await sessions.resolve(message);
    const messageId = newMessageId();
    const { askId } = message;
    await send({ type: "answer.started", askId, messageId });
    // The same stream the SSE route reads, carried over a connection the
    // reader already has open instead of a request opened for this question.
    let answer = "";
    for await (const text of conversation.streamTextAnswer(
      session.source,
      message.question,
      session.turns,
    )) {
      if (!text) continue;
      answer += text;
      await send({ type: "answer.delta", askId, messageId, text });
    }
    if (!answer.trim())
      throw new Error("The provider returned no text for a live question.");
    await sessions.record(session.id, [
      { role: "user", text: message.question },
      { role: "assistant", text: answer },
    ]);
    await send({
      type: "answer.completed",
      askId,
      messageId,
      text: answer,
      sourceId: session.id,
    });
  }

  return {
    /**
     * Handles one inbound frame. Text arrives from a socket; an already
     * decoded value arrives from a transport that parsed the envelope itself.
     */
    async handle(
      frame: string | unknown,
      send: ChatSend,
      options: ChatFrameOptions = {},
    ): Promise<void> {
      let message: ClientMessage | undefined;
      try {
        message =
          typeof frame === "string"
            ? parseClientFrame(frame, maxFrameCharacters)
            : decodeClientMessage(frame);
        switch (message.type) {
          case "ping":
            return void (await send({ type: "pong" }));
          case "attach":
            return void (await send(await attach(message)));
          case "ask":
            return await ask(message, send, options.allowAsk);
        }
      } catch (error) {
        const failure = describeChatFailure(error);
        if (failure.code === "INTERNAL_ERROR") logFailure(error);
        await send({
          ...failure,
          type: "error",
          ...(message?.type === "ask" ? { askId: message.askId } : {}),
        });
      }
    },
  };
}
