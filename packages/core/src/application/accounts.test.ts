import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_CODE_TTL_MS,
  DEFAULT_MAX_CODE_ATTEMPTS,
  type Account,
  type UsageWindow,
} from "../domain/account";
import type {
  AccountChallenge,
  AccountSession,
  AccountStorePort,
  NotifierPort,
  SecureTokenPort,
} from "./ports";
import { SignInError, UsageLimitError, createAccounts } from "./accounts";

/** A fake store with the same observable behaviour as the real one, minus the eviction. */
function fakeStore() {
  const accounts = new Map<string, Account>();
  const challenges = new Map<string, AccountChallenge>();
  const sessions = new Map<string, AccountSession>();
  const usage = new Map<string, UsageWindow>();
  let sequence = 0;

  const store: AccountStorePort = {
    async findByEmail(email) {
      return [...accounts.values()].find((account) => account.email === email);
    },
    async findById(id) {
      return accounts.get(id);
    },
    async create(email) {
      const account = { id: `account-${++sequence}`, email, createdAt: 1_000 };
      accounts.set(account.id, account);
      return account;
    },
    async saveChallenge(email, challenge) {
      challenges.set(email, challenge);
    },
    async readChallenge(email) {
      return challenges.get(email);
    },
    async clearChallenge(email) {
      challenges.delete(email);
    },
    async openSession(accountId) {
      const session = {
        token: `token-${++sequence}`,
        accountId,
        expiresAt: 9_999_999,
      };
      sessions.set(session.token, session);
      return session;
    },
    async readSession(token) {
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
  return { store, accounts, challenges, sessions, usage };
}

const codes = ["111111", "222222", "333333"];

function build(overrides: Partial<Parameters<typeof createAccounts>[0]> = {}) {
  const fake = fakeStore();
  let issued = 0;
  let now = 1_000;
  const sent: Array<{ email: string; code: string }> = [];
  const notifier: NotifierPort = {
    sendSignInCode: vi.fn(async (email, code) => {
      sent.push({ email, code });
    }),
  };
  const tokens: SecureTokenPort = {
    randomCode: () => codes[issued++ % codes.length],
    randomToken: () => "unused",
    hash: (value) => `hashed:${value}`,
  };
  const accounts = createAccounts({
    store: fake.store,
    notifier,
    tokens,
    now: () => now,
    policy: {
      codeTtlMs: DEFAULT_CODE_TTL_MS,
      maxCodeAttempts: DEFAULT_MAX_CODE_ATTEMPTS,
      limitUnits: 100,
      windowMs: 60_000,
    },
    ...overrides,
  });
  return {
    accounts,
    notifier,
    sent,
    fake,
    advance: (ms: number) => {
      now += ms;
    },
    at: () => now,
  };
}

describe("requestSignIn", () => {
  let harness: ReturnType<typeof build>;
  beforeEach(() => {
    harness = build();
  });

  it("opens an account the first time an address asks for a code", async () => {
    await harness.accounts.requestSignIn("Reader@Example.com");
    expect([...harness.fake.accounts.values()]).toEqual([
      { id: "account-1", email: "reader@example.com", createdAt: 1_000 },
    ]);
  });

  it("reuses the account on the second request instead of creating a twin", async () => {
    await harness.accounts.requestSignIn("reader@example.com");
    await harness.accounts.requestSignIn("READER@example.com");
    expect(harness.fake.accounts.size).toBe(1);
  });

  it("mails the code and never returns it", async () => {
    const result = await harness.accounts.requestSignIn("reader@example.com");
    expect(harness.sent).toEqual([
      { email: "reader@example.com", code: "111111" },
    ]);
    expect(JSON.stringify(result)).not.toContain("111111");
    expect(result).toEqual({ email: "reader@example.com" });
  });

  it("stores only the hash of the code", async () => {
    await harness.accounts.requestSignIn("reader@example.com");
    const challenge = harness.fake.challenges.get("reader@example.com");
    expect(challenge).toEqual({
      codeHash: "hashed:111111",
      issuedAt: 1_000,
      attempts: 0,
    });
  });

  it("refuses an address that is not one", async () => {
    await expect(harness.accounts.requestSignIn("nope")).rejects.toMatchObject({
      code: "INVALID_EMAIL",
    });
  });
});

describe("confirmSignIn", () => {
  let harness: ReturnType<typeof build>;
  beforeEach(async () => {
    harness = build();
    await harness.accounts.requestSignIn("reader@example.com");
  });

  it("opens a session for the right code and clears the challenge", async () => {
    const result = await harness.accounts.confirmSignIn(
      "Reader@example.com",
      "111111",
    );
    expect(result.account.email).toBe("reader@example.com");
    expect(result.session.accountId).toBe(result.account.id);
    expect(harness.fake.challenges.size).toBe(0);
  });

  it("counts a wrong code as an attempt and keeps the challenge alive", async () => {
    await expect(
      harness.accounts.confirmSignIn("reader@example.com", "999999"),
    ).rejects.toMatchObject({ code: "CODE_INVALID" });
    expect(harness.fake.challenges.get("reader@example.com")?.attempts).toBe(1);
  });

  it("throws the challenge away once the attempts are spent", async () => {
    for (let attempt = 1; attempt < DEFAULT_MAX_CODE_ATTEMPTS; attempt++)
      await expect(
        harness.accounts.confirmSignIn("reader@example.com", "999999"),
      ).rejects.toMatchObject({ code: "CODE_INVALID" });

    await expect(
      harness.accounts.confirmSignIn("reader@example.com", "999999"),
    ).rejects.toMatchObject({ code: "CODE_ATTEMPTS_EXHAUSTED" });
    expect(harness.fake.challenges.size).toBe(0);

    // Even the right code is worthless now: the challenge is gone.
    await expect(
      harness.accounts.confirmSignIn("reader@example.com", "111111"),
    ).rejects.toMatchObject({ code: "CODE_INVALID" });
  });

  it("refuses a code that has outlived its window", async () => {
    harness.advance(DEFAULT_CODE_TTL_MS);
    await expect(
      harness.accounts.confirmSignIn("reader@example.com", "111111"),
    ).rejects.toMatchObject({ code: "CODE_EXPIRED" });
    expect(harness.fake.challenges.size).toBe(0);
  });

  it("refuses an address that never asked for a code", async () => {
    await expect(
      harness.accounts.confirmSignIn("stranger@example.com", "111111"),
    ).rejects.toBeInstanceOf(SignInError);
  });
});

describe("authenticate and signOut", () => {
  it("resolves a live session to its account", async () => {
    const harness = build();
    await harness.accounts.requestSignIn("reader@example.com");
    const { session } = await harness.accounts.confirmSignIn(
      "reader@example.com",
      "111111",
    );
    await expect(
      harness.accounts.authenticate(session.token),
    ).resolves.toMatchObject({ email: "reader@example.com" });
  });

  it("resolves nothing for a missing, forged or expired token", async () => {
    const harness = build();
    await harness.accounts.requestSignIn("reader@example.com");
    const { session } = await harness.accounts.confirmSignIn(
      "reader@example.com",
      "111111",
    );
    await expect(harness.accounts.authenticate("")).resolves.toBeUndefined();
    await expect(
      harness.accounts.authenticate("forged"),
    ).resolves.toBeUndefined();

    harness.fake.sessions.set(session.token, {
      ...session,
      expiresAt: harness.at(),
    });
    await expect(
      harness.accounts.authenticate(session.token),
    ).resolves.toBeUndefined();
    // An expired session is not left lying around to be probed again.
    expect(harness.fake.sessions.has(session.token)).toBe(false);
  });

  it("ends a session on sign-out", async () => {
    const harness = build();
    await harness.accounts.requestSignIn("reader@example.com");
    const { session } = await harness.accounts.confirmSignIn(
      "reader@example.com",
      "111111",
    );
    await harness.accounts.signOut(session.token);
    await expect(
      harness.accounts.authenticate(session.token),
    ).resolves.toBeUndefined();
  });
});

describe("charge", () => {
  it("records what an account has spent", async () => {
    const harness = build();
    await expect(
      harness.accounts.charge("account-1", 40),
    ).resolves.toMatchObject({
      remainingUnits: 60,
    });
    expect(harness.fake.usage.get("account-1")).toEqual({
      spentUnits: 40,
      windowStartedAt: 1_000,
    });
  });

  it("refuses the call that would cross the cap and says when to come back", async () => {
    const harness = build();
    await harness.accounts.charge("account-1", 100);
    const error = await harness.accounts
      .charge("account-1", 1)
      .catch((thrown) => thrown);
    expect(error).toBeInstanceOf(UsageLimitError);
    expect(error.code).toBe("USAGE_LIMIT");
    expect(error.retryAfterMs).toBe(60_000);
    // The refused charge must not have been recorded.
    expect(harness.fake.usage.get("account-1")).toEqual({
      spentUnits: 100,
      windowStartedAt: 1_000,
    });
  });

  it("opens a fresh allowance once the window has elapsed", async () => {
    const harness = build();
    await harness.accounts.charge("account-1", 100);
    harness.advance(60_000);
    await expect(
      harness.accounts.charge("account-1", 10),
    ).resolves.toMatchObject({ remainingUnits: 90 });
  });
});
