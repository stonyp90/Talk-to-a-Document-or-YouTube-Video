import { signOutAccount } from "@/apps/web/src/composition";
import {
  clearedSessionCookie,
  readSessionToken,
  requireAccount,
} from "@/apps/web/src/auth";
import { errorResponse, rateLimit } from "@/apps/web/src/http";

/** Read often by the interface, so its budget is generous; it spends nothing. */
const limits = () => ({
  name: "auth-session",
  limit: Number(process.env.AUTH_SESSION_RATE_LIMIT) || 60,
  windowMs: Number(process.env.AUTH_SESSION_RATE_WINDOW_MS) || 60_000,
});

export async function GET(request: Request) {
  const limited = rateLimit(request, limits());
  if (limited) return limited;
  const account = await requireAccount(request);
  if (account instanceof Response) return account;
  return Response.json(
    { email: account.email },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(request: Request) {
  const limited = rateLimit(request, limits());
  if (limited) return limited;
  try {
    // Signing out clears the cookie either way: a browser holding a token the
    // server has already forgotten must not keep looking signed in.
    await signOutAccount(readSessionToken(request));
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "no-store",
        "Set-Cookie": clearedSessionCookie(request),
      },
    });
  } catch (error) {
    return errorResponse(error, "The sign-out could not be completed.");
  }
}
