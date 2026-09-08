import type { IngestedSource } from "../domain/ingestion";

export type PdfMetadata = { name: string; type?: string | null; size: number };
export interface PdfTextPort {
  extract(bytes: Uint8Array): Promise<string>;
}
export interface TranscriptPort {
  getTranscript(videoId: string): Promise<{ title: string; text: string }>;
}
export interface TemporaryUploadPort {
  prepare(
    file: PdfMetadata,
  ): Promise<{ url: string; fields: Record<string, string>; key: string }>;
  read(key: string): Promise<Uint8Array>;
  delete(key: string): Promise<void>;
}
export type RealtimeSession = {
  mode: "mock" | "live";
  clientSecret: string;
  expiresAt: number;
  model: string;
  instructions: string;
};
export interface ConversationPort {
  createRealtimeSession(source: IngestedSource): Promise<RealtimeSession>;
  createRealtimeCallAnswer(
    sdp: string,
    source: IngestedSource,
  ): Promise<string>;
  answerTextQuestion(source: IngestedSource, question: string): Promise<string>;
}
export interface CredentialPort {
  getKey(): Promise<string>;
}
