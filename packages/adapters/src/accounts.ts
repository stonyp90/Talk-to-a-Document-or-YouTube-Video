import { createHash, createHmac, randomBytes, randomInt } from "node:crypto";
import {
  DEFAULT_CODE_LENGTH,
  DEFAULT_CODE_TTL_MS,
  DEFAULT_SESSION_TTL_MS,
  type Account,
  type UsageWindow,
} from "../../core/src/domain/account";
import { signInEmail, type BrandedEmail } from "../../core/src/domain/email";
import type {
  AccountChallenge,
  AccountSession,
  AccountStorePort,
  NotifierPort,
  SecureTokenPort,
} from "../../core/src/application/ports";

export type MemoryAccountStoreOptions = {
  /** How long an unconfirmed sign-in challenge is kept, in milliseconds. */
  ttlMs?: number;
  /** How long a confirmed session is kept, in milliseconds. */
  sessionTtlMs?: number;
  /** Upper bound on accounts held in one process, oldest evicted first. */
  maxAccounts?: number;
  /** Upper bound on live sessions, oldest evicted first. */
  maxSessions?: number;
  now?: () => number;
  createId?: () => string;
  createToken?: () => string;
};

const DEFAULTS = {
  ttlMs: DEFAULT_CODE_TTL_MS,
  sessionTtlMs: DEFAULT_SESSION_TTL_MS,
  maxAccounts: 5_000,
  maxSessions: 5_000,
};

/**
 * In-memory accounts, sessions and usage ledgers, following the same discipline
 * as the session store beside it: entries expire, the maps are capped so one
 * visitor cannot exhaust memory, and iteration order does the eviction.
 *
 * It is per-process, and that is a real limit rather than a detail. A restart
 * forgets who is signed in and what they have spent, and a second instance has
 * its own ledger, so the cap is per instance. Swapping this adapter for a shared
 * store — the same swap the session store would need — is the only change a
 * horizontally scaled deployment requires; nothing above this file moves.
 */
export function createMemoryAccountStore(
  options: MemoryAccountStoreOptions = {},
): AccountStorePort {
  const ttlMs = options.ttlMs ?? DEFAULTS.ttlMs;
  const sessionTtlMs = options.sessionTtlMs ?? DEFAULTS.sessionTtlMs;
  const maxAccounts = options.maxAccounts ?? DEFAULTS.maxAccounts;
  const maxSessions = options.maxSessions ?? DEFAULTS.maxSessions;
  const now = options.now ?? (() => Date.now());
  const createId = options.createId ?? (() => crypto.randomUUID());
  const createToken =
    options.createToken ?? (() => randomBytes(32).toString("base64url"));

  const accounts = new Map<string, Account>();
  const byEmail = new Map<string, string>();
  const challenges = new Map<string, AccountChallenge>();
  const sessions = new Map<string, AccountSession>();
  const usage = new Map<string, UsageWindow>();

  function evictExpired(): void {
    const moment = now();
    for (const [email, challenge] of challenges)
      if (challenge.issuedAt + ttlMs <= moment) challenges.delete(email);
    for (const [token, session] of sessions)
      if (session.expiresAt <= moment) sessions.delete(token);
  }

  function forget(id: string): void {
    const account = accounts.get(id);
    if (!account) return;
    accounts.delete(id);
    byEmail.delete(account.email);
    usage.delete(id);
    for (const [token, session] of sessions)
      if (session.accountId === id) sessions.delete(token);
  }

  return {
    async findByEmail(email) {
      const id = byEmail.get(email);
      return id ? accounts.get(id) : undefined;
    },

    async findById(id) {
      return accounts.get(id);
    },

    async create(email) {
      // Map iteration is insertion-ordered, so the first key is the oldest.
      while (accounts.size >= maxAccounts) {
        const oldest = accounts.keys().next().value;
        if (oldest === undefined) break;
        forget(oldest);
      }
      const account: Account = { id: createId(), email, createdAt: now() };
      accounts.set(account.id, account);
      byEmail.set(email, account.id);
      return account;
    },

    async saveChallenge(email, challenge) {
      evictExpired();
      challenges.set(email, challenge);
    },

    async readChallenge(email) {
      evictExpired();
      return challenges.get(email);
    },

    async clearChallenge(email) {
      challenges.delete(email);
    },

    async openSession(accountId) {
      evictExpired();
      while (sessions.size >= maxSessions) {
        const oldest = sessions.keys().next().value;
        if (oldest === undefined) break;
        sessions.delete(oldest);
      }
      const session: AccountSession = {
        token: createToken(),
        accountId,
        expiresAt: now() + sessionTtlMs,
      };
      sessions.set(session.token, session);
      return session;
    },

    async readSession(token) {
      evictExpired();
      return sessions.get(token);
    },

    async endSession(token) {
      sessions.delete(token);
    },

    async readUsage(accountId) {
      return usage.get(accountId);
    },

    async writeUsage(accountId, window) {
      usage.set(accountId, window);
    },
  };
}

