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
it("rejects oversized context regardless of the inbound adapter", async () => {
  const { app, provider } = fixture();
  await expect(
    app.createRealtimeSession({ ...source, text: "x".repeat(60001) }),
  ).rejects.toThrow("60,000");
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
  expect(provider.answerTextQuestion).toHaveBeenCalledWith(source, "Question?");
});
