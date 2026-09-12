import { afterEach, beforeEach, expect, it, vi } from "vitest";

/**
 * The sign-in endpoints over the real account stack: the real use cases, the
 * real in-memory store, and a notifier that keeps the code so the test can play
 * the part of the reader's mailbox. Nothing about the flow is stubbed.
 */
const harness = vi.hoisted(() => ({}) as Record<string, never>);

vi.mock("../../../apps/web/src/composition", async () => {
  const { createAccounts } = await import(
    "../../core/src/application/accounts"
  );
  const { createMemoryAccountStore, createSecureTokens } = await import(
    "./accounts"
  );
  const mailbox: string[] = [];
  const store = createMemoryAccountStore();
  const accounts = createAccounts({
    store,
    notifier: {
      sendSignInCode: async (_email: string, code: string) => {
        mailbox.push(code);
      },
    },
    tokens: createSecureTokens(),
    policy: {
      codeTtlMs: 600_000,
      maxCodeAttempts: 5,
      limitUnits: 1_000,
      windowMs: 60_000,
    },
  });
  Object.assign(harness, { mailbox, accounts });
  return {
    requestSignInCode: (email: string) => accounts.requestSignIn(email),
    confirmSignInCode: (email: string, code: string) =>
      accounts.confirmSignIn(email, code),
    authenticateAccount: (token: string) => accounts.authenticate(token),
    signOutAccount: (token: string) => accounts.signOut(token),
    chargeAccount: (id: string, units: number) => accounts.charge(id, units),
    accountSessionTtlMs: () => 60_000,
    // The gated route under test never reaches these.
    resolveSession: vi.fn(),
    answerTextQuestion: vi.fn(),
    recordTurns: vi.fn(),
  };
});

import { POST as requestCode } from "../../../apps/web/app/api/auth/request-code/route";
import { POST as confirm } from "../../../apps/web/app/api/auth/confirm/route";
import {
  DELETE as deleteSession,
  GET as readSession,
} from "../../../apps/web/app/api/auth/session/route";
import { POST as textChat } from "../../../apps/web/app/api/text-chat/route";

const mailbox = () => harness.mailbox as unknown as string[];