/**
 * Randomness and hashing, kept out of the core. The pepper is server-side
 * configuration: with it, a stolen challenge table is a table of useless
 * hashes; without it, six digits fall to a rainbow table in seconds.
 */
export function createSecureTokens(): SecureTokenPort {
  const length = Number(process.env.SIGN_IN_CODE_LENGTH) || DEFAULT_CODE_LENGTH;
  const tokenBytes = Number(process.env.AUTH_SESSION_TOKEN_BYTES) || 32;

  return {
    randomCode() {
      // randomInt per digit rather than a modulo of one draw: no bias, and the
      // leading digit may be a zero like any other.
      return Array.from({ length }, () => randomInt(0, 10)).join("");
    },
    randomToken() {
      return randomBytes(tokenBytes).toString("base64url");
    },
    hash(value) {
      return createHash("sha256").update(`${pepper()}:${value}`).digest("hex");
    },
  };
}

let installedPepper: string | undefined;
let processPepper: string | undefined;

/**
 * The composition root installs the pepper here once it has read it from the
 * secret store. A setter rather than a constructor argument because the port
 * hashes synchronously while a Secrets Manager read is asynchronous, and the
 * tokens are assembled before the first request arrives. Nothing hashes until
 * the composition root has awaited that read, so no hash is ever computed
 * against a pepper that is about to be replaced.
 */
export function installAuthPepper(value: string): void {
  installedPepper = value;
}

function pepper(): string {
  return installedPepper || process.env.AUTH_HASH_PEPPER || fallbackPepper();
}

/**
 * A deployment without a configured pepper still gets one, generated per
 * process. Sessions and codes then die with the process, which is inconvenient
 * and safe; the alternative — a constant default — would be a published secret.
 */
function fallbackPepper(): string {
  if (!processPepper) {
    processPepper = randomBytes(32).toString("hex");
    console.warn(
      "[accounts] AUTH_HASH_PEPPER is not set; using a per-process value, so sessions end when this process does.",
    );
  }
  return processPepper;
}

/**
 * How the code reaches the reader. Local and test deployments write it to the
 * server log so the flow can be completed without any mail infrastructure;
 * `EMAIL_MODE=ses` sends it through Amazon SES instead. The mode is read here,
 * in the adapter, and never anywhere above it.
 */
/**
 * How a message leaves the process. There is exactly one of these, whatever
 * the message is: the words are rendered by the one template in the domain
 * and handed here already written, so a new kind of mail cannot invent its
 * own transport, its own subject line or its own look.
 */
type Delivery = (to: string, message: BrandedEmail) => Promise<void>;

export function createEmailNotifier(): NotifierPort {
  const deliver: Delivery =
    process.env.EMAIL_MODE === "ses" ? sendThroughSes : writeToLog;
  return {
    async sendSignInCode(email, code, locale) {
      await deliver(
        email,
        signInEmail({
          code,
          ttlMinutes: ttlMinutes(),
          locale,
          origin: process.env.APP_ORIGIN,
        }),
      );
    },
  };
}

function ttlMinutes(): number {
  return Math.round(
    (Number(process.env.SIGN_IN_CODE_TTL_MS) || DEFAULT_CODE_TTL_MS) / 60_000,
  );
}

/**
 * Deliberate and local only: the developer reads the message from the server
 * log, in the words it would have been mailed in. A deployment that sets
 * EMAIL_MODE=ses never reaches this.
 */
