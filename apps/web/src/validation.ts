import { z } from "zod/v4";
import { MAX_QUESTION_CHARACTERS } from "@/packages/core/src/application/conversation";

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
