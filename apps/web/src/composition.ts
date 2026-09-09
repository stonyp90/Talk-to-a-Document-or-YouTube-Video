// The only server-side assembly point: inbound HTTP -> use cases -> outbound ports.
import path from "node:path";
import { existsSync } from "node:fs";
import { createIngestion } from "@/packages/core/src/application/ingestion";
import { createConversation } from "@/packages/core/src/application/conversation";
import {
  createSessions,
  type SourceReference,
} from "@/packages/core/src/application/sessions";
import type {
  ConversationTurn,
  PdfMetadata,
  TranscriptPort,
} from "@/packages/core/src/application/ports";
import {
  InputValidationError,
  validatePdf,
  type IngestedSource,
} from "@/packages/core/src/domain/ingestion";
import {
  buildContextWindow,
  resolveContextBudget,
} from "@/packages/core/src/domain/context";
import { createPdfParser } from "@/packages/adapters/src/ingestion";
import { createS3Uploads } from "@/packages/adapters/src/uploads";
import { createTranscriptProvider } from "@/packages/adapters/src/providers";
import { createConversationAdapter } from "@/packages/adapters/src/openai";
import { createMemorySessionStore } from "@/packages/adapters/src/sessionStore";
import { getOpenAiKey } from "@/packages/adapters/src/secrets";

/** Configuration is read here and nowhere in the core. */
export const contextBudget = () =>
  resolveContextBudget(process.env.CONTEXT_CHARACTER_BUDGET);

function ingestion(transcripts?: TranscriptPort) {
  const root = path.join(process.cwd(), "apps/web/public");
  return createIngestion({
    pdf: createPdfParser(
      existsSync(root) ? root : path.join(process.cwd(), "public"),
    ),
    uploads: createS3Uploads(),
    transcripts: transcripts ?? {
      getTranscript: (id) => createTranscriptProvider().getTranscript(id),
    },
  });
}

const conversation = () =>
  createConversation(
    createConversationAdapter({ getKey: getOpenAiKey }, contextBudget()),
    contextBudget(),
  );

// One store per server process, so a warm instance keeps conversations without
// the client resending the extraction on every turn.
const store = createMemorySessionStore({
  ttlMs: Number(process.env.SESSION_TTL_MS ?? 60 * 60 * 1000),
});
const sessions = createSessions(store);

export type SourceEnvelope = {
  source: IngestedSource;
  sourceId: string;
  context: { usedCharacters: number; totalCharacters: number; truncated: boolean };
};

/** Opens a conversation for a freshly extracted source and describes its context use. */
export async function openSource(
  source: IngestedSource,
): Promise<SourceEnvelope> {
  const opened = await sessions.open(source);
  const window = buildContextWindow(source.text, contextBudget());
  return {
    source,
    sourceId: opened.id,
    context: {
      usedCharacters: window.usedCharacters,
      totalCharacters: window.totalCharacters,
      truncated: window.truncated,
    },
  };
}

export const resolveSession = (reference: SourceReference) =>
  sessions.resolve(reference);
export const recordTurns = (id: string, turns: ConversationTurn[]) =>
  sessions.record(id, turns);

export const createRealtimeSession = (source: IngestedSource) =>
  conversation().createRealtimeSession(source);
export const createRealtimeCallAnswer = (sdp: string, source: IngestedSource) =>
  conversation().createRealtimeCallAnswer(sdp, source);
export const answerTextQuestion = (
  source: IngestedSource,
  question: string,
  history?: ConversationTurn[],
) => conversation().answerTextQuestion(source, question, history);

export const prepareUpload = (file: PdfMetadata) =>
  ingestion().prepareUpload(file);
export const extractUpload = (key: string, name: string) =>
  ingestion().upload(key, name);
export const ingestYouTubeUrl = (url: string, transcripts?: TranscriptPort) =>
  ingestion(transcripts).youtube(url);
export async function extractPdfText(
  file: PdfMetadata & { arrayBuffer(): Promise<ArrayBuffer> },
) {
  validatePdf(file);
  return ingestion().pdf(file, new Uint8Array(await file.arrayBuffer()));
}
export async function ingestFormData(form: FormData) {
  const file = form.get("file");
  if (file instanceof File) return extractPdfText(file);
  const url = form.get("url");
  if (typeof url === "string" && url.trim()) return ingestYouTubeUrl(url);
  throw new InputValidationError(
    "Choose a PDF or enter a YouTube URL.",
    "SOURCE_REQUIRED",
  );
}
