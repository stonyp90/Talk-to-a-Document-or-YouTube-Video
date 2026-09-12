import { afterEach, describe, expect, it, vi } from "vitest";
import { createVideoSearchProvider } from "./videoSearch";
import { parseYouTubeVideoId } from "../../core/src/domain/ingestion";

const searchResponse = (items: unknown[]) => Response.json({ items });

const liveMode = () => {
  vi.stubEnv("YOUTUBE_SEARCH_MODE", "live");
  vi.stubEnv("YOUTUBE_API_KEY", "test-search-key");
  vi.stubEnv("YOUTUBE_API_BASE_URL", "https://youtube.test");
};

const requestedUrl = (fetcher: { mock: { calls: unknown[][] } }) =>
  new URL(String(fetcher.mock.calls[0][0]));

describe("video search provider boundary", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("maps API items to candidates the ingestion path already accepts", async () => {
    liveMode();
    const fetcher = vi.fn().mockResolvedValue(
      searchResponse([
        {
          id: { videoId: "dQw4w9WgXcQ" },
          snippet: { title: "Kind of Blue", channelTitle: "Miles Davis" },
        },
      ]),
    );
    vi.stubGlobal("fetch", fetcher);

    const [candidate] = await createVideoSearchProvider().search(
      "miles davis",
      5,
    );
    expect(candidate).toEqual({
      videoId: "dQw4w9WgXcQ",
      title: "Kind of Blue",
      channel: "Miles Davis",
      url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    });
    expect(parseYouTubeVideoId(candidate.url)).toBe("dQw4w9WgXcQ");
  });

  it("asks only for captioned videos, because an uncaptioned one cannot be read", async () => {
    liveMode();
    const fetcher = vi.fn().mockResolvedValue(searchResponse([]));
    vi.stubGlobal("fetch", fetcher);

    await createVideoSearchProvider().search("miles davis", 3);
    const url = requestedUrl(fetcher);
    expect(url.origin).toBe("https://youtube.test");
    expect(url.pathname).toBe("/youtube/v3/search");
    expect(url.searchParams.get("videoCaption")).toBe("closedCaption");
    expect(url.searchParams.get("type")).toBe("video");
    expect(url.searchParams.get("part")).toBe("snippet");
    expect(url.searchParams.get("q")).toBe("miles davis");
    expect(url.searchParams.get("maxResults")).toBe("3");
  });

  it("decodes the entities the API escapes titles with", async () => {
    liveMode();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        searchResponse([
          {
            id: { videoId: "dQw4w9WgXcQ" },
            snippet: {
              title:
                "Rock &amp; Roll &#39;live&#39; &quot;1972&quot; &lt;HD&gt;",
              channelTitle: "Sound &amp; Vision",
            },
          },
        ]),
      ),
    );

    const [candidate] = await createVideoSearchProvider().search("rock", 5);
    expect(candidate.title).toBe("Rock & Roll 'live' \"1972\" <HD>");
    expect(candidate.channel).toBe("Sound & Vision");
  });

  it("skips items with no video id rather than offering a dead link", async () => {
    liveMode();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        searchResponse([
          { id: { channelId: "UC123" }, snippet: { title: "A channel" } },
          {
            id: { videoId: "dQw4w9WgXcQ" },
            snippet: { title: "A video" },
          },
        ]),
      ),
    );

    const found = await createVideoSearchProvider().search("rock", 5);
    expect(found.map((entry) => entry.videoId)).toEqual(["dQw4w9WgXcQ"]);
  });

  it("reports a refused upstream call without ever naming the key", async () => {
    liveMode();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(Response.json({ error: {} }, { status: 403 })),
    );

    const failure = await createVideoSearchProvider()
      .search("rock", 5)
      .catch((error: Error) => error);
    expect((failure as Error).message).toBe("YouTube search failed (403).");
    expect((failure as Error).message).not.toContain("test-search-key");
  });

  it("aborts a stalled search at the configured deadline", async () => {
    liveMode();
    vi.stubEnv("YOUTUBE_SEARCH_TIMEOUT_MS", "10");
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

    await expect(createVideoSearchProvider().search("rock", 5)).rejects.toThrow(
      /timed out/i,
    );
  });

  it("serves deterministic fixtures in mock mode, with no key and no network", async () => {
    vi.stubEnv("YOUTUBE_SEARCH_MODE", "mock");
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const provider = createVideoSearchProvider();
    const first = await provider.search("miles davis", 3);
    const again = await provider.search("miles davis", 3);
    const other = await provider.search("the beatles", 3);

    expect(fetcher).not.toHaveBeenCalled();
    expect(first).toHaveLength(3);
    expect(again).toEqual(first);
    expect(other[0].videoId).not.toBe(first[0].videoId);
    expect(first[0].title).toContain("miles davis");
    for (const candidate of first)
      expect(parseYouTubeVideoId(candidate.url)).toBe(candidate.videoId);
  });

  it("falls back to fixtures, loudly, when no key is configured", async () => {
    vi.stubEnv("YOUTUBE_SEARCH_MODE", "");
    vi.stubEnv("YOUTUBE_API_KEY", "");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);

    const found = await createVideoSearchProvider().search("miles davis", 2);
    expect(found).toHaveLength(2);
    expect(fetcher).not.toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(" ")).toMatch(/YOUTUBE_API_KEY/);
    warn.mockRestore();
  });
});
