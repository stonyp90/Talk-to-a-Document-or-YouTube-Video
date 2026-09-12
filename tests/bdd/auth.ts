import assert from "node:assert/strict";
import { After } from "@cucumber/cucumber";
import type { IngestedSource } from "../../packages/core/src/domain/ingestion";
import type { Step, World } from "./steps";
import { POST as postRequestCode } from "../../apps/web/app/api/auth/request-code/route";
import { POST as postConfirm } from "../../apps/web/app/api/auth/confirm/route";
import { POST as postTextChat } from "../../apps/web/app/api/text-chat/route";

/**
 * The gate, exercised in process against the real route handlers. There is no
 * mailbox on a build machine, so the local notifier's server-log line plays the
 * part of the reader's inbox — which is exactly how a developer completes the
 * flow locally, and the only place the code is ever readable.
 */
type State = {
  status?: number;
  body?: Record<string, unknown>;
  text?: string;
  retryAfter?: string | null;
  cookie?: string;
  email?: string;
  code?: string;
  mailbox: string[];
};

const states = new WeakMap<World, State>();
const state = (world: World): State => {
  let current = states.get(world);
  if (!current) {
    current = { mailbox: [] };
    states.set(world, current);
  }
  return current;
};

const SOURCE: IngestedSource = {
  kind: "pdf",
  sourceName: "policy.pdf",
  text: "Uploads are limited to 25 MB.",
  characters: 29,
};

const post = (
  handler: (request: Request) => Promise<Response>,
  path: string,
  body: unknown,
  cookie?: string,
) =>
  handler(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );

/** Captures the local notifier's output for the length of one call. */
async function withMailbox<T>(
  world: World,
  action: () => Promise<T>,
): Promise<T> {
  const original = console.info;
  console.info = (...args: unknown[]) => {
    state(world).mailbox.push(args.map(String).join(" "));
  };
  try {
    return await action();
  } finally {
    console.info = original;
  }
}

function gateIsRequired(): void {
  process.env.AUTH_MODE = "required";
  // The limiter is a separate defence with its own scenarios; these are about
  // the gate, and they sign in more often than a real reader would.
  process.env.RATE_LIMIT_DISABLED = "true";
}

async function requestCode(world: World): Promise<void> {
  const current = state(world);
  current.email = `reader-${Date.now()}@example.com`;
  const response = await withMailbox(world, () =>
    post(postRequestCode, "/api/auth/request-code", { email: current.email }),
  );
  current.status = response.status;
  current.text = await response.text();
  current.code = current.mailbox.join("\n").match(/code for \S+: (\d+)/)?.[1];
}

async function signIn(world: World): Promise<void> {
  gateIsRequired();
  await requestCode(world);
  const current = state(world);
  assert.ok(current.code, "The notifier must have delivered a code");
  const response = await post(postConfirm, "/api/auth/confirm", {
    email: current.email,
    code: current.code,
  });
  assert.equal(response.status, 200);
  current.cookie = response.headers.get("set-cookie")!.split(";")[0];
}

async function ask(world: World, cookie?: string): Promise<void> {
  const response = await post(
    postTextChat,
    "/api/text-chat",
    { source: SOURCE, question: "What is the upload limit?" },
    cookie,
  );
  const current = state(world);
  current.status = response.status;
  current.retryAfter = response.headers.get("Retry-After");
  current.body = (await response.json()) as Record<string, unknown>;
}

export function registerAuthChecks(step: Step) {
  const restore = { ...process.env };

  step("the sign-in gate is required", function () {
    gateIsRequired();
  });

  step("a reader has signed in with a mailed code", async function () {
    await signIn(this);
  });

  step("the reader has spent their whole allowance", function () {
    // Priced above the whole allowance, so the next question is the one that
    // crosses it. The alternative is asking the same question sixty times.
    process.env.USAGE_UNITS_TEXT_CHAT = String(
      (Number(process.env.USAGE_LIMIT_UNITS) || 300) + 1,
    );
  });

  step("an anonymous client asks a question about a source", async function () {
    gateIsRequired();
    await ask(this);
  });

  step("the reader asks a question about a source", async function () {
    await ask(this, state(this).cookie);
  });

  step("a client asks for a sign-in code", async function () {
    await requestCode(this);
  });

  step("the request is refused as unauthenticated", function () {
    assert.equal(state(this).status, 401);
    assert.equal(state(this).body?.code, "UNAUTHENTICATED");
  });

  step("no answer is produced", function () {
    assert.equal(state(this).body?.answer, undefined);
  });

  step("the answer is grounded in the source", function () {
    assert.equal(state(this).status, 200);
    assert.match(String(state(this).body?.answer), /25 MB/);
  });

  step("the request is refused with a clear usage-limit message", function () {
    assert.equal(state(this).status, 429);
    assert.equal(state(this).body?.code, "USAGE_LIMIT");
    assert.match(String(state(this).body?.error), /limit/i);
    assert.equal(state(this).body?.answer, undefined);
  });

  step("the reply says when the allowance reopens", function () {
    const retryAfter = Number(state(this).retryAfter);
    assert.ok(retryAfter > 0, "Retry-After must say how long to wait");
  });

  step("the reply carries no body at all", function () {
    assert.equal(state(this).status, 204);
    assert.equal(state(this).text, "");
  });

  step("the code reaches the reader only through the notifier", function () {
    const current = state(this);
    assert.ok(current.code, "The notifier must have delivered a code");
    assert.ok(
      !current.text?.includes(current.code!),
      "The response body must never carry the code",
    );
  });

  After(function (this: World) {
    // Scenarios here move configuration on purpose; the next feature must not
    // inherit it.
    for (const key of [
      "AUTH_MODE",
      "RATE_LIMIT_DISABLED",
      "USAGE_UNITS_TEXT_CHAT",
    ]) {
      if (restore[key] === undefined) delete process.env[key];
      else process.env[key] = restore[key];
    }
  });
}
