import { z } from "zod/v4";
import {
  accountSessionSchema,
  signInConfirmedSchema,
  apiErrorSchema,
  conversationTurnsResponseSchema,
  conversationTurnsSchema,
  extractRequestSchema,
  healthSchema,
  presignedUploadSchema,
  realtimeCredentialSchema,
  sourceEnvelopeSchema,
  signInConfirmSchema,
  signInRequestSchema,
  sourceReferenceSchema,
  textChatResponseSchema,
  textChatSchema,
  textChatStreamFrameSchema,
  uploadRequestSchema,
  videoSearchResponseSchema,
  videoSearchSchema,
} from "./validation";

/**
 * The OpenAPI document is derived from the same Zod schemas the route handlers
 * validate with, so the published contract cannot drift from the implementation.
 * Nothing here is hand-maintained apart from prose.
 */

type Operation = {
  method: "get" | "post";
  path: string;
  summary: string;
  description: string;
  request?: { schema: z.ZodType; contentType?: string };
  response: {
    status: number;
    schema: z.ZodType;
    description: string;
    /** Defaults to JSON; the streamed answer is served as an event stream. */
    contentType?: string;
  };
  errors: Array<{ status: number; description: string }>;
};

const OPERATIONS: Operation[] = [
  {
    method: "get",
    path: "/api/health",
    summary: "Service health and runtime configuration",
    description:
      "Reports whether real providers are configured, whether direct-to-storage uploads are available, and how much source text fits one conversation.",
    response: {
      status: 200,
      schema: healthSchema,
      description: "The service is reachable.",
    },
    errors: [],
  },
  {
    method: "post",
    path: "/api/auth/request-code",
    summary: "Ask for a one-time sign-in code",
    description:
      "Mails a short-lived code to the address. The answer is an empty 204 whether or not the address already has an account, so this endpoint cannot be used to discover who has one. The code is never part of any response.",
    request: { schema: signInRequestSchema },
    response: {
      status: 204,
      schema: z.void(),
      description: "The request was accepted. Nothing is disclosed.",
    },
    errors: [
      { status: 400, description: "That is not an email address." },
      { status: 429, description: "Too many code requests from this address." },
    ],
  },
  {
    method: "post",
    path: "/api/auth/confirm",
    summary: "Exchange a code for a session",
    description:
      "Confirms the mailed code and sets the session cookie: HttpOnly, SameSite=Lax and Secure outside plain-HTTP localhost. The same token is repeated in the body for a client with no cookie jar — the native app, which sends it back as `Authorization: Bearer`. A browser must keep using the cookie and ignore the field, and the token must never be logged.",
    request: { schema: signInConfirmSchema },
    response: {
      status: 200,
      schema: signInConfirmedSchema,
      description:
        "The signed-in address, and the session token for a client that cannot hold a cookie.",
    },
    errors: [
      { status: 400, description: "The code is not in a usable shape." },
      {
        status: 401,
        description: "The code is wrong, expired, or has been tried too often.",
      },
      { status: 429, description: "Too many sign-in attempts." },
    ],
  },
  {
    method: "get",
    path: "/api/auth/session",
    summary: "Read the current session",
    description:
      "Reports the signed-in address, so an interface can show who is signed in without keeping anything of its own. DELETE on the same path signs out and clears the cookie.",
    response: {
      status: 200,
      schema: accountSessionSchema,
      description: "The signed-in address.",
    },
    errors: [
      { status: 401, description: "No session." },
      { status: 429, description: "Too many session reads." },
    ],
  },
  {
    method: "post",
    path: "/api/ingest",
    summary: "Ingest a PDF or a YouTube URL",
    description:
      "Accepts multipart/form-data with either a `file` field holding a PDF of at most 25 MB, or a `url` field holding a YouTube link. Extraction runs server-side and opens a conversation session for the extracted text.",
    request: { schema: z.any(), contentType: "multipart/form-data" },
    response: {
      status: 200,
      schema: sourceEnvelopeSchema,
      description: "The extracted source, its session id, and its context use.",
    },
    errors: [
      {
        status: 400,
        description:
          "The body could not be read as multipart form data, or the source was rejected during validation.",
      },
      { status: 401, description: "No session; sign in first." },
      {
        status: 429,
        description:
          "Too many ingestion requests, or the account's usage allowance is spent.",
      },
      { status: 502, description: "Captions could not be retrieved." },
    ],
  },
  {
    method: "post",
    path: "/api/uploads",
    summary: "Prepare a direct upload for a large PDF",
    description:
      "Returns a short-lived presigned form post so the browser sends the PDF straight to object storage, keeping large bodies off the API.",
    request: { schema: uploadRequestSchema },
    response: {
      status: 200,
      schema: presignedUploadSchema,
      description: "A presigned multipart form post.",
    },
    errors: [
      {
        status: 400,
        description: "The described file is not an acceptable PDF.",
      },
      { status: 401, description: "No session; sign in first." },
      {
        status: 429,
        description:
          "Too many upload requests, or the account's usage allowance is spent.",
      },
    ],
  },
  {
    method: "post",
    path: "/api/uploads/extract",
    summary: "Extract text from a directly uploaded PDF",
    description:
      "Reads the uploaded object, extracts its text, deletes the object, and opens a conversation session.",
    request: { schema: extractRequestSchema },
    response: {
      status: 200,
      schema: sourceEnvelopeSchema,
      description: "The extracted source, its session id, and its context use.",
    },
    errors: [
      {
        status: 400,
        description: "The upload reference or the PDF is unusable.",
      },
      { status: 401, description: "No session; sign in first." },
      {
        status: 429,
        description:
          "Too many extraction requests, or the account's usage allowance is spent.",
      },
    ],
  },
  {
    method: "post",
    path: "/api/realtime/session",
    summary: "Issue an ephemeral OpenAI Realtime credential",
    description:
      "Primes a Realtime session with the source text and returns a short-lived client secret. The permanent API key never leaves the server. Send `sourceId` alone; include `source` as well to let the server rebuild a session it has forgotten.",
    request: { schema: sourceReferenceSchema },
    response: {
      status: 200,
      schema: realtimeCredentialSchema,
      description:
        "A short-lived credential the browser uses directly with OpenAI.",
    },
    errors: [
      { status: 400, description: "No usable source was supplied." },
      {
        status: 409,
        description: "The session expired and no source was resent.",
      },
      { status: 401, description: "No session; sign in first." },
      {
        status: 429,
        description:
          "Too many voice sessions, or the account's usage allowance is spent.",
      },
    ],
  },
  {
    method: "post",
    path: "/api/text-chat",
    summary: "Ask a written question about the source",
    description:
      "The fallback path when a microphone is unavailable. Recent exchanges are kept server-side so follow-up questions read naturally.",
    request: { schema: textChatSchema },
    response: {
      status: 200,
      schema: textChatResponseSchema,
      description: "The answer, grounded in the source.",
    },
    errors: [
      { status: 400, description: "The question or the source is unusable." },
      {
        status: 409,
        description: "The session expired and no source was resent.",
      },
      { status: 401, description: "No session; sign in first." },
      {
        status: 429,
        description:
          "Too many questions, or the account's usage allowance is spent.",
      },
    ],
  },
  {
    method: "post",
    path: "/api/text-chat/stream",
    summary: "Ask a written question and read the answer as it is written",
    description:
      "The same question as `/api/text-chat`, delivered as Server-Sent Events so the reader sees the answer form instead of waiting for it. Each event is a `data:` line holding one JSON frame: `delta` while the answer is being written, `done` with the whole answer once it is, `error` if the provider fails mid-answer. Failures that happen before the stream opens are ordinary JSON errors, so a client can fall back to the blocking route. The exchange is recorded in the same thread either way.",
    request: { schema: textChatSchema },
    response: {
      status: 200,
      schema: textChatStreamFrameSchema,
      contentType: "text/event-stream",
      description: "A stream of answer frames, one JSON object per event.",
    },
    errors: [
      { status: 400, description: "The question or the source is unusable." },
      {
        status: 409,
        description: "The session expired and no source was resent.",
      },
      { status: 401, description: "No session; sign in first." },
      {
        status: 429,
        description:
          "Too many questions, or the account's usage allowance is spent.",
      },
    ],
  },
  {
    method: "post",
    path: "/api/videos/search",
    summary: "Find a captioned video from spoken words",
    description:
      "Nobody dictates a URL, so a speaker names an artist or a title and this endpoint returns videos to open. Only videos with closed captions are returned: an uncaptioned one cannot be read, so it would fail at ingestion. The first result is the one a client opens; the rest stay on offer as alternatives.",
    request: { schema: videoSearchSchema },
    response: {
      status: 200,
      schema: videoSearchResponseSchema,
      description:
        "Captioned videos, best match first. An empty list means nothing matched.",
    },
    errors: [
      { status: 400, description: "The query is empty or too long." },
      { status: 401, description: "No session; sign in first." },
      {
        status: 429,
        description:
          "Too many searches, or the account's usage allowance is spent.",
      },
    ],
  },
  {
    method: "post",
    path: "/api/conversation/turns",
    summary: "Record a spoken exchange in the conversation thread",
    description:
      "Voice turns happen between the browser and the provider, so the server only learns of them when the client posts them here. Appending them keeps one thread behind both control modes: a typed follow-up reads what was said aloud, and the next spoken answer reads what was typed.",
    request: { schema: conversationTurnsSchema },
    response: {
      status: 200,
      schema: conversationTurnsResponseSchema,
      description: "The session the turns were appended to.",
    },
    errors: [
      {
        status: 400,
        description: "The turns or the session reference are unusable.",
      },
      {
        status: 409,
        description: "The session is no longer held on the server.",
      },
      { status: 401, description: "No session; sign in first." },
      {
        status: 429,
        description:
          "Too many recorded exchanges, or the account's usage allowance is spent.",
      },
    ],
  },
];

