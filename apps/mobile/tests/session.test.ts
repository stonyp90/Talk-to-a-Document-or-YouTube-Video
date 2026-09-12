import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ApiClient,
  isSignInRequired,
  isUsageLimit,
  memorySessionStore,
  type SessionStore,
} from "../src/client";

// A stand-in for the device's storage: the app supplies an AsyncStorage-backed
// one, and nothing in this file needs React Native to run.
function recordingStore(initial = "") {
  let token = initial;
  const writes: string[] = [];
  const store: SessionStore = {
    read: async () => token,
    write: async (value) => {
      token = value;
      writes.push(value);
    },
    clear: async () => {
      token = "";
      writes.push("");
    },
  };
  return { store, writes, held: () => token };
}

const headersOf = (init?: RequestInit) =>
  (init?.headers ?? {}) as Record<string, string>;
const signedInClient = (transport: typeof fetch, token = "session-token") =>
  new ApiClient("https://ursly.io", transport, recordingStore(token).store);
const source = {
  kind: "pdf" as const,
  sourceName: "test.pdf",
  text: "Context",
  characters: 7,
};

test("a held session travels as a bearer header on every call to our API", async () => {
  const seen: Record<string, string | undefined> = {};
  const api = signedInClient(async (url, init) => {
    seen[String(url)] = headersOf(init).Authorization;
    if (String(url).endsWith("/api/auth/session"))
      return Response.json({ email: "reader@example.com" });
    return Response.json({ answer: "Because." });
  });
  assert.deepEqual(await api.readSession(), { email: "reader@example.com" });
  await api.ask(source, "Why?");
  assert.equal(
    seen["https://ursly.io/api/auth/session"],
    "Bearer session-token",
  );
  assert.equal(seen["https://ursly.io/api/text-chat"], "Bearer session-token");
});

test("no header is sent when no session is held", async () => {
  let headers: Record<string, string> | undefined;
  const api = new ApiClient(
    "https://ursly.io",
    async (_url, init) => {
      headers = headersOf(init);
      return Response.json({ answer: "Because." });
    },
    memorySessionStore(),
  );
  await api.ask(source, "Why?");
  assert.equal(headers?.Authorization, undefined);
  assert.equal(api.signedIn, false);
});

test("the session is never attached to a presigned upload or to the provider", async () => {
  const pdf = {
    name: "test.pdf",
    size: 2500,
    uri: "file:///cache/test.pdf",
    mimeType: "application/pdf",
  };
  const signedUrl = "http://localhost:9002/demo-bucket";
  const api = signedInClient(async (url, init) => {
    if (String(url).endsWith("/health"))
      return Response.json({ directUpload: true });
    if (String(url).endsWith("/uploads"))
      return Response.json({
        url: signedUrl,
        fields: {},
        key: "uploads/1.pdf",
      });
    if (url === signedUrl) {
      assert.equal(
        init!.headers,
        undefined,
        "A presigned form must carry no headers of ours",
      );
      return new Response(null, { status: 204 });
    }
    return Response.json({ source });
  });
  await api.pdf(pdf);

  const negotiating = signedInClient(async (_url, init) => {
    assert.deepEqual(headersOf(init).Authorization, "Bearer ephemeral-test");
    return new Response("answer-sdp");
  });
  assert.equal(
    await negotiating.negotiate("offer-sdp", "ephemeral-test"),
    "answer-sdp",
  );
});

test("a code request and a confirmation hit the right paths with the right bodies", async () => {
  const calls: { url: string; method?: string; body: unknown }[] = [];
  const recorded = recordingStore();
  const api = new ApiClient(
    "https://ursly.io",
    async (url, init) => {
      calls.push({
        url: String(url),
        method: init?.method,
        body: JSON.parse(String(init?.body ?? "null")),
      });
      if (String(url).endsWith("/request-code"))
        return new Response(null, { status: 204 });
      return Response.json({
        email: "reader@example.com",
        token: "fresh-token",
      });
    },
    recorded.store,
  );

  await api.requestSignInCode("  Reader@example.com  ");
  assert.deepEqual(
    await api.confirmSignInCode("  Reader@example.com  ", " 123456 "),
    { email: "reader@example.com" },
  );

  assert.deepEqual(calls, [
    {
      url: "https://ursly.io/api/auth/request-code",
      method: "POST",
      body: { email: "Reader@example.com" },
    },
    {
      url: "https://ursly.io/api/auth/confirm",
      method: "POST",
      body: { email: "Reader@example.com", code: "123456" },
    },
  ]);
  assert.equal(recorded.held(), "fresh-token");
});

