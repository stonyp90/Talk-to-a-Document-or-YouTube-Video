import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRealtimeSession, answerTextQuestion } from "./openai";

const source = {
  kind: "pdf" as const,
  sourceName: "guide.pdf",
  text: "The demo answer is forty-two.",
  characters: 30,
};

beforeEach(() => vi.stubEnv("PROVIDER_MODE", "mock"));
afterEach(() => vi.unstubAllEnvs());

describe("Realtime provider boundary", () => {
  it("returns a short-lived local session without exposing a server key", async () => {
    const session = await createRealtimeSession(source);
    expect(session.mode).toBe("mock");
    expect(session.clientSecret).toMatch(/^mock_/);
    expect(session.instructions).toContain(source.text);
  });

  it("supports text fallback in local mode", async () => {
    const answer = await answerTextQuestion(source, "What is the answer?");
    expect(answer).toContain("The demo answer is forty-two");
  });
});
