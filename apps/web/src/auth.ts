import type { Account } from "@/packages/core/src/domain/account";
import { UsageLimitError } from "@/packages/core/src/application/accounts";
import {
  accountSessionTtlMs,
  authenticateAccount,
  chargeAccount,
} from "./composition";
import { jsonError } from "./http";
import { gateMode, type AuthMode } from "./startup";

/**
 * The gate. Every endpoint that spends provider credit goes through it, because
 * an anonymous public endpoint with a key behind it is somebody else's budget.
 * Signing in is only half of it: whoever signs up can still burn the money, so
 * the same call also charges a per-account allowance.
 */

export type { AuthMode } from "./startup";

let announced = false;

/**
 * The rule itself lives beside the startup check, which has to apply exactly the
 * same reading of `AUTH_MODE` to decide what a deployment is missing. This adds
 * the warning a developer needs to see when they open the gate on purpose.
 */
export function authMode(): AuthMode {
  if (gateMode() === "required") return "required";
  if (!announced) {
    announced = true;
    console.warn(
      "[auth] AUTH_MODE=disabled: paid endpoints are open and every request spends from one shared local account. Never do this in production.",
    );
  }
  return "disabled";
}

/** The account every request belongs to while the gate is disabled. */
export const LOCAL_ACCOUNT_ID = "local-development-account";

const localAccount = (): Account => ({
  id: LOCAL_ACCOUNT_ID,
  email: process.env.AUTH_LOCAL_ACCOUNT_EMAIL || "local@localhost",
  createdAt: 0,
});

export function sessionCookieName(): string {
  return process.env.AUTH_COOKIE_NAME || "ursly_session";
}

/**
 * The single place the cost of each paid operation is written down. A spoken
 * session and an ingestion cost far more than one typed question, and the table
 * says so in one file rather than in seven route handlers.
 */
export type PaidOperation =
  | "ingest"
  | "upload"
  | "extract"
  | "textChat"
  | "realtime"
  | "turns"
  | "videoSearch";

const UNIT_COSTS: Record<PaidOperation, { key: string; units: number }> = {
  // A whole document extracted, normalized and primed for a conversation.
  ingest: { key: "USAGE_UNITS_INGEST", units: 10 },
  // A presigned form costs nothing to issue; it is priced so the storage path
  // cannot be hammered for free, not because the call is expensive.
  upload: { key: "USAGE_UNITS_UPLOAD", units: 1 },
  extract: { key: "USAGE_UNITS_EXTRACT", units: 10 },
  textChat: { key: "USAGE_UNITS_TEXT_CHAT", units: 5 },
  // Voice is the expensive one: an open session bills for as long as it lives.
  realtime: { key: "USAGE_UNITS_REALTIME", units: 50 },
  // Bookkeeping. It stores what was already said, and calls no provider.
  turns: { key: "USAGE_UNITS_TURNS", units: 1 },
  // A spoken search spends third-party search quota rather than model tokens,
  // so it is far cheaper than a question — but it is not free, and an open
  // search endpoint is somebody else's daily quota burned by a script.
  videoSearch: { key: "USAGE_UNITS_VIDEO_SEARCH", units: 2 },
};

export function unitsFor(operation: PaidOperation): number {
  const { key, units } = UNIT_COSTS[operation];
  const configured = Number(process.env[key]);
  return Number.isSafeInteger(configured) && configured > 0
    ? configured
    : units;
}

/** The cost table as it is actually applied, for the documentation route and tests. */
export const unitCostTable = (): Record<PaidOperation, number> =>
  Object.fromEntries(
    (Object.keys(UNIT_COSTS) as PaidOperation[]).map((operation) => [
      operation,
      unitsFor(operation),
    ]),
  ) as Record<PaidOperation, number>;

/**
 * The session arrives one of two ways, and this is the only place that knows
 * it. A browser carries it in an HttpOnly cookie, which no script on the page
 * can read: that is the safer carrier, so it stays primary. A React Native app
 * has no dependable cookie jar behind `fetch`, so the published mobile client
 * sends the same token as `Authorization: Bearer <token>` instead — without
 * that fallback the native builds have no way through the gate at all, and an
 * unauthenticated mobile client is precisely the hole the gate exists to close.
 *
 * The cookie wins when both are present. A header is trivially set by anything
 * that can make a request, so it must never be able to displace the session the
 * browser itself is holding.
 */
