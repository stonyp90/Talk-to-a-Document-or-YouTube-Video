import {
  createRealtimeSession,
  resolveSession,
} from "@/apps/web/src/composition";
import { errorResponse, json, jsonError, rateLimit } from "@/apps/web/src/http";
import { guard, unitsFor } from "@/apps/web/src/auth";
import { sourceReferenceSchema } from "@/apps/web/src/validation";

export async function POST(request: Request) {
  // The only route that mints a bearer credential for paid provider audio, so
  // it carries the tightest budget. The gateway route throttle bounds the total
  // across instances; this bounds what one caller gets from any one of them.
  const limited = rateLimit(request, {
    name: "realtime",
    limit: 4,
    windowMs: 60_000,
  });
  if (limited) return limited;
  const account = await guard(request, { units: unitsFor("realtime") });
  if (account instanceof Response) return account;
  try {
    const parsed = sourceReferenceSchema.safeParse(await request.json());
    if (!parsed.success)
      return jsonError(
        "SOURCE_REQUIRED",
        "A source is required to start a voice session.",
        400,
      );

    const session = await resolveSession(parsed.data);
    const realtime = await createRealtimeSession(session.source, {
      speed: parsed.data.speed,
      assistantName: parsed.data.assistantName,
    });
    // The instructions are already inside the ephemeral credential; echoing the
    // whole source back to the browser would only waste bandwidth.
    const { instructions: _instructions, ...credential } = realtime;
    return json({ ...credential, sourceId: session.id });
  } catch (error) {
    return errorResponse(
      error,
      "Voice session setup failed. Please try again.",
    );
  }
}
