import { afterEach, expect, it, vi } from "vitest";
import { createCommandSpeechSession } from "./commandSpeech";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("issues only a short-lived transcription credential with no source or tools", async () => {
  const expires = Math.floor(Date.now() / 1000) + 60;
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ value: "ephemeral-test", expires_at: expires }),
    );
  vi.stubGlobal("fetch", fetcher);
  const result = await createCommandSpeechSession(
    { getKey: async () => "server-test-key" },
    "fr",
  );
  expect(result).toEqual({
    clientSecret: "ephemeral-test",
    expiresAt: expires * 1000,
  });
  const init = fetcher.mock.calls[0][1];
  expect(init.headers.Authorization).toBe("Bearer server-test-key");
  const body = JSON.parse(init.body);
  expect(body).toMatchObject({
    expires_after: { seconds: 60 },
    session: {
      type: "transcription",
      audio: { input: { transcription: { language: "fr" } } },
    },
  });
  expect(body.session.tools).toBeUndefined();
  expect(body.session.audio.output).toBeUndefined();
  expect(JSON.stringify(result)).not.toContain("server-test-key");
});
it("rejects expired or failed credentials without echoing provider bodies", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ value: "expired", expires_at: 1 }))
    .mockResolvedValueOnce(
      Response.json({ error: "private upstream detail" }, { status: 403 }),
    );
  vi.stubGlobal("fetch", fetcher);
  await expect(
    createCommandSpeechSession({ getKey: async () => "key" }, "en"),
  ).rejects.toThrow(/valid temporary/);
  await expect(
    createCommandSpeechSession({ getKey: async () => "key" }, "en"),
  ).rejects.toThrow("Speech session unavailable (403).");
});
