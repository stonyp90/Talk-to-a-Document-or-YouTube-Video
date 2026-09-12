import { confirmSignInCode } from "@/apps/web/src/composition";
import { sessionCookie } from "@/apps/web/src/auth";
import { errorResponse, jsonError, rateLimit } from "@/apps/web/src/http";
import { signInConfirmSchema } from "@/apps/web/src/validation";

/** Guessing a code is cheap for an attacker; the limiter makes it slow. */
const limits = () => ({
  name: "auth-confirm",
  limit: Number(process.env.AUTH_CONFIRM_RATE_LIMIT) || 10,
  windowMs: Number(process.env.AUTH_CONFIRM_RATE_WINDOW_MS) || 900_000,
});

export async function POST(request: Request) {
  const limited = rateLimit(request, limits());
  if (limited) return limited;
  try {
    const parsed = signInConfirmSchema.safeParse(await request.json());
    if (!parsed.success)
      return jsonError(
        "CODE_INVALID",
        "Enter the code exactly as it appears in the email.",
        400,
      );

    const { account, session } = await confirmSignInCode(
      parsed.data.email,
      parsed.data.code,
    );
    // The token travels in the cookie for browsers, and in the body as well so
    // a native client has something it can store and send back as a bearer.
    //
    // This is a deliberate security decision, not a convenience. The very same
    // response already hands this caller the very same token in `Set-Cookie`,
    // so writing it into the body of that one response discloses nothing the
    // caller does not already hold: whoever proved possession of the mailbox
    // owns this session either way. What it does change is the handling. The
    // token must never be logged, never be echoed into an error, and never be
    // stored anywhere a page's scripts can read it — the browser client keeps
    // using the HttpOnly cookie and ignores this field entirely. Only the
    // mobile app, which has no cookie jar, reads it.
    return Response.json(
      { email: account.email, token: session.token },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
          "Set-Cookie": sessionCookie(session.token, request),
        },
      },
    );
  } catch (error) {
    return errorResponse(error, "The sign-in could not be completed.");
  }
}