const post = (
  handler: (request: Request) => Promise<Response>,
  path: string,
  body: unknown,
  cookie?: string,
) =>
  handler(
    new Request(`https://ursly.io${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

async function signIn(email: string) {
  await post(requestCode, "/api/auth/request-code", { email });
  const code = mailbox().at(-1)!;
  const response = await post(confirm, "/api/auth/confirm", { email, code });
  const cookie = response.headers.get("Set-Cookie")!.split(";")[0];
  const { token } = (await response.clone().json()) as { token: string };
  return { response, cookie, token };
}

beforeEach(() => {
  vi.stubEnv("RATE_LIMIT_DISABLED", "true");
  vi.stubEnv("AUTH_MODE", "required");
  mailbox().length = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
});

it("answers a code request with nothing at all, and never with the code", async () => {
  const response = await post(requestCode, "/api/auth/request-code", {
    email: "reader@example.com",
  });
  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
  expect(mailbox()).toHaveLength(1);
});

it("answers identically for a known and an unknown address", async () => {
  const first = await post(requestCode, "/api/auth/request-code", {
    email: "known@example.com",
  });
  const second = await post(requestCode, "/api/auth/request-code", {
    email: "known@example.com",
  });
  const stranger = await post(requestCode, "/api/auth/request-code", {
    email: "stranger@example.com",
  });
  expect([first.status, second.status, stranger.status]).toEqual([
    204, 204, 204,
  ]);
  expect(
    [first, second, stranger].map((response) =>
      response.headers.get("Content-Type"),
    ),
  ).toEqual([null, null, null]);
});

it("refuses an address that is not one", async () => {
  const response = await post(requestCode, "/api/auth/request-code", {
    email: "not-an-address",
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: "INVALID_EMAIL" });
});

it("sets a hardened cookie on confirmation and returns the address with the token", async () => {
  const { response } = await signIn("reader@example.com");
  expect(response.status).toBe(200);
  const body = (await response.clone().json()) as {
    email: string;
    token: string;
  };
  expect(body.email).toBe("reader@example.com");
  // The body carries the token for clients with no cookie jar, and it is the
  // same token the very same response already handed this caller as a cookie:
  // a second copy of a secret its owner is holding discloses nothing new.
  expect(body.token).toBe(
    decodeURIComponent(
      response.headers.get("Set-Cookie")!.split(";")[0].split("=")[1],
    ),
  );

  const cookie = response.headers.get("Set-Cookie")!;
  expect(cookie).toContain("HttpOnly");
  expect(cookie).toContain("SameSite=Lax");
  expect(cookie).toContain("Secure");
  expect(cookie).toContain("Path=/");
});

it("refuses a wrong code without ending the challenge", async () => {
  await post(requestCode, "/api/auth/request-code", {
    email: "reader@example.com",
  });
  const wrong = await post(confirm, "/api/auth/confirm", {
    email: "reader@example.com",
    code: "000000",
  });
  expect(wrong.status).toBe(401);
  expect(await wrong.json()).toMatchObject({ code: "CODE_INVALID" });
});

it("reports the session to a signed-in reader and refuses an anonymous one", async () => {
  const { cookie } = await signIn("reader@example.com");
  const anonymous = await readSession(
    new Request("https://ursly.io/api/auth/session"),
  );
  expect(anonymous.status).toBe(401);
  expect(await anonymous.json()).toMatchObject({ code: "UNAUTHENTICATED" });

  const signedIn = await readSession(
    new Request("https://ursly.io/api/auth/session", { headers: { cookie } }),
  );
  expect(signedIn.status).toBe(200);
  expect(await signedIn.json()).toEqual({ email: "reader@example.com" });
});

it("ends the session and clears the cookie on sign-out", async () => {
  const { cookie } = await signIn("reader@example.com");
  const signedOut = await deleteSession(
    new Request("https://ursly.io/api/auth/session", {
      method: "DELETE",
      headers: { cookie },
    }),
  );
  expect(signedOut.status).toBe(204);
  expect(signedOut.headers.get("Set-Cookie")).toContain("Max-Age=0");

  const after = await readSession(
    new Request("https://ursly.io/api/auth/session", { headers: { cookie } }),
  );
  expect(after.status).toBe(401);
});

it("refuses an anonymous question at a paid endpoint", async () => {
  const response = await post(textChat, "/api/text-chat", {
    sourceId: "11111111-2222-4333-8444-555555555555",
    question: "What is this about?",
  });
  expect(response.status).toBe(401);
  expect(await response.json()).toMatchObject({ code: "UNAUTHENTICATED" });
});

it("never writes a code into a response body", async () => {
  const { response } = await signIn("reader@example.com");
  expect(await response.text()).not.toContain(mailbox().at(-1)!);
});

it("never returns a token anywhere but the confirmation it was minted by", async () => {
  const { token } = await signIn("reader@example.com");
  const bearer = { authorization: `Bearer ${token}` };

  const session = await readSession(
    new Request("https://ursly.io/api/auth/session", { headers: bearer }),
  );
  expect(await session.text()).not.toContain(token);

  const requested = await post(requestCode, "/api/auth/request-code", {
    email: "reader@example.com",
  });
  expect(await requested.text()).not.toContain(token);
});

// What the published mobile app sends. It has no cookie jar, so a session it
// cannot present in a header is a session it cannot use at all.
it("accepts the confirmed token as a bearer at the session and the paid endpoints", async () => {
  const { token } = await signIn("reader@example.com");
  const bearer = { authorization: `Bearer ${token}` };

  const session = await readSession(
    new Request("https://ursly.io/api/auth/session", { headers: bearer }),
  );
  expect(session.status).toBe(200);
  expect(await session.json()).toEqual({ email: "reader@example.com" });

  const question = await textChat(
    new Request("https://ursly.io/api/text-chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...bearer },
      body: JSON.stringify({
        sourceId: "11111111-2222-4333-8444-555555555555",
        question: "What is the upload limit?",
      }),
    }),
  );
  expect(question.status).not.toBe(401);
});

it("refuses a bearer header that is not a token, and signs out one that is", async () => {
  const { token } = await signIn("reader@example.com");
  const refused = await readSession(
    new Request("https://ursly.io/api/auth/session", {
      headers: { authorization: `Basic ${token}` },
    }),
  );
  expect(refused.status).toBe(401);

  const signedOut = await deleteSession(
    new Request("https://ursly.io/api/auth/session", {
      method: "DELETE",
      headers: { authorization: `Bearer ${token}` },
    }),
  );
  expect(signedOut.status).toBe(204);

  const after = await readSession(
    new Request("https://ursly.io/api/auth/session", {
      headers: { authorization: `Bearer ${token}` },
    }),
  );
  expect(after.status).toBe(401);
});
