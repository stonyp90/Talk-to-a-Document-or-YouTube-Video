import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createTranscriptProvider,
  TranscriptUnavailableError,
} from "./providers";

import { ingestYouTubeUrl } from "../../../apps/web/src/composition";

describe("transcript provider boundary", () => {
  it("requires explicit mock mode instead of silently returning fixtures", () => {
    vi.stubEnv("YOUTUBE_TRANSCRIPT_MODE", undefined);
    vi.stubEnv("TRANSCRIPT_SERVICE_URL", "");
    expect(() => createTranscriptProvider()).toThrow("not configured");
  });

  it("aborts a stalled HTTP request at the configured deadline", async () => {
    vi.stubEnv("YOUTUBE_TRANSCRIPT_MODE", "live");
    vi.stubEnv("TRANSCRIPT_SERVICE_URL", "http://transcript:3010");
    vi.stubEnv("TRANSCRIPT_TIMEOUT_MS", "10");
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url, options: RequestInit) =>
          new Promise((_resolve, reject) => {
            options.signal!.addEventListener(
              "abort",
              () => reject(options.signal!.reason),
              { once: true },
            );
          }),
      ),
    );
    await expect(
      ingestYouTubeUrl("https://youtu.be/dQw4w9WgXcQ"),
    ).rejects.toMatchObject({ reason: "TRANSCRIPT_TIMEOUT" });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  it("provides deterministic transcripts in mock mode", async () => {
    vi.stubEnv("YOUTUBE_TRANSCRIPT_MODE", "mock");
    const result = await ingestYouTubeUrl(
      "https://youtu.be/dQw4w9WgXcQ",
      createTranscriptProvider(),
    );
    expect(result.text).toContain("deterministic local transcript");
  });

  it("models unavailable captions as a recoverable domain error", async () => {
    vi.stubEnv("YOUTUBE_TRANSCRIPT_MODE", "mock");
    await expect(
      ingestYouTubeUrl(
        "https://youtu.be/missing0000",
        createTranscriptProvider(),
      ),
    ).rejects.toBeInstanceOf(TranscriptUnavailableError);
  });

  it("retrieves and normalizes real service captions", async () => {
    vi.stubEnv("YOUTUBE_TRANSCRIPT_MODE", "live");
    vi.stubEnv("TRANSCRIPT_SERVICE_URL", "http://transcript:3010/");
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        Response.json({ title: "Public video", text: "  Actual captions  " }),
      );
    vi.stubGlobal("fetch", fetcher);
    expect((await ingestYouTubeUrl("https://youtu.be/dQw4w9WgXcQ")).text).toBe(
      "Actual captions",
    );
    expect(fetcher).toHaveBeenCalledWith(
      "http://transcript:3010/transcript/dQw4w9WgXcQ",
      expect.objectContaining({
        signal: expect.any(AbortSignal),
        cache: "no-store",
      }),
    );
  });

  it.each([
    [404, "NO_CAPTIONS"],
    [403, "CLOUD_BLOCKED"],
    [504, "TRANSCRIPT_TIMEOUT"],
    [502, "UPSTREAM_ERROR"],
  ])("preserves service failure %s", async (status, reason) => {
    vi.stubEnv("YOUTUBE_TRANSCRIPT_MODE", "live");
    vi.stubEnv("TRANSCRIPT_SERVICE_URL", "http://transcript:3010");
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          Response.json({ error: { code: reason } }, { status }),
        ),
    );
    await expect(
      ingestYouTubeUrl("https://youtu.be/dQw4w9WgXcQ"),
    ).rejects.toMatchObject({ code: "TRANSCRIPT_UNAVAILABLE", reason });
  });

  it("classifies client deadline expiry", async () => {
    vi.stubEnv("YOUTUBE_TRANSCRIPT_MODE", "live");
    vi.stubEnv("TRANSCRIPT_SERVICE_URL", "http://transcript:3010");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("deadline", "TimeoutError")),
    );
    await expect(
      ingestYouTubeUrl("https://youtu.be/dQw4w9WgXcQ"),
    ).rejects.toMatchObject({ reason: "TRANSCRIPT_TIMEOUT" });
  });

  it.each([{ text: 42 }, { segments: [] }, null])(
    "rejects malformed success payload %s",
    async (payload) => {
      vi.stubEnv("YOUTUBE_TRANSCRIPT_MODE", "live");
      vi.stubEnv("TRANSCRIPT_SERVICE_URL", "http://transcript:3010");
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(payload)));
      await expect(
        ingestYouTubeUrl("https://youtu.be/dQw4w9WgXcQ"),
      ).rejects.toMatchObject({ reason: "UPSTREAM_ERROR" });
    },
  );
});
