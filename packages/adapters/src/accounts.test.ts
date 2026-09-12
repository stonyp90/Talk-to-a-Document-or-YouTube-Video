import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEmailNotifier,
  createMemoryAccountStore,
  createSecureTokens,
} from "./accounts";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("createMemoryAccountStore", () => {
  it("creates one account per address and finds it again by address or id", async () => {
    const store = createMemoryAccountStore();
    const created = await store.create("reader@example.com");
    expect(await store.findByEmail("reader@example.com")).toEqual(created);
    expect(await store.findById(created.id)).toEqual(created);
    expect(await store.findByEmail("stranger@example.com")).toBeUndefined();
  });

  it("keeps a challenge until it is cleared or has aged out", async () => {
    let now = 1_000;
    const store = createMemoryAccountStore({ ttlMs: 500, now: () => now });
    await store.saveChallenge("reader@example.com", {
      codeHash: "hash",
      issuedAt: now,
      attempts: 0,
    });
    expect(await store.readChallenge("reader@example.com")).toMatchObject({
      attempts: 0,
    });
    now += 500;
    expect(await store.readChallenge("reader@example.com")).toBeUndefined();
  });

  it("forgets a cleared challenge immediately", async () => {
    const store = createMemoryAccountStore();
    await store.saveChallenge("reader@example.com", {
      codeHash: "hash",
      issuedAt: Date.now(),
      attempts: 0,
    });
    await store.clearChallenge("reader@example.com");
    expect(await store.readChallenge("reader@example.com")).toBeUndefined();
  });

  it("opens a session that expires, and refuses it once it has", async () => {
    let now = 1_000;
    const store = createMemoryAccountStore({
      sessionTtlMs: 1_000,
      now: () => now,
    });
    const account = await store.create("reader@example.com");
    const session = await store.openSession(account.id);
    expect(session.expiresAt).toBe(2_000);
    expect(await store.readSession(session.token)).toEqual(session);
    now = 2_000;
    expect(await store.readSession(session.token)).toBeUndefined();
  });

  it("ends a session on request", async () => {
    const store = createMemoryAccountStore();
    const account = await store.create("reader@example.com");
    const session = await store.openSession(account.id);
    await store.endSession(session.token);
    expect(await store.readSession(session.token)).toBeUndefined();
  });

  it("issues tokens and ids that are not guessable from each other", async () => {
    const store = createMemoryAccountStore();
    const first = await store.openSession("account-1");
    const second = await store.openSession("account-1");
    expect(first.token).not.toBe(second.token);
    expect(first.token.length).toBeGreaterThan(20);
  });

  it("remembers a usage ledger per account", async () => {
    const store = createMemoryAccountStore();
    expect(await store.readUsage("account-1")).toBeUndefined();
    await store.writeUsage("account-1", {
      spentUnits: 12,
      windowStartedAt: 1_000,
    });
    expect(await store.readUsage("account-1")).toEqual({
      spentUnits: 12,
      windowStartedAt: 1_000,
    });
    expect(await store.readUsage("account-2")).toBeUndefined();
  });

  it("caps how many accounts one process holds, oldest first", async () => {
    const store = createMemoryAccountStore({ maxAccounts: 2 });
    const first = await store.create("one@example.com");
    await store.create("two@example.com");
    await store.create("three@example.com");
    expect(await store.findById(first.id)).toBeUndefined();
    expect(await store.findByEmail("three@example.com")).toBeDefined();
  });
});

describe("createSecureTokens", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_HASH_PEPPER", "test-pepper");
  });

  it("produces a numeric code of the configured length", () => {
    vi.stubEnv("SIGN_IN_CODE_LENGTH", "8");
    const code = createSecureTokens().randomCode();
    expect(code).toMatch(/^\d{8}$/);
  });

  it("defaults to a six-digit code without any configuration", () => {
    expect(createSecureTokens().randomCode()).toMatch(/^\d{6}$/);
  });

  it("does not repeat itself", () => {
    const tokens = createSecureTokens();
    const drawn = new Set(
      Array.from({ length: 20 }, () => tokens.randomToken()),
    );
    expect(drawn.size).toBe(20);
  });

  it("hashes deterministically, and never returns the value it was given", () => {
    const tokens = createSecureTokens();
    const hash = tokens.hash("111111");
    expect(hash).toBe(tokens.hash("111111"));
    expect(hash).not.toContain("111111");
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("peppers the hash, so a stolen table is not a set of codes", () => {
    const first = createSecureTokens().hash("111111");
    vi.stubEnv("AUTH_HASH_PEPPER", "another-pepper");
    expect(createSecureTokens().hash("111111")).not.toBe(first);
  });
});

describe("createEmailNotifier", () => {
  it("writes the code to the server log in local mode so the flow can be completed", async () => {
    vi.stubEnv("EMAIL_MODE", "log");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    await createEmailNotifier().sendSignInCode("reader@example.com", "123456");
    const line = log.mock.calls.map((call) => call.join(" ")).join("\n");
    expect(line).toContain("local sign-in code");
    expect(line).toContain("reader@example.com");
    expect(line).toContain("123456");
  });

  it("falls back to the log notifier when the mode is unset or unknown", async () => {
    vi.stubEnv("EMAIL_MODE", "");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await createEmailNotifier().sendSignInCode("reader@example.com", "123456");
    expect(fetchMock).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join(" ")).toContain("local sign-in code");
  });

  it("sends a signed SES request in ses mode, without logging the code", async () => {
    vi.stubEnv("EMAIL_MODE", "ses");
    vi.stubEnv("SES_REGION", "ca-central-1");
    vi.stubEnv("SES_FROM_ADDRESS", "Ursly <hello@ursly.io>");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIAFAKEFAKEFAKEFAKE");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "fake-secret-for-a-signing-test");
    const log = vi.spyOn(console, "info").mockImplementation(() => {});
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await createEmailNotifier().sendSignInCode("reader@example.com", "123456");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "https://email.ca-central-1.amazonaws.com/v2/email/outbound-emails",
    );
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIAFAKEFAKEFAKEFAKE\/\d{8}\/ca-central-1\/ses\/aws4_request, SignedHeaders=[a-z0-9;-]+, Signature=[0-9a-f]{64}$/,
    );
    expect(String(init.body)).toContain("123456");
    expect(log.mock.calls.flat().join(" ")).not.toContain("123456");
  });

  it("reports a rejected SES call instead of pretending the mail was sent", async () => {
    vi.stubEnv("EMAIL_MODE", "ses");
    vi.stubEnv("SES_FROM_ADDRESS", "hello@ursly.io");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIAFAKEFAKEFAKEFAKE");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "fake-secret-for-a-signing-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("denied", { status: 403 })),
    );
    await expect(
      createEmailNotifier().sendSignInCode("reader@example.com", "123456"),
    ).rejects.toThrow(/sign-in email/i);
  });

  it("refuses to start in ses mode without a sender", async () => {
    vi.stubEnv("EMAIL_MODE", "ses");
    vi.stubEnv("SES_FROM_ADDRESS", "");
    vi.stubEnv("AWS_ACCESS_KEY_ID", "AKIAFAKEFAKEFAKEFAKE");
    vi.stubEnv("AWS_SECRET_ACCESS_KEY", "fake-secret-for-a-signing-test");
    await expect(
      createEmailNotifier().sendSignInCode("reader@example.com", "123456"),
    ).rejects.toThrow(/SES_FROM_ADDRESS/);
  });
});
