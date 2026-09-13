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

/** The addresses a server listens on, which name no host to call back. */
const UNSPECIFIED = new Set(["0.0.0.0", "[::]", "[::0]"]);
/** Loopback: only ever the machine the caller is already on. */
const LOOPBACK = /^(?:localhost|127\.\d+\.\d+\.\d+|\[::1\])$/;
/** Addresses that route inside one network and nowhere else. */
const PRIVATE =
  /^(?:10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+|169\.254\.\d+\.\d+|\[f[cd][0-9a-f]{2}:|\[fe[89ab][0-9a-f]:)/i;

/**
 * Whether a host from a request header can be the address a client reached us
 * on. A header is written by whoever is calling, so every value here is either
 * somewhere only this machine or this network can reach — the bind address
 * included, which is exactly what the live defect published — or a bare name
 * no public resolver answers for, such as a proxy's own target or a container.
 */
const publishableHost = (hostname: string): boolean =>
  !UNSPECIFIED.has(hostname) &&
  !LOOPBACK.test(hostname) &&
  !PRIVATE.test(hostname) &&
  (hostname.includes(".") || hostname.startsWith("["));

/**
 * The origin to publish as the API's server: the only origin a client
 * generated from what we publish can call back. `undefined` when there is no
 * trustworthy answer, which leaves the document to name itself relatively —
 * always correct, where a dead absolute address is worse than none.
 *
 * `APP_ORIGIN` comes first because it is the one statement of this that nobody
 * outside the deployment can write. It is the public origin the deployment is
 * reached on: the terraform hands the function the site's own origin when one
 * is configured, and the gateway's own endpoint when none is.
 *
 * Only without it do the forwarded headers speak, and then only when the host
 * they name could really have been used: behind the proxy the process is bound
 * to a private address, so `request.url` is that bind address and the headers
 * are all there is. The request itself is last and may be loopback, because it
 * is the process's own view rather than a caller's claim, and in local
 * development it is already right. Nothing is hardcoded: one image serves
 * local, Compose and the deployment.
 */
export function publicOrigin(request: Request): string | undefined {
  const requestUrl = new URL(request.url);
  const host =
    firstHop(request.headers.get("x-forwarded-host")) ??
    firstHop(request.headers.get("host"));
  const forwardedScheme = firstHop(request.headers.get("x-forwarded-proto"));
  const scheme =
    forwardedScheme === "http" || forwardedScheme === "https"
      ? forwardedScheme
      : requestUrl.protocol.replace(":", "");
  const forwarded = host ? httpOrigin(`${scheme}://${host}`) : undefined;
  return (
    httpOrigin(process.env.APP_ORIGIN) ??
    (forwarded && publishableHost(new URL(forwarded).hostname)
      ? forwarded
      : undefined) ??
    (UNSPECIFIED.has(requestUrl.hostname) ? undefined : requestUrl.origin)
  );
}

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/**
 * Upper bound on live buckets. The limiter must not become the memory sink it
 * exists to prevent: a caller spread across many addresses would otherwise grow
 * this map until the window elapses. Oldest first out, which is also
 * least-recently-started, so an active caller keeps its budget.
 */
export const RATE_LIMIT_MAX_BUCKETS = 10_000;

export type RateLimitOptions = {
  /** Requests allowed per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Distinguishes independent budgets, for example voice versus text. */
  name: string;
};

/**
 * Where the caller's address comes from, which is a property of the deployment
 * and never of the request.
 *
 * "aws-request-context" is production: API Gateway terminates the connection and
 * the Lambda Web Adapter inserts the event's request context as
 * `x-amzn-request-context` before the handler sees it. That insert replaces any
 * copy the caller sent, so it is the only address value here that cannot be
 * forged. `x-forwarded-for` and `x-real-ip` are caller-supplied in this topology
 * and are never read.
 *
 * "shared" is local development and Compose, where no proxy exists, so no
 * address can be established at all. Every caller shares one bucket per limiter
 * name, which is exactly what the previous code already did there under the
 * constant "unknown" key.
 */
type AddressSource = "shared" | "aws-request-context";

const addressSource = (): AddressSource =>
  process.env.RATE_LIMIT_ADDRESS_SOURCE === "aws-request-context"
    ? "aws-request-context"
    : "shared";

const isIpv4 = (value: string): boolean =>
  /^\d{1,3}(\.\d{1,3}){3}$/.test(value) &&
  value.split(".").every((octet) => Number(octet) <= 255);

/**
 * Expands an IPv6 literal to its eight groups, rejecting anything that is not
 * one. The embedded IPv4 form (::ffff:203.0.113.9) is folded into two groups.
 */
function expandIpv6(value: string): string[] | undefined {
  const halves = value.split("::");
  if (halves.length > 2) return undefined;

  const groupsOf = (segment: string): string[] | undefined => {
    if (!segment) return [];
    const groups: string[] = [];
    for (const piece of segment.split(":")) {
      if (piece.includes(".")) {
        const octets = piece.split(".");
        if (octets.length !== 4) return undefined;
        if (
          !octets.every(
            (octet) => /^\d{1,3}$/.test(octet) && Number(octet) <= 255,
          )
        )
          return undefined;
        const numbers = octets.map(Number);
        groups.push(
          (numbers[0] * 256 + numbers[1]).toString(16),
          (numbers[2] * 256 + numbers[3]).toString(16),
        );
        continue;
      }
      if (!/^[0-9A-Fa-f]{1,4}$/.test(piece)) return undefined;
      groups.push(piece);
    }
    return groups;
  };

  const head = groupsOf(halves[0]);
  const tail = halves.length === 2 ? groupsOf(halves[1]) : [];
  if (!head || !tail) return undefined;
  if (halves.length === 1) return head.length === 8 ? head : undefined;
  const elided = 8 - head.length - tail.length;
  if (elided < 1) return undefined;
  return [...head, ...Array<string>(elided).fill("0"), ...tail];
}

/**
 * Turns an address into a bucket key, or undefined when it is not an address.
 * An IPv6 caller is keyed on its /64: a single allocation hands one caller
 * billions of addresses, so per-address buckets would be free to rotate through.
 */
function addressKey(raw: string): string | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  if (isIpv4(value)) return value;
  if (!value.includes(":")) return undefined;
  const groups = expandIpv6(value);
  return groups
    ? groups
        .slice(0, 4)
        .map((group) => parseInt(group, 16).toString(16))
        .join(":") + "::/64"
    : undefined;
}

type RequestContext = {
  http?: { sourceIp?: unknown };
  identity?: { sourceIp?: unknown };
  sourceIp?: unknown;
};

/**
 * The address API Gateway observed, taken only from the header the adapter
 * inserts. A duplicate header arrives joined by a comma and therefore fails to
 * parse, which is the correct outcome: an ambiguous context is no context.
 */
function requestContextAddress(request: Request): string | undefined {
  const raw = request.headers.get("x-amzn-request-context");
  if (!raw) return undefined;
  let context: RequestContext;
  try {
    context = JSON.parse(raw) as RequestContext;
  } catch {
    return undefined;
  }
  if (!context || typeof context !== "object") return undefined;
  const candidate = [
    context.http?.sourceIp,
    context.identity?.sourceIp,
    context.sourceIp,
  ].find((value) => typeof value === "string" && value.trim());
  return typeof candidate === "string" ? addressKey(candidate) : undefined;
}

/** The refusal every limited route returns, whatever the reason for it. */
const rateLimited = (retryAfterMs: number): Response =>
  jsonError(
    "RATE_LIMITED",
    "Too many requests. Wait a moment and try again.",
    429,
    { "Retry-After": String(Math.max(1, Math.ceil(retryAfterMs / 1000))) },
  );

/**
 * A fixed-window limiter over the caller's address. The endpoints behind it
 * spend money on every call and the deployment is public and unauthenticated,
 * so an unbounded caller is a billing incident waiting to happen.
 *
 * It is per-process, which matches the per-process session store, and on Lambda
 * that means per instance: this budget is a floor on the cost of an attack, not
 * a global ceiling. The gateway route throttle in modules/demo is what bounds
 * the total, and a genuinely global per-caller budget needs shared state this
 * deployment does not have.
 *
 * When the address cannot be established in a mode that expects one, the
 * request is refused rather than pooled: collapsing every caller into one bucket
 * would turn a configuration slip into a denial of service for everyone.
 */
export function rateLimit(
  request: Request,
  { limit, windowMs, name }: RateLimitOptions,
): Response | undefined {
  if (process.env.RATE_LIMIT_DISABLED === "true") return undefined;
  const now = Date.now();

  for (const [existing, bucket] of buckets)
    if (bucket.resetAt <= now) buckets.delete(existing);

  const address =
    addressSource() === "shared" ? "shared" : requestContextAddress(request);
  if (!address) return rateLimited(windowMs);
  const key = `${name}:${address}`;

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    // Delete first so the fresh window also refreshes this key's eviction order.
    buckets.delete(key);
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    while (buckets.size > RATE_LIMIT_MAX_BUCKETS) {
      const oldest = buckets.keys().next().value;
      if (oldest === undefined || oldest === key) break;
      buckets.delete(oldest);
    }
    return undefined;
  }
  bucket.count += 1;
  if (bucket.count <= limit) return undefined;

  return rateLimited(bucket.resetAt - now);
}

/** Test seam: clears limiter state between cases. */
export function resetRateLimits(): void {
  buckets.clear();
}

/** Test seam: proves the bucket table stays bounded under key churn. */
export function rateLimitBucketCount(): number {
  return buckets.size;
}
