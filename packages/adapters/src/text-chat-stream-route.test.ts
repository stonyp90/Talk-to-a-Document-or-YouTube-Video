import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionExpiredError } from "../../core/src/application/sessions";

vi.mock("../../../apps/web/src/composition", () => ({
  resolveSession: vi.fn(),
  recordTurns: vi.fn().mockResolvedValue(undefined),
  streamTextAnswer: vi.fn(),
}));
import {
  recordTurns,
  resolveSession,
  streamTextAnswer,
} from "../../../apps/web/src/composition";
import { POST } from "../../../apps/web/app/api/text-chat/stream/route";

const sourceId = "11111111-2222-4333-8444-555555555555";
const session = {
  id: sourceId,
  source: {
    kind: "pdf" as const,
    sourceName: "guide.pdf",
    text: "evidence",
    characters: 8,
  },
  turns: [],
  expiresAt: Date.now() + 60_000,
};

function ask(body: unknown, signal?: AbortSignal) {
  return POST(
    new Request("http://localhost/api/text-chat/stream", {
      method: "POST",
      body: JSON.stringify(body),
      signal,
    }),
  );
}

/** Reads the SSE body back into the JSON frames a client would see. */
async function frames(response: Response) {
  return (await response.text())
    .split("\n\n")
    .filter(Boolean)
    .map((frame) => JSON.parse(frame.replace(/^data: /, "")));
}

beforeEach(() => {
  vi.stubEnv("RATE_LIMIT_DISABLED", "true");
  // These cases are about the route, not the gate; the gate has its own suite.
  vi.stubEnv("AUTH_MODE", "disabled");
  vi.mocked(resolveSession).mockResolvedValue(session);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

it("writes the answer as it arrives and records the exchange once", async () => {
  vi.mocked(streamTextAnswer).mockReturnValue(
    (async function* () {
      yield "The answer ";
      yield "is 42.";
    })(),
  );
  const response = await ask({ sourceId, question: "Answer?" });
  expect(response.headers.get("content-type")).toBe("text/event-stream");
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(response.headers.get("x-accel-buffering")).toBe("no");
  expect(await frames(response)).toEqual([
    { type: "delta", text: "The answer " },
    { type: "delta", text: "is 42." },
    { type: "done", answer: "The answer is 42.", sourceId },
  ]);
  expect(recordTurns).toHaveBeenCalledWith(sourceId, [
    { role: "user", text: "Answer?" },
    { role: "assistant", text: "The answer is 42." },
  ]);
});

it("answers a rejected question in JSON so the client can fall back", async () => {
  const response = await ask({ sourceId, question: "" });
  expect(response.status).toBe(400);
  expect(response.headers.get("content-type")).toContain("application/json");
  expect(await response.json()).toMatchObject({ code: "INVALID_QUESTION" });
  expect(streamTextAnswer).not.toHaveBeenCalled();
});

it("reports an expired session before the event stream opens", async () => {
  vi.mocked(resolveSession).mockRejectedValue(new SessionExpiredError());
  const response = await ask({ sourceId, question: "Answer?" });
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "SOURCE_EXPIRED" });
});

it("turns a mid-stream failure into an error frame without provider detail", async () => {
  vi.mocked(streamTextAnswer).mockReturnValue(
    (async function* () {
      yield "Partial";
      throw new Error("upstream said gpt-4.1-mini is over quota");
    })(),
  );
  const written = await frames(await ask({ sourceId, question: "Answer?" }));
  expect(written[0]).toEqual({ type: "delta", text: "Partial" });
  expect(written[1]).toMatchObject({ type: "error", code: "INTERNAL_ERROR" });
  expect(JSON.stringify(written)).not.toContain("quota");
});

it("keeps what the reader already saw when the client disconnects", async () => {
  const aborter = new AbortController();
  vi.mocked(streamTextAnswer).mockReturnValue(
    (async function* () {
      yield "First half.";
      aborter.abort();
      yield "Second half.";
    })(),
  );
  const written = await frames(
    await ask({ sourceId, question: "Answer?" }, aborter.signal),
  );
  expect(written).toEqual([{ type: "delta", text: "First half." }]);
  expect(recordTurns).toHaveBeenCalledWith(sourceId, [
    { role: "user", text: "Answer?" },
    { role: "assistant", text: "First half." },
  ]);
});
