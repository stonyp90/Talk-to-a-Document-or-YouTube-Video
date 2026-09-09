import { expect, it, vi } from "vitest";
import { createConversation } from "./conversation";

const source = {
  kind: "pdf" as const,
  sourceName: "source.pdf",
  text: "evidence",
  characters: 8,
};
function fixture() {
  const provider = {
    createRealtimeSession: vi.fn(),
    createRealtimeCallAnswer: vi.fn(),
    answerTextQuestion: vi.fn().mockResolvedValue("answer"),
  };
  return { provider, app: createConversation(provider) };
}
it("accepts a source larger than one model context and windows it", async () => {
  const { app, provider } = fixture();
  const long = { ...source, text: "x".repeat(600000) };
  await app.createRealtimeSession(long);
  expect(provider.createRealtimeSession).toHaveBeenCalledWith(long);
});
it("rejects an empty source regardless of the inbound adapter", async () => {
  const { app, provider } = fixture();
  await expect(
    app.createRealtimeSession({ ...source, text: "   " }),
  ).rejects.toThrow("Source text is required.");
  expect(provider.createRealtimeSession).not.toHaveBeenCalled();
});
it("validates questions and SDP before contacting a technology provider", async () => {
  const { app, provider } = fixture();
  await expect(app.answerTextQuestion(source, " ")).rejects.toThrow("question");
  await expect(app.createRealtimeCallAnswer("", source)).rejects.toThrow(
    "session description",
  );
  expect(provider.answerTextQuestion).not.toHaveBeenCalled();
  expect(provider.createRealtimeCallAnswer).not.toHaveBeenCalled();
});
it("can change the conversation provider without changing source models", async () => {
  const { app, provider } = fixture();
  expect(await app.answerTextQuestion(source, " Question? ")).toBe("answer");
  expect(provider.answerTextQuestion).toHaveBeenCalledWith(
    source,
    "Question?",
    undefined,
  );
});
it("carries recent exchanges so follow-up questions read naturally", async () => {
  const { app, provider } = fixture();
  const history = [
    { role: "user" as const, text: "What is the limit?" },
    { role: "assistant" as const, text: "25 MB." },
  ];
  await app.answerTextQuestion(source, "And for video?", history);
  expect(provider.answerTextQuestion).toHaveBeenCalledWith(
    source,
    "And for video?",
    history,
  );
});
