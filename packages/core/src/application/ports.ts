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

/** One exchange kept so follow-up questions read naturally. */
export type ConversationTurn = { role: "user" | "assistant"; text: string };

/**
 * A source held on the server for the life of a conversation. Clients carry an
 * opaque id instead of re-uploading the whole extraction with every request.
 */
export type SourceSession = {
  id: string;
  source: IngestedSource;
  turns: ConversationTurn[];
  expiresAt: number;
};

export interface SessionStorePort {
  open(source: IngestedSource): Promise<SourceSession>;
  read(id: string): Promise<SourceSession | undefined>;
  appendTurns(id: string, turns: ConversationTurn[]): Promise<void>;
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
  answerTextQuestion(
    source: IngestedSource,
    question: string,
    history?: ConversationTurn[],
  ): Promise<string>;
}
export interface CredentialPort {
  getKey(): Promise<string>;
}

/** One audio file handed to a provider, named so the provider can type it. */
export type VoiceRecording = { bytes: Uint8Array; filename: string };

/**
 * Lending a voice to the assistant: a recording of the speaker consenting, and
 * a sample of the same speaker to model. Both belong to the same person, and
 * the consent wording is the provider's to dictate.
 */
export type VoiceEnrollmentRequest = {
  name: string;
  language: string;
  consentRecording: VoiceRecording;
  sample: VoiceRecording;
};
export type EnrolledVoice = { id: string; consentId: string };
export interface VoiceEnrollmentPort {
  enroll(request: VoiceEnrollmentRequest): Promise<EnrolledVoice>;
}
