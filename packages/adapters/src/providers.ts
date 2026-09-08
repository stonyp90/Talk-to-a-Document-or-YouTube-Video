import type { TranscriptPort } from "../../core/src/application/ports";

import { TranscriptUnavailableError } from "../../core/src/domain/transcript";
export { TranscriptUnavailableError } from "../../core/src/domain/transcript";

const messages: Record<string, string> = {
  NO_CAPTIONS: "No captions are available for this video.",
  CLOUD_BLOCKED:
    "YouTube blocked transcript access from this network or cloud provider. Try the local transcript service.",
  TRANSCRIPT_TIMEOUT: "Transcript retrieval timed out. Please retry.",
  UPSTREAM_ERROR:
    "The transcript service could not retrieve this video. Please retry.",
};

export type TranscriptProvider = TranscriptPort;

class MockTranscriptProvider implements TranscriptProvider {
  async getTranscript(
    videoId: string,
  ): Promise<{ title: string; text: string }> {
    if (videoId === "missing0000") {
      throw new TranscriptUnavailableError(
        "No captions are available for this video.",
      );
    }
    return {
      title: `Demo video ${videoId}`,
      text: "This is a deterministic local transcript. It is available for local BDD and simulator testing.",
    };
  }
}

class RemoteTranscriptProvider implements TranscriptProvider {
  constructor(private readonly endpoint: string) {}

  async getTranscript(
    videoId: string,
  ): Promise<{ title: string; text: string }> {
    const configuredTimeout = Number(
      process.env.TRANSCRIPT_TIMEOUT_MS ?? 20000,
    );
    const timeout =
      Number.isFinite(configuredTimeout) && configuredTimeout > 0
        ? Math.min(configuredTimeout, 60000)
        : 20000;
    try {
      const response = await fetch(
        `${this.endpoint.replace(/\/$/, "")}/transcript/${encodeURIComponent(videoId)}`,
        { signal: AbortSignal.timeout(timeout), cache: "no-store" },
      );
      if (!response.ok) {
        const reason =
          (
            {
              404: "NO_CAPTIONS",
              403: "CLOUD_BLOCKED",
              504: "TRANSCRIPT_TIMEOUT",
            } as Record<number, string>
          )[response.status] ?? "UPSTREAM_ERROR";
        throw new TranscriptUnavailableError(messages[reason], reason);
      }
      const payload = (await response.json()) as {
        title?: unknown;
        text?: unknown;
      } | null;
      if (!payload || typeof payload.text !== "string")
        throw new TranscriptUnavailableError(
          messages.UPSTREAM_ERROR,
          "UPSTREAM_ERROR",
        );
      if (!payload.text.trim())
        throw new TranscriptUnavailableError(
          messages.NO_CAPTIONS,
          "NO_CAPTIONS",
        );
      return {
        title:
          typeof payload.title === "string" && payload.title.trim()
            ? payload.title
            : `YouTube video ${videoId}`,
        text: payload.text,
      };
    } catch (error) {
      if (error instanceof TranscriptUnavailableError) throw error;
      const reason =
        error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
          ? "TRANSCRIPT_TIMEOUT"
          : "UPSTREAM_ERROR";
      throw new TranscriptUnavailableError(messages[reason], reason);
    }
  }
}

export function createTranscriptProvider(): TranscriptProvider {
  const mode = process.env.YOUTUBE_TRANSCRIPT_MODE ?? "live";
  if (mode === "mock") return new MockTranscriptProvider();
  if (mode !== "live")
    throw new TranscriptUnavailableError(
      "Unknown transcript provider mode.",
      "CONFIGURATION_ERROR",
    );
  const endpoint = process.env.TRANSCRIPT_SERVICE_URL;
  if (!endpoint)
    throw new TranscriptUnavailableError(
      "Transcript retrieval is not configured for this deployment.",
      "CONFIGURATION_ERROR",
    );
  return new RemoteTranscriptProvider(endpoint);
}
