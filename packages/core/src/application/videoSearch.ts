import { InputValidationError } from "../domain/ingestion";
import type { VideoCandidate, VideoSearchPort } from "./ports";

/**
 * Saying a link out loud is absurd: nobody dictates "watch question mark v
 * equals". A speaker names an artist or a title, and this use case turns that
 * phrase into videos the ingestion path can actually open.
 */

/** Long enough for a title and an artist, short enough to refuse a dictation that ran away. */
export const MAX_VIDEO_QUERY_CHARACTERS = 200;

/**
 * The first hit is opened and the rest are offered as alternatives, so the list
 * is read aloud or scanned. Past a handful it is noise, not choice.
 */
export const DEFAULT_VIDEO_SEARCH_RESULTS = 5;

export type VideoSearch = {
  find(query: string): Promise<VideoCandidate[]>;
};

export function createVideoSearch(
  provider: VideoSearchPort,
  options?: { maxResults?: number },
): VideoSearch {
  const configured = options?.maxResults;
  const maxResults =
    Number.isSafeInteger(configured) && (configured as number) > 0
      ? (configured as number)
      : DEFAULT_VIDEO_SEARCH_RESULTS;

  /**
   * Speech arrives with the speaker's pauses in it. One phrase with single
   * spaces is what a search provider is good at, and it also makes the same
   * spoken request identical every time it is asked.
   */
  const requirePhrase = (query: string) => {
    const phrase = query.trim().replace(/\s+/g, " ");
    if (!phrase || phrase.length > MAX_VIDEO_QUERY_CHARACTERS)
      throw new InputValidationError(
        `Say what to look for, in at most ${MAX_VIDEO_QUERY_CHARACTERS.toLocaleString("en-US")} characters.`,
        "INVALID_QUERY",
      );
    return phrase;
  };

  return {
    async find(query: string) {
      const phrase = requirePhrase(query);
      const found = await provider.search(phrase, maxResults);
      const seen = new Set<string>();
      const usable: VideoCandidate[] = [];
      for (const candidate of found ?? []) {
        // A hit with no id or no link is not a source anyone can be sent to.
        if (!candidate?.videoId?.trim() || !candidate.url?.trim()) continue;
        if (seen.has(candidate.videoId)) continue;
        seen.add(candidate.videoId);
        usable.push(candidate);
        if (usable.length === maxResults) break;
      }
      return usable;
    },
  };
}
