import {
  commandSpeechEnabled,
  openCommandSpeech,
} from "@/apps/web/src/composition";
import { guard, unitsFor } from "@/apps/web/src/auth";
import { errorResponse, json, jsonError, rateLimit } from "@/apps/web/src/http";
import { speechSessionSchema } from "@/apps/web/src/validation";

export async function POST(request: Request) {
  const limited = rateLimit(request, {
    name: "command-speech",
    limit: 10,
    windowMs: 60000,
  });
  if (limited) return limited;
  const account = await guard(request, { units: unitsFor("realtime") });
  if (account instanceof Response) return account;
  if (!commandSpeechEnabled())
    return jsonError(
      "SPEECH_UNAVAILABLE",
      "Live command recognition is unavailable. Use browser recognition or the buttons.",
      503,
    );
  try {
    const parsed = speechSessionSchema.safeParse(await request.json());
    if (!parsed.success)
      return jsonError("INVALID_LANGUAGE", "Choose English or French.", 400);
    return json(await openCommandSpeech(parsed.data.language, request.signal));
  } catch (error) {
    return errorResponse(
      error,
      "Speech recognition could not connect. Try again or use the buttons.",
    );
  }
}