const writeToLog: Delivery = async (to, message) => {
  console.info(
    `[accounts] local sign-in code for ${to}\n${message.subject}\n${message.text}`,
  );
};

/* ------------------------------------------------------------------------- *
 * SES adapter. The repository does not depend on an AWS SES SDK, so the v2
 * HTTPS API is called directly and signed with SigV4 using node:crypto. Every
 * value it needs is a SES_* or AWS_* configuration key; nothing is hardcoded.
 * ------------------------------------------------------------------------- */

type SesConfiguration = {
  region: string;
  from: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  configurationSet?: string;
};

function sesConfiguration(): SesConfiguration {
  const region =
    process.env.SES_REGION || process.env.AWS_REGION || "us-east-1";
  const from = process.env.SES_FROM_ADDRESS;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  if (!from)
    throw new Error(
      "EMAIL_MODE=ses requires SES_FROM_ADDRESS, a verified sender.",
    );
  if (!accessKeyId || !secretAccessKey)
    throw new Error(
      "EMAIL_MODE=ses requires AWS credentials in the environment.",
    );
  return {
    region,
    from,
    accessKeyId,
    secretAccessKey,
    sessionToken: process.env.AWS_SESSION_TOKEN,
    configurationSet: process.env.SES_CONFIGURATION_SET,
  };
}

const sha256 = (value: string) =>
  createHash("sha256").update(value, "utf8").digest("hex");
const hmac = (key: Buffer | string, value: string) =>
  createHmac("sha256", key).update(value, "utf8").digest();

/** AWS Signature Version 4 over a single JSON POST. */
function authorization(
  configuration: SesConfiguration,
  path: string,
  body: string,
  amzDate: string,
  host: string,
): { Authorization: string; SignedHeaders: string } {
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${configuration.region}/ses/aws4_request`;
  const headers: Record<string, string> = {
    "content-type": "application/json",
    host,
    "x-amz-date": amzDate,
    ...(configuration.sessionToken
      ? { "x-amz-security-token": configuration.sessionToken }
      : {}),
  };
  const names = Object.keys(headers).sort();
  const canonicalHeaders = names.map((n) => `${n}:${headers[n]}\n`).join("");
  const signedHeaders = names.join(";");
  const canonicalRequest = [
    "POST",
    path,
    "",
    canonicalHeaders,
    signedHeaders,
    sha256(body),
  ].join("\n");
  const toSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    sha256(canonicalRequest),
  ].join("\n");
  const signingKey = hmac(
    hmac(
      hmac(
        hmac(`AWS4${configuration.secretAccessKey}`, date),
        configuration.region,
      ),
      "ses",
    ),
    "aws4_request",
  );
  const signature = createHmac("sha256", signingKey)
    .update(toSign, "utf8")
    .digest("hex");
  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${configuration.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    SignedHeaders: signedHeaders,
  };
}

const sendThroughSes: Delivery = async (to, message) => {
  const path = "/v2/email/outbound-emails";
  const configuration = sesConfiguration();
  const host = `email.${configuration.region}.amazonaws.com`;
  const body = JSON.stringify({
    FromEmailAddress: configuration.from,
    Destination: { ToAddresses: [to] },
    ...(configuration.configurationSet
      ? { ConfigurationSetName: configuration.configurationSet }
      : {}),
    Content: {
      Simple: {
        Subject: { Data: message.subject, Charset: "UTF-8" },
        Body: {
          Text: { Data: message.text, Charset: "UTF-8" },
          Html: { Data: message.html, Charset: "UTF-8" },
        },
      },
    },
  });
  const amzDate = new Date().toISOString().replace(/[-:]|\.\d{3}/g, "");
  const signed = authorization(configuration, path, body, amzDate, host);

  const response = await fetch(`https://${host}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Host: host,
      "X-Amz-Date": amzDate,
      ...(configuration.sessionToken
        ? { "X-Amz-Security-Token": configuration.sessionToken }
        : {}),
      Authorization: signed.Authorization,
    },
    body,
  });
  // The provider's own message can name accounts and quotas, and the code is
  // in the request; only the status is worth repeating.
  if (!response.ok)
    throw new Error(
      `The sign-in email could not be sent (SES replied ${response.status}).`,
    );
};
