import type {
  VideoCandidate,
  VideoSearchPort,
} from "../../core/src/application/ports";

/**
 * Finding a video from what somebody said. The whole point of the spoken path
 * is that a reader names an artist or a title instead of spelling out a URL,
 * so this adapter is what stands between "play some Miles Davis" and a source
 * the ingestion path can open.
 */

const DEFAULT_BASE_URL = "https://www.googleapis.com";
const DEFAULT_TIMEOUT_MS = 10_000;
/** A search is a network call in a reader's critical path; a stalled one is worse than none. */
const MAX_TIMEOUT_MS = 60_000;
const DEFAULT_MOCK_RESULTS = 5;

/** The id shape YouTube hands out, and the only one the ingestion domain accepts. */
const VIDEO_ID_CHARACTERS =
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
const VIDEO_ID_LENGTH = 11;

/** The five entities the Data API escapes titles and channel names with. */
const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&#39;": "'",
  "&quot;": '"',
  "&lt;": "<",
  "&gt;": ">",
};

/**
 * Titles come back escaped — "Rock &amp; Roll" — and a reader hearing or
 * reading the raw entity would think the title itself is broken.
 */
function decodeEntities(value: string): string {
  return value.replace(
    /&amp;|&#39;|&quot;|&lt;|&gt;/g,
    (entity) => ENTITIES[entity],
  );
}

/** A `watch?v=` link, which is the shape `parseYouTubeVideoId` already accepts. */
const watchUrl = (videoId: string) =>
  `https://www.youtube.com/watch?v=${videoId}`;

function timeoutBudget(): number {
  const configured = Number(process.env.YOUTUBE_SEARCH_TIMEOUT_MS);
  return Number.isFinite(configured) && configured > 0
    ? Math.min(configured, MAX_TIMEOUT_MS)
    : DEFAULT_TIMEOUT_MS;
}

const announced = new Set<string>();

/** Said once per process: a silent fallback is how a deployment ends up serving fixtures forever. */
function announce(reason: string, message: string): void {
  if (announced.has(reason)) return;
  announced.add(reason);
  console.warn(message);
}

/**
 * Deterministic fixtures derived from the query, so local runs, the acceptance
 * suite and the browser suite all find videos with no key and no network, and
 * find the same ones on every run.
 */
class MockVideoSearchProvider implements VideoSearchPort {
  async search(query: string, limit: number): Promise<VideoCandidate[]> {
    const count = Math.max(1, Math.min(limit, DEFAULT_MOCK_RESULTS));
    return Array.from({ length: count }, (_unused, index) => {
      const videoId = fixtureVideoId(query, index);
      return {
        videoId,
        title: `${query} — captioned result ${index + 1}`,
        channel: "Ursly demo channel",
        url: watchUrl(videoId),
      };
    });
  }
}

/** A stable id per query and position, in the exact alphabet YouTube uses. */
function fixtureVideoId(query: string, index: number): string {
  let hash = 2166136261;
  for (const character of `${query}#${index}`) {
    hash ^= character.codePointAt(0)!;
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  let id = "";
  for (let position = 0; position < VIDEO_ID_LENGTH; position++) {
    id += VIDEO_ID_CHARACTERS[hash % VIDEO_ID_CHARACTERS.length];
    hash = (Math.imul(hash, 16777619) >>> 0) + position + 1;
  }
  return id;
}

type SearchItem = {
  id?: { videoId?: unknown };
  snippet?: { title?: unknown; channelTitle?: unknown };
};

class YouTubeVideoSearchProvider implements VideoSearchPort {
  constructor(
    private readonly apiKey: string,
    private readonly baseUrl: string,
  ) {}

  async search(query: string, limit: number): Promise<VideoCandidate[]> {
    const url = new URL("/youtube/v3/search", this.baseUrl);
    url.searchParams.set("part", "snippet");
    url.searchParams.set("type", "video");
    // This product can only talk about a video it can read. An uncaptioned
    // result would hand the reader a source that fails at the next step, so
    // the filter belongs in the request rather than in a later apology.
    url.searchParams.set("videoCaption", "closedCaption");
    url.searchParams.set("maxResults", String(limit));
    url.searchParams.set("q", query);
    url.searchParams.set("key", this.apiKey);

    let response: Response;
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(timeoutBudget()),
        cache: "no-store",
      });
    } catch (error) {
      // The key travels in the query string, so the caught error — which can
      // carry the request URL — must never be forwarded or logged as it is.
      if (
        error instanceof Error &&
        ["TimeoutError", "AbortError"].includes(error.name)
      )
        throw new Error("The YouTube search timed out. Please retry.");
      throw new Error("The YouTube search could not be completed.");
    }
    if (!response.ok)
      throw new Error(`YouTube search failed (${response.status}).`);

    const payload = (await response.json()) as { items?: SearchItem[] } | null;
    const items = Array.isArray(payload?.items) ? payload.items : [];
    return items.flatMap((item) => {
      const videoId = item?.id?.videoId;
      if (typeof videoId !== "string" || !videoId.trim()) return [];
      const title =
        typeof item.snippet?.title === "string" && item.snippet.title.trim()
          ? decodeEntities(item.snippet.title)
          : `YouTube video ${videoId}`;
      const channel =
        typeof item.snippet?.channelTitle === "string" &&
        item.snippet.channelTitle.trim()
          ? decodeEntities(item.snippet.channelTitle)
          : undefined;
      return [{ videoId, title, channel, url: watchUrl(videoId) }];
    });
  }
}

export function createVideoSearchProvider(): VideoSearchPort {
  const mode = process.env.YOUTUBE_SEARCH_MODE ?? "";
  const apiKey = process.env.YOUTUBE_API_KEY ?? "";

  if (mode === "mock") {
    announce(
      "mock",
      "[video-search] YOUTUBE_SEARCH_MODE=mock: spoken searches return deterministic fixtures, not real videos.",
    );
    return new MockVideoSearchProvider();
  }
  // Unlike captions, a missing key here is not worth refusing over: without a
  // fallback the whole spoken entry path would be dead on every machine that
  // has no quota, including CI. It is loud rather than silent.
  if (!apiKey) {
    announce(
      "unconfigured",
      "[video-search] No YOUTUBE_API_KEY is configured: spoken searches return deterministic fixtures, not real videos.",
    );
    return new MockVideoSearchProvider();
  }
  return new YouTubeVideoSearchProvider(
    apiKey,
    process.env.YOUTUBE_API_BASE_URL || DEFAULT_BASE_URL,
  );
}
