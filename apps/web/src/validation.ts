import { z } from "zod/v4";
import { MAX_QUESTION_CHARACTERS } from "@/packages/core/src/application/conversation";
import { MAX_VIDEO_QUERY_CHARACTERS } from "@/packages/core/src/application/videoSearch";

/**
 * Request and response shapes for the HTTP API. These schemas validate every
 * inbound body at runtime and are the single source the published OpenAPI
 * document is generated from, so the contract cannot drift from the code.
 */

/**
 * A source as the client holds it. There is no upper bound on the text: the
 * assessment allows any PDF up to 25 MB, and an oversized source is windowed for
 * the model rather than refused. Request body size is bounded by the platform.
 */
export const sourceSchema = z.object({
  kind: z.enum(["pdf", "youtube"]),
  sourceName: z.string().min(1).max(255),
  text: z.string().min(1),
  characters: z.number().nonnegative(),
});

/** Either an opaque server session id, the full source, or both. */
export const sourceReferenceSchema = z
  .object({
    sourceId: z.uuid().optional(),
    source: sourceSchema.optional(),
  })
  .refine((value) => Boolean(value.sourceId || value.source), {
    message: "A sourceId or a source is required.",
  });

export const textChatSchema = sourceReferenceSchema.and(
  z.object({ question: z.string().trim().min(1).max(MAX_QUESTION_CHARACTERS) }),
);

/**
 * A spoken exchange is posted in one batch once the voice turn ends, so the
 * array is bounded: the endpoint appends history, it is not a bulk import.
 */
export const MAX_CONVERSATION_TURNS = 20;

export const conversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(MAX_QUESTION_CHARACTERS),
});

export const conversationTurnsSchema = z.object({
  sourceId: z.uuid(),
  turns: z.array(conversationTurnSchema).min(1).max(MAX_CONVERSATION_TURNS),
});

/**
 * A spoken search phrase, not a URL. The words are what the speaker said with
 * their connective stripped, so the bound is a dictated title, not a document.
 */
export const videoSearchSchema = z.object({
  query: z.string().trim().min(1).max(MAX_VIDEO_QUERY_CHARACTERS),
});

export const videoCandidateSchema = z.object({
  videoId: z.string().min(1),
  title: z.string().min(1),
  channel: z.string().optional(),
  url: z.url(),
});

/** The first hit is opened; the rest stay on offer as alternatives. */
export const videoSearchResponseSchema = z.object({
  results: z.array(videoCandidateSchema),
});

export const uploadRequestSchema = z.object({
  name: z.string().min(1).max(255),
  type: z.string().max(255).nullish(),
  size: z.number().int().positive(),
});

export const extractRequestSchema = z.object({
  key: z.string().min(1).max(255),
  name: z.string().min(1).max(255),
});

export const contextUsageSchema = z.object({
  usedCharacters: z.number().int().nonnegative(),
  totalCharacters: z.number().int().nonnegative(),
  truncated: z.boolean(),
});

export const sourceEnvelopeSchema = z.object({
  source: sourceSchema,
  sourceId: z.uuid(),
  context: contextUsageSchema,
});

export const realtimeCredentialSchema = z.object({
  mode: z.enum(["mock", "live"]),
  clientSecret: z.string(),
  expiresAt: z.number(),
  model: z.string(),
  sourceId: z.uuid(),
});

export const textChatResponseSchema = z.object({
  answer: z.string(),
  sourceId: z.uuid(),
});

export const conversationTurnsResponseSchema = z.object({ sourceId: z.uuid() });

/**
 * One frame of the streamed answer. The route writes these as SSE `data:`
 * payloads, so client and document describe the same shape.
 */
export const textChatStreamFrameSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({
    type: z.literal("done"),
    answer: z.string(),
    sourceId: z.uuid(),
  }),
  z.object({
    type: z.literal("error"),
    error: z.string(),
    code: z.string(),
  }),
]);

export type TextChatStreamFrame = z.infer<typeof textChatStreamFrameSchema>;

export const presignedUploadSchema = z.object({
  url: z.url(),
  fields: z.record(z.string(), z.string()),
  key: z.string(),
});

export const healthSchema = z.object({
  ok: z.boolean(),
  service: z.string(),
  mode: z.enum(["mock", "live"]),
  directUpload: z.boolean(),
  contextCharacterBudget: z.number().int().positive(),
});

export const apiErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
});

/**
 * Sign-in. The address is validated again in the domain, which owns the rule;
 * these bounds only stop an oversized body from reaching it. The code is a
 * string of digits, never a number: leading zeros are part of it.
 */
export const signInRequestSchema = z.object({
  email: z.string().trim().min(3).max(254),
  /**
   * The language the reader asked from, so the code arrives written the way
   * the page they are looking at is. Anything the template does not speak
   * falls back to English rather than being refused, so an old client or a
   * new locale never costs somebody their sign-in.
   */
  language: z.string().trim().max(16).optional(),
});

export const signInConfirmSchema = z.object({
  email: z.string().trim().min(3).max(254),
  code: z
    .string()
    .trim()
    .regex(/^\d{4,12}$/),
});

/** What the browser is told about the session it holds. Never the token itself. */
export const accountSessionSchema = z.object({ email: z.email() });

/**
 * What confirming a code returns. The session is set as an HttpOnly cookie for
 * a browser, and the same token is repeated in the body for a client that has
 * no dependable cookie jar — the native app. It reveals nothing the cookie on
 * the same response does not, and it must never be logged or stored where page
 * scripts can read it.
 */
export const signInConfirmedSchema = accountSessionSchema.extend({
  token: z.string().min(1),
});
