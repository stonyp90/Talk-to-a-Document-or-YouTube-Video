import { z } from "zod/v4";
import {
  apiErrorSchema,
  extractRequestSchema,
  healthSchema,
  presignedUploadSchema,
  realtimeCredentialSchema,
  sourceEnvelopeSchema,
  sourceReferenceSchema,
  textChatResponseSchema,
  textChatSchema,
  uploadRequestSchema,
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
  response: { status: number; schema: z.ZodType; description: string };
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
      { status: 429, description: "Too many ingestion requests." },
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
      { status: 429, description: "Too many upload requests." },
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
      { status: 429, description: "Too many extraction requests." },
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
      { status: 429, description: "Too many voice sessions." },
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
      { status: 429, description: "Too many questions." },
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
        content: {
          "application/json": {
            schema: jsonSchema(operation.response.schema, "output"),
          },
        },
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
        "Ingests a PDF or a captioned YouTube video, exposes the extracted text, and brokers OpenAI Realtime voice sessions using ephemeral credentials. No provider key is ever sent to a client.",
    },
    servers: [{ url: serverUrl ?? "/" }],
    paths,
  };
}
