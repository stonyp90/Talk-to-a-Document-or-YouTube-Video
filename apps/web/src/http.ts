import { InputValidationError } from "@/packages/core/src/domain/ingestion";
import { TranscriptUnavailableError } from "@/packages/core/src/domain/transcript";
import { SessionExpiredError } from "@/packages/core/src/application/sessions";

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

/**
 * Reads a multipart form, or reports the client's mistake as the client's.
 * `Request.formData` throws on the wrong content type and on a truncated
 * body, and letting that reach the generic handler would answer a malformed
 * request with a 500: a healthy service looking broken, and the one person who
 * can fix the call told nothing about how.
 */
export async function multipartFormData(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch (cause) {
    throw new InputValidationError(
      "Send this request as multipart/form-data with a file or a url field.",
      "INVALID_FORM_DATA",
      { cause },
    );
  }
}

/** The first hop of a comma-separated proxy header, if it carries one. */
const firstHop = (value: string | null): string | undefined =>
  value?.split(",")[0]?.trim() || undefined;

/** An absolute http(s) origin, or nothing when the value cannot be one. */
const httpOrigin = (value: string | undefined): string | undefined => {
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : undefined;
  } catch {
    return undefined;
  }
};

/**
 * The origin the caller actually reached, which is the only origin a client
 * generated from what we publish can call back. Behind the proxy the process
 * is bound to a private address, so `request.url` names that bind address and
 * not the public host: the forwarded headers are the truth there. `APP_ORIGIN`
 * is the same configured origin the deployment already uses for CORS, for a
 * proxy that forwards nothing, and in local development the request itself is
 * already right. Nothing is hardcoded, so one image serves every environment.
 */
export function publicOrigin(request: Request): string {
  const requestUrl = new URL(request.url);
  const host =
    firstHop(request.headers.get("x-forwarded-host")) ??
    firstHop(request.headers.get("host"));
  const forwardedScheme = firstHop(request.headers.get("x-forwarded-proto"));
  const scheme =
    forwardedScheme === "http" || forwardedScheme === "https"
      ? forwardedScheme
      : requestUrl.protocol.replace(":", "");
  return (
    (host ? httpOrigin(`${scheme}://${host}`) : undefined) ??
    httpOrigin(process.env.APP_ORIGIN) ??
    requestUrl.origin
  );
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
