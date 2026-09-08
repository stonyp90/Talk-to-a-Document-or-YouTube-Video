import { afterEach, expect, it, vi } from "vitest";
import { answerTextQuestion, createRealtimeSession } from "./openai";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("extracts text from the Responses HTTP output content array", async () => {
  vi.stubEnv("PROVIDER_MODE", "live");
  vi.stubEnv("OPENAI_API_KEY", "test-server-key");
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({
          output: [
            {
              type: "message",
              content: [{ type: "output_text", text: "The answer is 42." }],
            },
          ],
        }),
      ),
  );
  expect(
    await answerTextQuestion(
      { kind: "pdf", sourceName: "test.pdf", text: "42", characters: 2 },
      "Answer?",
    ),
  ).toBe("The answer is 42.");
});

it("bounds provider requests and returns only an ephemeral credential", async () => {
  vi.stubEnv("PROVIDER_MODE", "live");
  vi.stubEnv("OPENAI_API_KEY", "server-only-canary-secret");
  const fetchMock = vi
    .fn()
    .mockResolvedValue(
      Response.json({
        value: "ephemeral-test",
        expires_at: Math.floor(Date.now() / 1000) + 60,
      }),
    );
  vi.stubGlobal("fetch", fetchMock);
  const session = await createRealtimeSession({
    kind: "pdf",
    sourceName: "test.pdf",
    text: "42",
    characters: 2,
  });
  expect(JSON.stringify(session)).not.toContain("server-only-canary-secret");
  expect(session.clientSecret).toBe("ephemeral-test");
  const options = fetchMock.mock.calls[0][1];
  expect(options.signal).toBeInstanceOf(AbortSignal);
  expect(options.headers.Authorization).toBe(
    "Bearer server-only-canary-secret",
  );
  expect(JSON.parse(options.body).session.instructions).toContain("42");
});
