import { findVideos } from "@/apps/web/src/composition";
import { errorResponse, json, jsonError, rateLimit } from "@/apps/web/src/http";
import { guard, unitsFor } from "@/apps/web/src/auth";
import { videoSearchSchema } from "@/apps/web/src/validation";

/**
 * Saying a link out loud is absurd: nobody dictates "watch question mark v
 * equals". A speaker names an artist or a title, and this endpoint turns that
 * into captioned videos the ingestion path can open.
 */
const limits = () => ({
  name: "video-search",
  // Tighter than typed questions: each call spends third-party search quota
  // that is shared by every reader of the deployment, not by this one caller.
  limit: Number(process.env.VIDEO_SEARCH_RATE_LIMIT) || 20,
  windowMs: Number(process.env.VIDEO_SEARCH_RATE_WINDOW_MS) || 60_000,
});

export async function POST(request: Request) {
  const limited = rateLimit(request, limits());
  if (limited) return limited;
  const account = await guard(request, { units: unitsFor("videoSearch") });
  if (account instanceof Response) return account;
  try {
    const parsed = videoSearchSchema.safeParse(await request.json());
    if (!parsed.success)
      return jsonError(
        "INVALID_QUERY",
        "Say what to look for, in a few words.",
        400,
      );
    return json({ results: await findVideos(parsed.data.query) });
  } catch (error) {
    return errorResponse(
      error,
      "The video search failed. Paste a link instead.",
    );
  }
}