const jsonSchema = (schema: z.ZodType, io: "input" | "output") =>
  z.toJSONSchema(schema, { io, unrepresentable: "any" }) as Record<
    string,
    unknown
  >;

export function buildOpenApiDocument(serverUrl?: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  const errorSchema = jsonSchema(apiErrorSchema, "output");

  for (const operation of OPERATIONS) {
    const responses: Record<string, unknown> = {
      [operation.response.status]: {
        description: operation.response.description,
        // A 204 is an answer with no body; documenting a schema for it would
        // describe something the endpoint never sends.
        ...(operation.response.status === 204
          ? {}
          : {
              content: {
                [operation.response.contentType ?? "application/json"]: {
                  schema: jsonSchema(operation.response.schema, "output"),
                },
              },
            }),
      },
    };
    for (const error of operation.errors)
      responses[error.status] = {
        description: error.description,
        content: { "application/json": { schema: errorSchema } },
      };

    paths[operation.path] ??= {};
    paths[operation.path][operation.method] = {
      summary: operation.summary,
      description: operation.description,
      ...(operation.request
        ? {
            requestBody: {
              required: true,
              content: {
                [operation.request.contentType ?? "application/json"]: {
                  schema:
                    operation.request.contentType === "multipart/form-data"
                      ? {
                          type: "object",
                          properties: {
                            file: { type: "string", format: "binary" },
                            url: { type: "string", format: "uri" },
                          },
                        }
                      : jsonSchema(operation.request.schema, "input"),
                },
              },
            },
          }
        : {}),
      responses,
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "Talk to a Document — HTTP API",
      version: "1.0.0",
      description:
        "Ingests a PDF or a captioned YouTube video, exposes the extracted text, and brokers OpenAI Realtime voice sessions using ephemeral credentials. No provider key is ever sent to a client. Every endpoint that spends provider credit requires a session obtained from /api/auth/confirm, carried as the session cookie or, for a client with no cookie jar, as an `Authorization: Bearer` header, and charges a per-account usage allowance; /api/health and this document stay open.",
    },
    servers: [{ url: serverUrl ?? "/" }],
    paths,
  };
}
