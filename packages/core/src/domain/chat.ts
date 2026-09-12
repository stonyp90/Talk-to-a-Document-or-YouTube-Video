import { InputValidationError, type IngestedSource } from "./ingestion";

/**
 * The wire contract for a live discussion.
 *
 * The client opens one socket and keeps it. Everything it says afterwards is
 * one of these frames, and everything the server says back is one of the
 * server frames below. The contract lives in the domain, next to the state
 * machine that consumes it, so both transports that carry it — a long-lived
 * Node socket in development, an API Gateway connection in production —
 * implement the same conversation rather than two dialects of it.
 *
 * Every client frame carries its own source reference. Nothing is remembered
 * between frames, so a dropped connection is resumed by reconnecting and
 * sending the same opaque id, and no transport has to hold state a serverless
 * runtime cannot keep.
 */

/** Upper bound on one inbound frame, generous enough to rehydrate a source. */
export const MAX_CHAT_FRAME_CHARACTERS = 2_000_000;
const MAX_ASK_ID_CHARACTERS = 100;

/** How a client names the source it is discussing: an id, the source, or both. */
export type ChatSourceReference = {
  sourceId?: string;
  source?: IngestedSource;
};

export type ClientMessage =
  | ({ type: "attach" } & ChatSourceReference)
  | ({ type: "ask"; askId: string; question: string } & ChatSourceReference)
  | { type: "ping" };

export type ChatContextUsage = {
  usedCharacters: number;
  totalCharacters: number;
  truncated: boolean;
};

export type ServerMessage =
  | { type: "ready"; sourceId: string; context: ChatContextUsage }
  | { type: "answer.started"; askId: string; messageId: string }
  | { type: "answer.delta"; askId: string; messageId: string; text: string }
  | {
      type: "answer.completed";
      askId: string;
      messageId: string;
      text: string;
      sourceId: string;
    }
  | { type: "error"; code: string; message: string; askId?: string }
  | { type: "pong" };

const invalid = (message: string, code: string) =>
  new InputValidationError(message, code);

function requireString(
  value: unknown,
  field: string,
  code: string,
  max: number,
): string {
  if (typeof value !== "string" || !value.trim())
    throw invalid(`A ${field} is required.`, code);
  if (value.length > max)
    throw invalid(`That ${field} is too large.`, "FRAME_TOO_LARGE");
  return value.trim();
}

function decodeSource(value: unknown): IngestedSource {
  const candidate = value as Partial<IngestedSource> | null;
  if (!candidate || typeof candidate !== "object")
    throw invalid("That source is not readable.", "INVALID_SOURCE");
  if (candidate.kind !== "pdf" && candidate.kind !== "youtube")
    throw invalid("That source kind is not supported.", "INVALID_SOURCE");
  if (typeof candidate.sourceName !== "string" || !candidate.sourceName.trim())
    throw invalid("That source has no name.", "INVALID_SOURCE");
  if (typeof candidate.text !== "string" || !candidate.text.trim())
    throw invalid("That source has no text.", "INVALID_SOURCE");
  if (
    typeof candidate.characters !== "number" ||
    !Number.isFinite(candidate.characters) ||
    candidate.characters < 0
  )
    throw invalid("That source has no length.", "INVALID_SOURCE");
  return {
    kind: candidate.kind,
    sourceName: candidate.sourceName,
    text: candidate.text,
    characters: candidate.characters,
  };
}

function decodeReference(frame: Record<string, unknown>): ChatSourceReference {
  const reference: ChatSourceReference = {};
  if (frame.sourceId !== undefined)
    reference.sourceId = requireString(
      frame.sourceId,
      "source id",
      "INVALID_SOURCE_ID",
      MAX_ASK_ID_CHARACTERS,
    );
  if (frame.source !== undefined) reference.source = decodeSource(frame.source);
  return reference;
}

/** Validates one decoded frame, refusing anything the server will not act on. */
export function decodeClientMessage(raw: unknown): ClientMessage {
  if (!raw || typeof raw !== "object" || Array.isArray(raw))
    throw invalid("That message is not readable.", "INVALID_MESSAGE");
  const frame = raw as Record<string, unknown>;
  switch (frame.type) {
    case "ping":
      return { type: "ping" };
    case "attach":
      return { type: "attach", ...decodeReference(frame) };
    case "ask":
      return {
        type: "ask",
        askId: requireString(
          frame.askId,
          "ask id",
          "INVALID_ASK_ID",
          MAX_ASK_ID_CHARACTERS,
        ),
        // Length is the conversation's rule, not the transport's; the
        // application enforces it so both transports report it identically.
        question: requireString(
          frame.question,
          "question",
          "INVALID_QUESTION",
          MAX_CHAT_FRAME_CHARACTERS,
        ),
        ...decodeReference(frame),
      };
    default:
      throw invalid(
        "That message type is not supported here.",
        "UNSUPPORTED_MESSAGE",
      );
  }
}

/** Reads the text a socket delivered, bounding it before anything parses it. */
export function parseClientFrame(
  frame: string,
  maxCharacters: number = MAX_CHAT_FRAME_CHARACTERS,
): ClientMessage {
  if (frame.length > maxCharacters)
    throw invalid("That message is too large.", "FRAME_TOO_LARGE");
  let parsed: unknown;
  try {
    parsed = JSON.parse(frame);
  } catch {
    throw invalid("That message is not readable.", "INVALID_MESSAGE");
  }
  return decodeClientMessage(parsed);
}

export const encodeServerMessage = (message: ServerMessage): string =>
  JSON.stringify(message);
