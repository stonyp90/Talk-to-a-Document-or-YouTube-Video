import { InputValidationError } from "@/packages/core/src/domain/ingestion";
import { TranscriptUnavailableError } from "@/packages/core/src/domain/transcript";
import { SessionExpiredError } from "@/packages/core/src/application/sessions";
import { InvalidEmailError } from "@/packages/core/src/domain/account";
import {
  SignInError,
  UsageLimitError,
} from "@/packages/core/src/application/accounts";

const NO_STORE = { "Cache-Control": "no-store" } as const;

export type ApiError = { error: string; code: string };

export function jsonError(
  code: string,
  message: string,
  status: number,
  headers: Record<string, string> = {},
): Response {
  return Response.json({ error: message, code } satisfies ApiError, {
    status,
    headers: { ...NO_STORE, ...headers },
  });
}

export function json<T>(body: T, status = 200): Response {
  return Response.json(body, { status, headers: NO_STORE });
}

/**
 * Turns a thrown value into a response the client can act on, without ever
 * forwarding an internal message. Provider text can name models, endpoints or
 * account state, none of which belongs in a public reply.
 */
/**
 * Matches by class and by name. A monorepo can load the same module twice under
 * different specifiers, and an error that crosses that boundary would otherwise
 * lose its identity and be reported as an internal failure.
 */
const named = (
  error: unknown,
  name: string,
): error is Error & { code?: string } =>
  error instanceof Error && error.name === name;

export function errorResponse(error: unknown, fallback: string): Response {
  if (
    error instanceof InputValidationError ||
    named(error, "InputValidationError")
  )
    return jsonError(
      (error as { code?: string }).code ?? "INVALID_INPUT",
      (error as Error).message,
      400,
    );
  if (error instanceof InvalidEmailError || named(error, "InvalidEmailError"))
    return jsonError(
      (error as { code?: string }).code ?? "INVALID_EMAIL",
      (error as Error).message,
      400,
    );
  // A wrong, stale or exhausted code is a failed authentication attempt, and
  // the reason is safe to name: the reader already knows their own address.
  if (error instanceof SignInError || named(error, "SignInError"))
    return jsonError(
      (error as { code?: string }).code ?? "CODE_INVALID",
      (error as Error).message,
      401,
    );
  if (error instanceof UsageLimitError || named(error, "UsageLimitError"))
    return jsonError("USAGE_LIMIT", (error as Error).message, 429, {
      "Retry-After": String(
        Math.max(
          1,
          Math.ceil(((error as UsageLimitError).retryAfterMs ?? 0) / 1000),
        ),
      ),
    });
  if (
    error instanceof SessionExpiredError ||
    named(error, "SessionExpiredError")
  )
    return jsonError("SOURCE_EXPIRED", (error as Error).message, 409);
  if (
    error instanceof TranscriptUnavailableError ||
    named(error, "TranscriptUnavailableError")
  ) {
    const reason = (error as { reason?: string }).reason;
    const status =
      reason === "NO_CAPTIONS"
        ? 400
        : reason === "TRANSCRIPT_TIMEOUT"
          ? 504
          : 502;
    return jsonError(
      reason ?? "TRANSCRIPT_UNAVAILABLE",
      (error as Error).message,
      status,
    );
  }
  console.error("[api]", error);
  return jsonError("INTERNAL_ERROR", fallback, 500);
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimitOptions = {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Distinguishes independent budgets, for example voice versus text. */
  name: string;
};

/**
 * A fixed-window limiter over the caller's address. The endpoints behind it
 * spend money on every call and the deployment is public and unauthenticated,
 * so an unbounded caller is a billing incident waiting to happen. It is
 * per-process, which matches the per-process session store; a shared limiter is
 * the same swap a shared session store would be.
 */
export function rateLimit(
  request: Request,
  { limit, windowMs, name }: RateLimitOptions,
): Response | undefined {
  if (process.env.RATE_LIMIT_DISABLED === "true") return undefined;
  const now = Date.now();
  const address =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const key = `${name}:${address}`;

  for (const [existing, bucket] of buckets)
    if (bucket.resetAt <= now) buckets.delete(existing);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return undefined;
  }
  bucket.count += 1;
  if (bucket.count <= limit) return undefined;

  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
  return jsonError(
    "RATE_LIMITED",
    "Too many requests. Wait a moment and try again.",
    429,
    { "Retry-After": String(retryAfter) },
  );
}

/** Test seam: clears limiter state between cases. */
export function resetRateLimits(): void {
  buckets.clear();
}