test("the confirmed token is stored and used on the next call", async () => {
  const recorded = recordingStore();
  let authorization: string | undefined;
  const api = new ApiClient(
    "https://ursly.io",
    async (url, init) => {
      authorization = headersOf(init).Authorization;
      if (String(url).endsWith("/confirm"))
        return Response.json({
          email: "reader@example.com",
          token: "fresh-token",
        });
      return Response.json({ answer: "Because." });
    },
    recorded.store,
  );
  await api.confirmSignInCode("reader@example.com", "123456");
  await api.ask(source, "Why?");
  assert.equal(authorization, "Bearer fresh-token");
  assert.equal(recorded.held(), "fresh-token");
});

test("a 401 from our API clears the stored token and is distinguishable", async () => {
  const recorded = recordingStore("stale-token");
  const api = new ApiClient(
    "https://ursly.io",
    async () =>
      Response.json(
        { error: "Sign in to continue.", code: "UNAUTHENTICATED" },
        { status: 401 },
      ),
    recorded.store,
  );

  await assert.rejects(
    () => api.ask(source, "Why?"),
    (error) => {
      assert.ok(
        isSignInRequired(error),
        "A 401 must be recognizable as a sign-in refusal",
      );
      assert.equal(isUsageLimit(error), false);
      return true;
    },
  );
  assert.equal(recorded.held(), "");
  assert.equal(api.signedIn, false);
});

test("a spent allowance is distinguishable from a lapsed session and keeps the token", async () => {
  const recorded = recordingStore("live-token");
  const api = new ApiClient(
    "https://ursly.io",
    async () =>
      Response.json(
        {
          error: "You have reached your usage limit for now.",
          code: "USAGE_LIMIT",
        },
        { status: 429 },
      ),
    recorded.store,
  );
  await assert.rejects(
    () => api.ask(source, "Why?"),
    (error) => {
      assert.ok(isUsageLimit(error));
      assert.equal(isSignInRequired(error), false);
      return true;
    },
  );
  assert.equal(recorded.held(), "live-token");
});

test("reading the session asks nothing of the network when no token is stored", async () => {
  const api = new ApiClient(
    "https://ursly.io",
    async () => assert.fail("No request expected without a session"),
    memorySessionStore(),
  );
  assert.equal(await api.readSession(), null);
});

test("a session the server no longer honours reads as signed out, not as an error", async () => {
  const recorded = recordingStore("stale-token");
  const api = new ApiClient(
    "https://ursly.io",
    async () =>
      Response.json(
        { error: "Sign in to continue.", code: "UNAUTHENTICATED" },
        { status: 401 },
      ),
    recorded.store,
  );
  assert.equal(await api.readSession(), null);
  assert.equal(recorded.held(), "");
});

test("signing out ends the session on the server and on the device", async () => {
  const calls: { url: string; method?: string; authorization?: string }[] = [];
  const recorded = recordingStore("live-token");
  const api = new ApiClient(
    "https://ursly.io",
    async (url, init) => {
      calls.push({
        url: String(url),
        method: init?.method,
        authorization: headersOf(init).Authorization,
      });
      return new Response(null, { status: 204 });
    },
    recorded.store,
  );
  await api.signOut();
  assert.deepEqual(calls, [
    {
      url: "https://ursly.io/api/auth/session",
      method: "DELETE",
      authorization: "Bearer live-token",
    },
  ]);
  assert.equal(recorded.held(), "");
});

test("signing out still clears the device when the network refuses", async () => {
  const recorded = recordingStore("live-token");
  const api = new ApiClient(
    "https://ursly.io",
    async () => Response.json({ error: "Offline" }, { status: 500 }),
    recorded.store,
  );
  await api.signOut();
  assert.equal(recorded.held(), "");
  assert.equal(api.signedIn, false);
});
