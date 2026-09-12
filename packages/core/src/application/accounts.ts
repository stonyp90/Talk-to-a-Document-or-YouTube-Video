import {
  chargeUsage,
  codeAttemptsExhausted,
  isCodeExpired,
  normalizeEmail,
  usageWindowResetsAt,
  type Account,
  type UsageWindow,
} from "../domain/account";
import type {
  AccountSession,
  AccountStorePort,
  NotifierPort,
  SecureTokenPort,
} from "./ports";

/**
 * Everything a sign-in needs to refuse politely: the code was wrong, the code
 * was old, or too many were tried. The reader already knows their own address,
 * so naming the reason costs nothing and saves a second round of guessing.
 */
export class SignInError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "SignInError";
    this.code = code;
  }
}

export class UsageLimitError extends Error {
  readonly code = "USAGE_LIMIT";
  /** How long until the allowance opens again, so the reply can say so. */
  readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = "UsageLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

/** Limits and lifetimes are configuration; the caller resolves them, never this file. */
export type AccountPolicy = {
  codeTtlMs: number;
  maxCodeAttempts: number;
  limitUnits: number;
  windowMs: number;
};

export type AccountPorts = {
  store: AccountStorePort;
  notifier: NotifierPort;
  tokens: SecureTokenPort;
  policy: AccountPolicy;
  now?: () => number;
};

export type SignInResult = { account: Account; session: AccountSession };

export function createAccounts({
  store,
  notifier,
  tokens,
  policy,
  now = () => Date.now(),
}: AccountPorts) {
  const findOrCreate = async (email: string): Promise<Account> =>
    (await store.findByEmail(email)) ?? (await store.create(email));

  return {
    /**
     * Starts a sign-in. The code is generated, hashed, stored as a hash and
     * mailed — it is never returned, never logged and never persisted in clear,
     * so possession of the mailbox is the only way to complete the flow.
     */
    async requestSignIn(rawEmail: string): Promise<{ email: string }> {
      const email = normalizeEmail(rawEmail);
      await findOrCreate(email);
      const code = tokens.randomCode();
      await store.saveChallenge(email, {
        codeHash: tokens.hash(code),
        issuedAt: now(),
        attempts: 0,
      });
      await notifier.sendSignInCode(email, code);
      return { email };
    },

    /**
     * Finishes a sign-in. Comparison happens on the hashes, so a stored value
     * is never enough to sign in, and every wrong guess is counted: a six-digit
     * code with an unbounded number of attempts is not a secret.
     */
    async confirmSignIn(rawEmail: string, code: string): Promise<SignInResult> {
      const email = normalizeEmail(rawEmail);
      const challenge = await store.readChallenge(email);
      if (!challenge)
        throw new SignInError(
          "That code is not valid. Ask for a new one.",
          "CODE_INVALID",
        );

      if (isCodeExpired(challenge.issuedAt, now(), policy.codeTtlMs)) {
        await store.clearChallenge(email);
        throw new SignInError(
          "That code has expired. Ask for a new one.",
          "CODE_EXPIRED",
        );
      }
      if (codeAttemptsExhausted(challenge.attempts, policy.maxCodeAttempts)) {
        await store.clearChallenge(email);
        throw new SignInError(
          "Too many attempts. Ask for a new code.",
          "CODE_ATTEMPTS_EXHAUSTED",
        );
      }

      if (tokens.hash(String(code ?? "")) !== challenge.codeHash) {
        const attempts = challenge.attempts + 1;
        if (codeAttemptsExhausted(attempts, policy.maxCodeAttempts)) {
          await store.clearChallenge(email);
          throw new SignInError(
            "Too many attempts. Ask for a new code.",
            "CODE_ATTEMPTS_EXHAUSTED",
          );
        }
        await store.saveChallenge(email, { ...challenge, attempts });
        throw new SignInError(
          "That code is not valid. Check it and try again.",
          "CODE_INVALID",
        );
      }

      await store.clearChallenge(email);
      const account = await findOrCreate(email);
      return { account, session: await store.openSession(account.id) };
    },

    /** The read every guarded request makes. An expired session is ended, not merely refused. */
    async authenticate(token: string): Promise<Account | undefined> {
      if (!token) return undefined;
      const session = await store.readSession(token);
      if (!session) return undefined;
      if (session.expiresAt <= now()) {
        await store.endSession(token);
        return undefined;
      }
      return store.findById(session.accountId);
    },

    async signOut(token: string): Promise<void> {
      if (token) await store.endSession(token);
    },

    /**
     * The spend cap, applied. A refused charge is not recorded, so being over
     * the cap cannot push the window forward and lock the account out longer.
     */
    async charge(
      accountId: string,
      units: number,
    ): Promise<{ remainingUnits: number; window: UsageWindow }> {
      const moment = now();
      const current = (await store.readUsage(accountId)) ?? {
        spentUnits: 0,
        windowStartedAt: moment,
      };
      const charged = chargeUsage(current, units, moment, policy);
      if (!charged.allowed)
        throw new UsageLimitError(
          "You have reached your usage limit for now. It resets shortly.",
          Math.max(0, usageWindowResetsAt(charged.window, policy) - moment),
        );
      await store.writeUsage(accountId, charged.window);
      return { remainingUnits: charged.remainingUnits, window: charged.window };
    },
  };
}

export type Accounts = ReturnType<typeof createAccounts>;
