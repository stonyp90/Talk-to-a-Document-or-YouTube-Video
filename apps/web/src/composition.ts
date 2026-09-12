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
import {
  createVideoSearch,
  DEFAULT_VIDEO_SEARCH_RESULTS,
} from "@/packages/core/src/application/videoSearch";
import { createAccounts } from "@/packages/core/src/application/accounts";
import {
  DEFAULT_CODE_TTL_MS,
  DEFAULT_MAX_CODE_ATTEMPTS,
  DEFAULT_SESSION_TTL_MS,
  DEFAULT_USAGE_LIMIT_UNITS,
  DEFAULT_USAGE_WINDOW_MS,
} from "@/packages/core/src/domain/account";
import { createPdfParser } from "@/packages/adapters/src/ingestion";
import { createS3Uploads } from "@/packages/adapters/src/uploads";
import { createTranscriptProvider } from "@/packages/adapters/src/providers";
import { createConversationAdapter } from "@/packages/adapters/src/openai";
import { createVideoSearchProvider } from "@/packages/adapters/src/videoSearch";
import { createMemorySessionStore } from "@/packages/adapters/src/sessionStore";
import {
  createEmailNotifier,
  createMemoryAccountStore,
  createSecureTokens,
} from "@/packages/adapters/src/accounts";
import { getOpenAiKey } from "@/packages/adapters/src/secrets";
import { ensureSignInConfigured } from "./startup";

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
  context: {
    usedCharacters: number;
    totalCharacters: number;
    truncated: boolean;
  };
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

export const streamTextAnswer = (
  source: IngestedSource,
  question: string,
  history?: ConversationTurn[],
) => conversation().streamTextAnswer(source, question, history);

/**
 * How many videos one spoken search may come back with. The first is opened
 * and the rest are offered, so this is the length of a list a reader can hear.
 */
const videoSearchResults = () =>
  Number(process.env.VIDEO_SEARCH_MAX_RESULTS) || DEFAULT_VIDEO_SEARCH_RESULTS;

export const findVideos = (query: string) =>
  createVideoSearch(createVideoSearchProvider(), {
    maxResults: videoSearchResults(),
  }).find(query);

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

/* --------------------------------------------------------------------------
 * Accounts, the sign-in gate and the spend cap. Assembled here like everything
 * else: the core sees limits and lifetimes as numbers, never as configuration.
 * -------------------------------------------------------------------------- */

export const accountSessionTtlMs = () =>
  Number(process.env.AUTH_SESSION_TTL_MS) || DEFAULT_SESSION_TTL_MS;

// One source of randomness and hashing for both the codes and the session
// tokens, so a deployment that hardens one has hardened the other.
const accountTokens = createSecureTokens();

const accountStore = createMemoryAccountStore({
  ttlMs: Number(process.env.SIGN_IN_CODE_TTL_MS) || DEFAULT_CODE_TTL_MS,
  sessionTtlMs: accountSessionTtlMs(),
  createToken: () => accountTokens.randomToken(),
});

// One set of use cases per server process, over one store, so a warm instance
// keeps readers signed in and keeps counting what they have spent.
const accounts = createAccounts({
  store: accountStore,
  notifier: createEmailNotifier(),
  tokens: accountTokens,
  policy: {
    codeTtlMs: Number(process.env.SIGN_IN_CODE_TTL_MS) || DEFAULT_CODE_TTL_MS,
    maxCodeAttempts:
      Number(process.env.SIGN_IN_MAX_CODE_ATTEMPTS) ||
      DEFAULT_MAX_CODE_ATTEMPTS,
    limitUnits:
      Number(process.env.USAGE_LIMIT_UNITS) || DEFAULT_USAGE_LIMIT_UNITS,
    windowMs: Number(process.env.USAGE_WINDOW_MS) || DEFAULT_USAGE_WINDOW_MS,
  },
});

// Read the sign-in configuration as the process starts, so a deployment that
// cannot sign anybody in says so in its first log lines rather than in the
// support message of the first reader who tries. The rejection is swallowed
// here on purpose: the refusal belongs to the sign-in endpoints, not to the
// pages, the health check or the reading experience. `next build` loads every
// route module to trace it, which is not a start-up: a build machine has no
// deployment to report on, and the line would only be noise in a build log.
if (process.env.NEXT_PHASE !== "phase-production-build")
  void ensureSignInConfigured().catch(() => {});

// The two calls that hash a one-time code wait for the pepper to arrive from
// the secret store, so nothing is ever hashed against a value that is about to
// be replaced. Everything else — sessions, the ledger — holds no hashed code.
export const requestSignInCode = async (email: string) => {
  await ensureSignInConfigured();
  return accounts.requestSignIn(email);
};
export const confirmSignInCode = async (email: string, code: string) => {
  await ensureSignInConfigured();
  return accounts.confirmSignIn(email, code);
};
export const authenticateAccount = (token: string) =>
  accounts.authenticate(token);
export const signOutAccount = (token: string) => accounts.signOut(token);
export const chargeAccount = (accountId: string, units: number) =>
  accounts.charge(accountId, units);
