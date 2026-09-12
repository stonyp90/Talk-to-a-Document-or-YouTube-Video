import assert from "node:assert/strict";
import { After } from "@cucumber/cucumber";
import { MAX_VIDEO_QUERY_CHARACTERS } from "../../packages/core/src/application/videoSearch";
import { parseYouTubeVideoId } from "../../packages/core/src/domain/ingestion";
import { ingestYouTubeUrl } from "../../apps/web/src/composition";
import type { Step, World } from "./steps";
import { POST as postRequestCode } from "../../apps/web/app/api/auth/request-code/route";
import { POST as postConfirm } from "../../apps/web/app/api/auth/confirm/route";
import { POST as postVideoSearch } from "../../apps/web/app/api/videos/search/route";

/**
 * Finding a video from spoken words, exercised in process against the real
 * route handler. There is no YouTube quota on a build machine, so the search
 * runs in its fixture mode — the same mode a developer runs locally — and the
 * scenarios check the contract the spoken entry path depends on rather than
 * which videos a third party happens to rank first today.
 */
type Candidate = { videoId: string; title: string; url: string };

type State = {
  status?: number;
  body?: { results?: Candidate[]; code?: string; error?: string };
  cookie?: string;
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

const results = (world: World): Candidate[] => state(world).body?.results ?? [];

function searchIsGated(): void {
  process.env.AUTH_MODE = "required";
  // Fixtures, so a build machine needs no YouTube key, no quota and no network.
  process.env.YOUTUBE_SEARCH_MODE = "mock";
  process.env.YOUTUBE_TRANSCRIPT_MODE = "mock";
  // The limiter is a separate defence with its own scenarios; these are about
  // the search, and they search more often than a reader would.
  process.env.RATE_LIMIT_DISABLED = "true";
}

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

/** The local notifier writes the code to the server log; that is the only place it is readable. */
async function signIn(world: World): Promise<void> {
  searchIsGated();
  const current = state(world);
  const email = `listener-${Date.now()}@example.com`;
  const original = console.info;
  console.info = (...args: unknown[]) => {
    current.mailbox.push(args.map(String).join(" "));
  };
  try {
    await post(postRequestCode, "/api/auth/request-code", { email });
  } finally {
    console.info = original;
  }
  const code = current.mailbox.join("\n").match(/code for \S+: (\d+)/)?.[1];
  assert.ok(code, "The notifier must have delivered a code");
  const confirmed = await post(postConfirm, "/api/auth/confirm", {
    email,
    code,
  });
  assert.equal(confirmed.status, 200);
  current.cookie = confirmed.headers.get("set-cookie")!.split(";")[0];
}

async function search(
  world: World,
  query: string,
  cookie?: string,
): Promise<void> {
  const response = await post(
    postVideoSearch,
    "/api/videos/search",
    { query },
    cookie,
  );
  const current = state(world);
  current.status = response.status;
  current.body = (await response.json()) as State["body"];
}

export function registerVideoSearchChecks(step: Step) {
  const restore = { ...process.env };

  step("a reader has signed in and can search for videos", async function () {
    await signIn(this);
  });

  step("the video search is gated", function () {
    searchIsGated();
  });

  step("the reader says an artist instead of a link", async function () {
    await search(this, "Miles Davis Kind of Blue", state(this).cookie);
  });

  step("the reader searches with no words at all", async function () {
    await search(this, "   ", state(this).cookie);
  });

  step(
    "the reader searches with more words than the endpoint accepts",
    async function () {
      await search(
        this,
        "Miles Davis ".repeat(MAX_VIDEO_QUERY_CHARACTERS),
        state(this).cookie,
      );
    },
  );

  step("an anonymous client searches for a video", async function () {
    await search(this, "Miles Davis Kind of Blue");
  });

  step("captioned videos are found for those words", function () {
    assert.equal(state(this).status, 200);
    assert.ok(results(this).length > 0, "The search must find something");
  });

  step(
    "the first result is a video the reader can be sent to",
    async function () {
      const [best] = results(this);
      assert.ok(best, "There must be a first result");
      // Opened, not merely listed: the link has to survive the same parsing the
      // ingestion path applies, and the source behind it has to be readable.
      assert.equal(parseYouTubeVideoId(best.url), best.videoId);
      const source = await ingestYouTubeUrl(best.url);
      assert.ok(source.text.trim(), "The opened video must have a transcript");
    },
  );

  step("the remaining results stay available as alternatives", function () {
    const [best, ...rest] = results(this);
    assert.ok(rest.length > 0, "Alternatives must remain on offer");
    for (const alternative of rest)
      assert.notEqual(alternative.videoId, best.videoId);
  });

  step("the search is refused as an unusable query", function () {
    assert.equal(state(this).status, 400);
    assert.equal(state(this).body?.code, "INVALID_QUERY");
  });

  step("the search is refused as unauthenticated", function () {
    assert.equal(state(this).status, 401);
    assert.equal(state(this).body?.code, "UNAUTHENTICATED");
  });

  step("no videos are offered", function () {
    assert.equal(state(this).body?.results, undefined);
  });

  After(function (this: World) {
    // These scenarios move configuration on purpose; the next feature must not
    // inherit it.
    for (const key of [
      "AUTH_MODE",
      "YOUTUBE_SEARCH_MODE",
      "YOUTUBE_TRANSCRIPT_MODE",
      "RATE_LIMIT_DISABLED",
    ]) {
      if (restore[key] === undefined) delete process.env[key];
      else process.env[key] = restore[key];
    }
  });
}