export function readSessionToken(request: Request): string {
  return cookieToken(request) || bearerToken(request);
}

function cookieToken(request: Request): string {
  const header = request.headers.get("cookie");
  if (!header) return "";
  const name = sessionCookieName();
  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    return decodeURIComponent(part.slice(separator + 1).trim());
  }
  return "";
}

/**
 * Strictly `Bearer <token>`, one scheme and one opaque value. Anything else —
 * another scheme, an empty value, a second word — is not a session token, and a
 * loose reading here would hand `authenticate` rubbish to look up.
 */
function bearerToken(request: Request): string {
  const header = request.headers.get("authorization");
  if (!header) return "";
  const match = /^Bearer +([^\s,;]+)$/i.exec(header.trim());
  return match ? match[1] : "";
}

/**
 * A cookie is only as safe as its flags. `Secure` is dropped in exactly one
 * case — plain HTTP on localhost, where there is no HTTPS to require and the
 * browser would otherwise discard the cookie during local development.
 */
function isSecure(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto");
  const protocol = forwarded
    ? `${forwarded.split(",")[0]?.trim()}:`
    : safeProtocol(request.url);
  if (protocol === "https:") return true;
  const host = hostnameOf(request);
  return !(host === "localhost" || host === "127.0.0.1" || host === "[::1]");
}

function safeProtocol(url: string): string {
  try {
    return new URL(url).protocol;
  } catch {
    return "https:";
  }
}

function hostnameOf(request: Request): string {
  try {
    return new URL(request.url).hostname;
  } catch {
    return "";
  }
}

function cookie(
  value: string,
  maxAgeSeconds: number,
  request: Request,
): string {
  const attributes = [
    `${sessionCookieName()}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isSecure(request)) attributes.push("Secure");
  return attributes.join("; ");
}

export function sessionCookie(token: string, request: Request): string {
  return cookie(
    encodeURIComponent(token),
    Math.max(1, Math.floor(accountSessionTtlMs() / 1000)),
    request,
  );
}

export function clearedSessionCookie(request: Request): string {
  return cookie("", 0, request);
}

const unauthenticated = () =>
  jsonError(
    "UNAUTHENTICATED",
    "Sign in to continue. This feature runs on a paid model, so it is for signed-in readers.",
    401,
  );

/**
 * Resolves the signed-in account, or the refusal to send back. Returning the
 * `Response` rather than throwing keeps the decision visible in the route: a
 * handler cannot forget to check what it was handed.
 */
export async function requireAccount(
  request: Request,
): Promise<Account | Response> {
  if (authMode() === "disabled") return localAccount();
  const token = readSessionToken(request);
  if (!token) return unauthenticated();
  const account = await authenticateAccount(token);
  return account ?? unauthenticated();
}

/**
 * Authentication and the spend cap in one call, in that order: an anonymous
 * caller is refused before any ledger is touched.
 *
 * A refusal over the cap answers 429 with `Retry-After`, not 402. Nothing is
 * for sale here, so "payment required" would be a lie; 429 is the status every
 * client already understands, and `Retry-After` tells the reader exactly when
 * their allowance reopens.
 */
export async function guard(
  request: Request,
  { units }: { units: number },
): Promise<Account | Response> {
  const account = await requireAccount(request);
  if (account instanceof Response) return account;
  if (authMode() === "disabled") return account;

  try {
    await chargeAccount(account.id, units);
    return account;
  } catch (error) {
    if (
      error instanceof UsageLimitError ||
      (error as Error)?.name === "UsageLimitError"
    ) {
      const retryAfterMs = (error as UsageLimitError).retryAfterMs ?? 0;
      return jsonError("USAGE_LIMIT", (error as Error).message, 429, {
        "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))),
      });
    }
    throw error;
  }
}
