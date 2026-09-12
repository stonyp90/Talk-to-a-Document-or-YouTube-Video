import { recordTurns, resolveSession } from "@/apps/web/src/composition";
import { errorResponse, json, jsonError, rateLimit } from "@/apps/web/src/http";
import { guard, unitsFor } from "@/apps/web/src/auth";
import {
  conversationTurnsSchema,
  MAX_CONVERSATION_TURNS,
} from "@/apps/web/src/validation";

/**
 * Voice and text are one conversation. A spoken exchange happens between the
 * browser and the provider, so the server only learns about it if the client
 * posts it here; without that, a typed follow-up starts from nothing.
 */
const limits = () => ({
  name: "conversation-turns",
  // Speaking produces turns faster than typing does, so this budget is looser
  // than the question budget it feeds.
  limit: Number(process.env.CONVERSATION_TURNS_RATE_LIMIT) || 60,
  windowMs: Number(process.env.CONVERSATION_TURNS_RATE_WINDOW_MS) || 60_000,
});

export async function POST(request: Request) {
  const limited = rateLimit(request, limits());
  if (limited) return limited;
  const account = await guard(request, { units: unitsFor("turns") });
  if (account instanceof Response) return account;
  try {
    const parsed = conversationTurnsSchema.safeParse(await request.json());
    if (!parsed.success)
      return jsonError(
        "INVALID_TURNS",
        `Send a sourceId and between 1 and ${MAX_CONVERSATION_TURNS} non-empty turns.`,
        400,
      );
    const session = await resolveSession({ sourceId: parsed.data.sourceId });
    await recordTurns(session.id, parsed.data.turns);
    return json({ sourceId: session.id });
  } catch (error) {
    return errorResponse(error, "The exchange could not be recorded.");
  }
}
