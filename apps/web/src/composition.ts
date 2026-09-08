// The only server-side assembly point: inbound HTTP -> use cases -> outbound ports.
import path from "node:path";
import { existsSync } from "node:fs";
import { createIngestion } from "@/packages/core/src/application/ingestion";
import { createConversation } from "@/packages/core/src/application/conversation";
import type {
  PdfMetadata,
  TranscriptPort,
} from "@/packages/core/src/application/ports";
import {
  InputValidationError,
  validatePdf,
} from "@/packages/core/src/domain/ingestion";
import { createPdfParser } from "@/packages/adapters/src/ingestion";
import { createS3Uploads } from "@/packages/adapters/src/uploads";
import { createTranscriptProvider } from "@/packages/adapters/src/providers";
import { createConversationAdapter } from "@/packages/adapters/src/openai";
import { getOpenAiKey } from "@/packages/adapters/src/secrets";

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
  createConversation(createConversationAdapter({ getKey: getOpenAiKey }));
export const createRealtimeSession: ReturnType<
  typeof createConversation
>["createRealtimeSession"] = (...args) =>
  conversation().createRealtimeSession(...args);
export const createRealtimeCallAnswer: ReturnType<
  typeof createConversation
>["createRealtimeCallAnswer"] = (...args) =>
  conversation().createRealtimeCallAnswer(...args);
export const answerTextQuestion: ReturnType<
  typeof createConversation
>["answerTextQuestion"] = (...args) =>
  conversation().answerTextQuestion(...args);
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
