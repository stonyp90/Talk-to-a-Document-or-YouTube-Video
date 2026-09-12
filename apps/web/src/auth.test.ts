import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clock = vi.hoisted(() => {
  let now = 1_000;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
    reset: () => {
      now = 1_000;
    },
  };
});

/**
 * The gate is exercised against the real account stack — the real use cases
 * over the real in-memory store — with only the clock and the budget replaced.
 * A gate tested against a stubbed "yes" proves nothing about expiry or spend.
 */
const stack = vi.hoisted(() => ({}) as Record<string, never>);

vi.mock("@/apps/web/src/composition", async () => {
  const { createAccounts } = await import(
    "@/packages/core/src/application/accounts"
  );
  const { createMemoryAccountStore } = await import(
    "@/packages/adapters/src/accounts"
  );
  const store = createMemoryAccountStore({
    sessionTtlMs: 1_000,
    now: clock.now,
  });
  const accounts = createAccounts({
    store,
    notifier: { sendSignInCode: async () => {} },
    tokens: {
      randomCode: () => "111111",
      randomToken: () => "unused",
      hash: (value: string) => `hashed:${value}`,
    },
    policy: {
      codeTtlMs: 600_000,
      maxCodeAttempts: 5,
      limitUnits: 10,
      windowMs: 60_000,
    },
    now: clock.now,
  });
  Object.assign(stack, { store, accounts });
  return {
    authenticateAccount: (token: string) => accounts.authenticate(token),
    chargeAccount: (id: string, units: number) => accounts.charge(id, units),
    accountSessionTtlMs: () => 1_000,
  };
});

import {
  LOCAL_ACCOUNT_ID,
  authMode,
  clearedSessionCookie,
  guard,
  requireAccount,
  sessionCookie,
  sessionCookieName,
  unitsFor,
} from "./auth";

type Store = {
  create(email: string): Promise<{ id: string; email: string }>;
  openSession(id: string): Promise<{ token: string }>;
};

const store = () => stack.store as unknown as Store;

const request = (cookie?: string, url = "https://ursly.io/api/text-chat") =>
  new Request(url, {
    method: "POST",
    headers: cookie ? { cookie } : {},
  });

/** What the mobile app sends: no cookie at all, the session in a header. */
const bearerRequest = (authorization: string) =>
  new Request("https://ursly.io/api/text-chat", {
    method: "POST",
    headers: { authorization },
  });

async function signedInRequest() {
  const account = await store().create(`reader-${Math.random()}@example.com`);
  const session = await store().openSession(account.id);
  return {
    account,
    request: request(`${sessionCookieName()}=${session.token}`),
    token: session.token,
  };
}

