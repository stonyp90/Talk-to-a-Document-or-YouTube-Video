import { afterEach, expect, it, vi } from "vitest";
vi.mock("./openai", () => ({
  createRealtimeCallAnswer: vi.fn().mockResolvedValue("answer-sdp"),
}));
import { createRealtimeCallAnswer } from "./openai";
import { POST } from "../../app/api/realtime/connect/route";
afterEach(() => vi.clearAllMocks());
const source = {
  kind: "pdf",
  sourceName: "file.pdf",
  text: "evidence",
  characters: 8,
};
it.each([
  { sdp: 42, source },
  { sdp: "offer", source: { ...source, kind: "unknown" } },
  { sdp: "offer", source: { ...source, text: "x".repeat(60001) } },
])(
  "rejects malformed SDP/context before contacting provider",
  async (payload) => {
    const response = await POST(
      new Request("http://localhost/api/realtime/connect", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    );
    expect(response.status).toBe(400);
    expect(createRealtimeCallAnswer).not.toHaveBeenCalled();
  },
);
it("returns only uncached SDP after validation", async () => {
  const response = await POST(
    new Request("http://localhost/api/realtime/connect", {
      method: "POST",
      body: JSON.stringify({ sdp: "offer", source }),
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("no-store");
  expect(await response.text()).toBe("answer-sdp");
});
