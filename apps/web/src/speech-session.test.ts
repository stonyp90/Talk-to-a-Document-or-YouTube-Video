import { afterEach, beforeEach, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({
  commandSpeechEnabled: vi.fn(),
  openCommandSpeech: vi.fn(),
  guard: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock("./composition", () => ({
  commandSpeechEnabled: boundary.commandSpeechEnabled,
  openCommandSpeech: boundary.openCommandSpeech,
}));
vi.mock("./auth", () => ({ guard: boundary.guard, unitsFor: () => 50 }));
vi.mock("./http", async (original) => ({
  ...(await original<typeof import("./http")>()),
  rateLimit: boundary.rateLimit,
}));
import { POST } from "../app/api/speech/session/route";
const request = (body: unknown = { language: "en" }) =>
  new Request("http://localhost/api/speech/session", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  vi.resetAllMocks();
  boundary.guard.mockResolvedValue({ id: "account" });
  boundary.commandSpeechEnabled.mockReturnValue(true);
});
afterEach(() => vi.unstubAllEnvs());
it("refuses unauthenticated or rate-limited requests before issuing a credential", async () => {
  boundary.guard.mockResolvedValue(new Response(null, { status: 401 }));
  expect((await POST(request())).status).toBe(401);
  boundary.rateLimit.mockReturnValue(new Response(null, { status: 429 }));
  expect((await POST(request())).status).toBe(429);
  expect(boundary.openCommandSpeech).not.toHaveBeenCalled();
});
it("rejects model overrides and disabled live recognition before provider work", async () => {
  expect(
    (await POST(request({ language: "en", model: "untrusted" }))).status,
  ).toBe(400);
  boundary.commandSpeechEnabled.mockReturnValue(false);
  expect((await POST(request())).status).toBe(503);
  expect(boundary.openCommandSpeech).not.toHaveBeenCalled();
});
it("returns a non-cacheable credential under the existing voice allowance", async () => {
  const credential = {
    clientSecret: "temporary-test",
    expiresAt: Date.now() + 60000,
  };
  boundary.openCommandSpeech.mockResolvedValue(credential);
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toContain("no-store");
  expect(await response.json()).toEqual(credential);
  expect(boundary.guard).toHaveBeenCalledWith(expect.any(Request), {
    units: 50,
  });
});