beforeEach(() => {
  clock.reset();
  vi.stubEnv("AUTH_MODE", "required");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("authMode", () => {
  it("is required when nothing is configured, so a fresh deployment is closed", () => {
    vi.stubEnv("AUTH_MODE", "");
    expect(authMode()).toBe("required");
  });

  it("is required for a value nobody meant, so a typo cannot open the gate", () => {
    for (const value of ["disable", "off", "false", "REQUIRED", "yes please"]) {
      vi.stubEnv("AUTH_MODE", value);
      expect(authMode()).toBe("required");
    }
  });

  it("is disabled only for the exact word", () => {
    vi.stubEnv("AUTH_MODE", "disabled");
    expect(authMode()).toBe("disabled");
  });
});

describe("requireAccount", () => {
  it("refuses a request with no cookie", async () => {
    const refusal = (await requireAccount(request())) as Response;
    expect(refusal.status).toBe(401);
    expect(await refusal.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("refuses a forged token", async () => {
    const refusal = (await requireAccount(
      request(`${sessionCookieName()}=not-a-real-token`),
    )) as Response;
    expect(refusal.status).toBe(401);
  });

  it("refuses a session that has expired", async () => {
    const signedIn = await signedInRequest();
    clock.advance(1_000);
    const refusal = (await requireAccount(signedIn.request)) as Response;
    expect(refusal.status).toBe(401);
  });

  it("lets a live session through as its account", async () => {
    const signedIn = await signedInRequest();
    await expect(requireAccount(signedIn.request)).resolves.toMatchObject({
      id: signedIn.account.id,
      email: signedIn.account.email,
    });
  });

  it("ignores an unrelated cookie of the same shape", async () => {
    const signedIn = await signedInRequest();
    const mixed = request(
      `other=abc; ${sessionCookieName()}=${signedIn.token}; another=def`,
    );
    await expect(requireAccount(mixed)).resolves.toMatchObject({
      email: signedIn.account.email,
    });
  });

  // The mobile app has no cookie jar. Without the header it cannot sign in at
  // all, and an unauthenticated native client is the hole the gate closes.
  it("lets a bearer token through, for a client that has no cookies", async () => {
    const signedIn = await signedInRequest();
    await expect(
      requireAccount(bearerRequest(`Bearer ${signedIn.token}`)),
    ).resolves.toMatchObject({ email: signedIn.account.email });
  });

  it("refuses a forged bearer token exactly as it refuses a forged cookie", async () => {
    const refusal = (await requireAccount(
      bearerRequest("Bearer not-a-real-token"),
    )) as Response;
    expect(refusal.status).toBe(401);
  });

  it("refuses a header that is not a single bearer token", async () => {
    const signedIn = await signedInRequest();
    for (const header of [
      signedIn.token,
      `Basic ${signedIn.token}`,
      "Bearer",
      "Bearer ",
      `Bearer${signedIn.token}`,
      `Bearer ${signedIn.token} extra`,
      `Bearer ${signedIn.token}, Bearer ${signedIn.token}`,
    ]) {
      const refusal = (await requireAccount(bearerRequest(header))) as Response;
      expect(refusal.status).toBe(401);
    }
  });

  it("reads a bearer header whatever case the scheme is written in", async () => {
    const signedIn = await signedInRequest();
    for (const scheme of ["Bearer", "bearer", "BEARER"]) {
      await expect(
        requireAccount(bearerRequest(`${scheme} ${signedIn.token}`)),
      ).resolves.toMatchObject({ email: signedIn.account.email });
    }
  });

  // A header is set by anything that can make a request; the HttpOnly cookie is
  // not. The one the browser holds must therefore be the one that decides.
  it("lets the cookie win when a header disagrees with it", async () => {
    const signedIn = await signedInRequest();
    const other = await signedInRequest();
    const both = new Request("https://ursly.io/api/text-chat", {
      method: "POST",
      headers: {
        cookie: `${sessionCookieName()}=${signedIn.token}`,
        authorization: `Bearer ${other.token}`,
      },
    });
    await expect(requireAccount(both)).resolves.toMatchObject({
      email: signedIn.account.email,
    });
  });

  it("does not fall back to a header when the cookie is present and dead", async () => {
    const live = await signedInRequest();
    const both = new Request("https://ursly.io/api/text-chat", {
      method: "POST",
      headers: {
        cookie: `${sessionCookieName()}=not-a-real-token`,
        authorization: `Bearer ${live.token}`,
      },
    });
    expect(((await requireAccount(both)) as Response).status).toBe(401);
  });
});

describe("guard", () => {
  it("charges the account and lets the request through", async () => {
    const signedIn = await signedInRequest();
    await expect(guard(signedIn.request, { units: 4 })).resolves.toMatchObject({
      id: signedIn.account.id,
    });
  });

  it("refuses an anonymous caller before any charge is attempted", async () => {
    const refusal = (await guard(request(), { units: 1 })) as Response;
    expect(refusal.status).toBe(401);
    expect(await refusal.json()).toMatchObject({ code: "UNAUTHENTICATED" });
  });

  it("refuses the call that would cross the cap, and says when to return", async () => {
    const signedIn = await signedInRequest();
    await guard(signedIn.request, { units: 10 });
    const refusal = (await guard(signedIn.request, { units: 1 })) as Response;
    expect(refusal.status).toBe(429);
    expect(refusal.headers.get("Retry-After")).toBe("60");
    expect(await refusal.json()).toMatchObject({ code: "USAGE_LIMIT" });
  });

  it("opens the allowance again once the window has elapsed", async () => {
    const signedIn = await signedInRequest();
    await guard(signedIn.request, { units: 10 });
    clock.advance(60_000);
    // The session outlives nothing here: refresh it before the new window.
    const next = await signedInRequest();
    await expect(guard(next.request, { units: 10 })).resolves.toMatchObject({
      id: next.account.id,
    });
  });

  it("resolves to a fixed local account when authentication is disabled", async () => {
    vi.stubEnv("AUTH_MODE", "disabled");
    await expect(guard(request(), { units: 999 })).resolves.toMatchObject({
      id: LOCAL_ACCOUNT_ID,
    });
    await expect(requireAccount(request())).resolves.toMatchObject({
      id: LOCAL_ACCOUNT_ID,
    });
  });
});

describe("the session cookie", () => {
  it("is HttpOnly, same-site and scoped to the whole site", () => {
    const cookie = sessionCookie(
      "a-token",
      request(undefined, "https://ursly.io/api/auth/confirm"),
    );
    expect(cookie).toContain(`${sessionCookieName()}=a-token`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("Max-Age=1");
  });

  it("drops Secure only for plain-HTTP localhost, where there is no HTTPS to have", () => {
    expect(
      sessionCookie(
        "a-token",
        request(undefined, "http://localhost:3000/api/auth/confirm"),
      ),
    ).not.toContain("Secure");
    expect(
      sessionCookie(
        "a-token",
        request(undefined, "http://ursly.io/api/auth/confirm"),
      ),
    ).toContain("Secure");
  });

  it("honours a proxy that terminated TLS in front of the app", () => {
    const proxied = new Request("http://localhost:3000/api/auth/confirm", {
      headers: { "x-forwarded-proto": "https" },
    });
    expect(sessionCookie("a-token", proxied)).toContain("Secure");
  });

  it("clears itself by expiring immediately", () => {
    const cleared = clearedSessionCookie(request());
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("HttpOnly");
  });

  it("takes its name from configuration, with a default", () => {
    expect(sessionCookieName()).toBe("ursly_session");
    vi.stubEnv("AUTH_COOKIE_NAME", "ursly_demo");
    expect(sessionCookieName()).toBe("ursly_demo");
  });
});

describe("the unit cost table", () => {
  it("prices a spoken session above a typed question, and bookkeeping lowest", () => {
    expect(unitsFor("realtime")).toBeGreaterThan(unitsFor("textChat"));
    expect(unitsFor("ingest")).toBeGreaterThan(unitsFor("textChat"));
    expect(unitsFor("textChat")).toBeGreaterThan(unitsFor("turns"));
  });

  it("reads every price from configuration", () => {
    vi.stubEnv("USAGE_UNITS_REALTIME", "77");
    expect(unitsFor("realtime")).toBe(77);
  });

  it("keeps its named default when the configured value is not a cost", () => {
    const fallback = unitsFor("realtime");
    for (const value of ["", "free", "0", "-3"]) {
      vi.stubEnv("USAGE_UNITS_REALTIME", value);
      expect(unitsFor("realtime")).toBe(fallback);
    }
  });
});
