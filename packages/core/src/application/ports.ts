import type { IngestedSource } from "../domain/ingestion";
import type { Account, UsageWindow } from "../domain/account";

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
  /**
   * The same answer, delivered as it is written. A reader waiting on a whole
   * paragraph reads a spinner; a reader waiting on a delta reads the answer.
   */
  streamTextAnswer(
    source: IngestedSource,
    question: string,
    history?: ConversationTurn[],
  ): AsyncIterable<string>;
}
export interface CredentialPort {
  getKey(): Promise<string>;
}

/**
 * Accounts. Every endpoint behind the gate spends provider credit, so the
 * application needs somewhere to keep who signed in and what they have spent,
 * a way to reach them, and a source of unguessable values. All three are ports:
 * the core owns none of the storage, none of the mail and none of the crypto.
 */
export type AccountChallenge = {
  /** Only ever the hash. A readable code in storage is a code in a backup. */
  codeHash: string;
  issuedAt: number;
  attempts: number;
};

export type AccountSession = {
  token: string;
  accountId: string;
  expiresAt: number;
};

export interface AccountStorePort {
  findByEmail(email: string): Promise<Account | undefined>;
  /** Resolving a session back to its account is the read every guarded request makes. */
  findById(id: string): Promise<Account | undefined>;
  create(email: string): Promise<Account>;
  saveChallenge(email: string, challenge: AccountChallenge): Promise<void>;
  readChallenge(email: string): Promise<AccountChallenge | undefined>;
  clearChallenge(email: string): Promise<void>;
  openSession(accountId: string): Promise<AccountSession>;
  readSession(token: string): Promise<AccountSession | undefined>;
  endSession(token: string): Promise<void>;
  readUsage(accountId: string): Promise<UsageWindow | undefined>;
  writeUsage(accountId: string, window: UsageWindow): Promise<void>;
}

export interface NotifierPort {
  sendSignInCode(email: string, code: string): Promise<void>;
}

/** Randomness and hashing live outside the core, where the platform provides them. */
export interface SecureTokenPort {
  randomCode(): string;
  randomToken(): string;
  hash(value: string): string;
}

/**
 * Finding a video by what a reader says, rather than by a URL they spell out.
 * Nobody dictates "watch question mark v equals ...", so the spoken half of the
 * product needs a way to turn "the Beatles live" into something ingestible.
 */
export type VideoCandidate = {
  videoId: string;
  title: string;
  channel?: string;
  url: string;
};

export interface VideoSearchPort {
  search(query: string, limit: number): Promise<VideoCandidate[]>;
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
