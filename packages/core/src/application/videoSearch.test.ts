import { expect, it, vi } from "vitest";
import { createVideoSearch, MAX_VIDEO_QUERY_CHARACTERS } from "./videoSearch";
import type { VideoCandidate } from "./ports";

const candidate = (videoId: string, title = `Video ${videoId}`) =>
  ({
    videoId,
    title,
    channel: "A channel",
    url: `https://www.youtube.com/watch?v=${videoId}`,
  }) satisfies VideoCandidate;

function fixture(results: unknown[] = [candidate("aaaaaaaaaaa")]) {
  const provider = { search: vi.fn().mockResolvedValue(results) };
  return { provider, app: createVideoSearch(provider) };
}

it("refuses a query that is empty once the silence is trimmed", async () => {
  const { app, provider } = fixture();
  await expect(app.find("   ")).rejects.toMatchObject({
    code: "INVALID_QUERY",
  });
  expect(provider.search).not.toHaveBeenCalled();
});

it("refuses a query longer than the accepted limit", async () => {
  const { app, provider } = fixture();
  await expect(
    app.find("a".repeat(MAX_VIDEO_QUERY_CHARACTERS + 1)),
  ).rejects.toMatchObject({ code: "INVALID_QUERY" });
  expect(provider.search).not.toHaveBeenCalled();
});

it("hands the provider one normalized phrase, however it was dictated", async () => {
  const { app, provider } = fixture();
  await app.find("  miles   davis \n kind of blue ");
  expect(provider.search).toHaveBeenCalledWith(
    "miles davis kind of blue",
    expect.any(Number),
  );
});

it("caps the list so a spoken answer stays short enough to hear", async () => {
  const many = Array.from({ length: 20 }, (_, index) =>
    candidate(`video${String(index).padStart(6, "0")}`),
  );
  const provider = { search: vi.fn().mockResolvedValue(many) };
  const app = createVideoSearch(provider, { maxResults: 3 });
  expect(await app.find("miles davis")).toHaveLength(3);
  expect(provider.search).toHaveBeenCalledWith("miles davis", 3);
});

it("drops entries a reader could not be sent to", async () => {
  const { app } = fixture([
    candidate("aaaaaaaaaaa"),
    { videoId: "", title: "No id", url: "https://www.youtube.com/watch?v=" },
    { videoId: "bbbbbbbbbbb", title: "No url", url: "  " },
  ]);
  expect(await app.find("miles davis")).toEqual([candidate("aaaaaaaaaaa")]);
});

it("de-duplicates repeated videos, keeping the first hit", async () => {
  const { app } = fixture([
    candidate("aaaaaaaaaaa", "First upload"),
    candidate("aaaaaaaaaaa", "Re-upload"),
    candidate("bbbbbbbbbbb"),
  ]);
  const found = await app.find("miles davis");
  expect(found.map((entry) => entry.videoId)).toEqual([
    "aaaaaaaaaaa",
    "bbbbbbbbbbb",
  ]);
  expect(found[0].title).toBe("First upload");
});

it("returns nothing rather than failing when the provider finds nothing", async () => {
  const { app } = fixture([]);
  expect(await app.find("a phrase nobody filmed")).toEqual([]);
});
