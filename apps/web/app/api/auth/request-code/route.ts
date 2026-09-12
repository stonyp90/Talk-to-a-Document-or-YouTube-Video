import { requestSignInCode } from "@/apps/web/src/composition";
import { errorResponse, jsonError, rateLimit } from "@/apps/web/src/http";
import { signInRequestSchema } from "@/apps/web/src/validation";

/**
 * This endpoint sends mail, which makes it the loudest abuse surface in the
 * API: it costs money, it can be pointed at somebody else's mailbox, and it
 * needs no session. Its budget is therefore the tightest one here.
 */
const limits = () => ({
  name: "auth-request-code",
  limit: Number(process.env.AUTH_REQUEST_CODE_RATE_LIMIT) || 5,
  windowMs: Number(process.env.AUTH_REQUEST_CODE_RATE_WINDOW_MS) || 900_000,
});

export async function POST(request: Request) {
  const limited = rateLimit(request, limits());
  if (limited) return limited;
  try {
    const parsed = signInRequestSchema.safeParse(await request.json());
    if (!parsed.success)
      return jsonError("INVALID_EMAIL", "Enter a valid email address.", 400);

    // The same empty answer whether or not the address is already known. A
    // different status, body or timing here would turn sign-in into a way of
    // asking which of your users has an account.
    await requestSignInCode(parsed.data.email, parsed.data.language);
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return errorResponse(error, "The code could not be sent. Please retry.");
  }
}
