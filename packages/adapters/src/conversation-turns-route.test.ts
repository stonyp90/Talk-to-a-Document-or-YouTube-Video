import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SessionExpiredError } from "../../core/src/application/sessions";

vi.mock("../../../apps/web/src/composition", () => ({
  resolveSession: vi.fn(),
  recordTurns: vi.fn().mockResolvedValue(undefined),
}));
import { recordTurns, resolveSession } from "../../../apps/web/src/composition";
import { POST } from "../../../apps/web/app/api/conversation/turns/route";

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

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/conversation/turns", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );

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

it("appends a spoken exchange to the thread a typed question reads", async () => {
  const turns = [
    { role: "user" as const, text: "What is the limit?" },
    { role: "assistant" as const, text: "25 MB." },
  ];
  const response = await post({ sourceId, turns });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ sourceId });
  expect(recordTurns).toHaveBeenCalledWith(sourceId, turns);
});

it("refuses a batch larger than one exchange window", async () => {
  const response = await post({
    sourceId,
    turns: Array.from({ length: 21 }, () => ({
      role: "user" as const,
      text: "Again?",
    })),
  });
  expect(response.status).toBe(400);
  expect(await response.json()).toMatchObject({ code: "INVALID_TURNS" });
  expect(recordTurns).not.toHaveBeenCalled();
});

it("refuses an empty turn and an unknown role", async () => {
  expect(
    (await post({ sourceId, turns: [{ role: "user", text: " " }] })).status,
  ).toBe(400);
  expect(
    (await post({ sourceId, turns: [{ role: "system", text: "Hi" }] })).status,
  ).toBe(400);
});

it("reports a forgotten session so the client can resend the source", async () => {
  vi.mocked(resolveSession).mockRejectedValue(new SessionExpiredError());
  const response = await post({
    sourceId,
    turns: [{ role: "user" as const, text: "Still there?" }],
  });
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "SOURCE_EXPIRED" });
  expect(recordTurns).not.toHaveBeenCalled();
});
