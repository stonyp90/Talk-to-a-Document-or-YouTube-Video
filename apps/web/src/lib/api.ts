import type { IngestedSource } from "@/packages/core/src/domain/ingestion";

export type ContextUsage = {
  usedCharacters: number;
  totalCharacters: number;
  truncated: boolean;
};

export type SourceEnvelope = {
  source: IngestedSource;
  sourceId: string;
  context: ContextUsage;
};

export type RealtimeCredential = {
  mode: "mock" | "live";
  clientSecret?: string;
  expiresAt?: number;
  model?: string;
  sourceId: string;
};

export type Health = {
  mode?: string;
  directUpload?: boolean;
  contextCharacterBudget?: number;
};

/** An error the interface can explain, carrying the server's machine-readable code. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);
const BASE_BACKOFF_MS = 400;

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Request cancelled", "AbortError"));
      },
      { once: true },
    );
  });

/**
 * A JSON call that survives a bad minute of mobile network. Transient transport
 * failures and 5xx replies are retried with exponential backoff; anything the
 * caller could fix, such as a rejected file, fails immediately.
 */
export async function requestJson<T>(
  input: string,
  init: RequestInit & { retries?: number } = {},
): Promise<T> {
  const { retries = 2, ...request } = init;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (attempt > 0)
      await wait(
        BASE_BACKOFF_MS * 2 ** (attempt - 1),
        request.signal ?? undefined,
      );
    try {
      const response = await fetch(input, request);
      // An endpoint that deliberately answers nothing, such as a request for a
      // sign-in code, still succeeded. Parsing its empty body would not.
      if (response.status === 204) return undefined as T;
      if (response.ok) return (await response.json()) as T;

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      const error = new ApiError(
        payload.error ?? "The server could not complete this request.",
        payload.code ?? "REQUEST_FAILED",
        response.status,
      );
      if (!RETRYABLE_STATUS.has(response.status) || attempt === retries)
        throw error;
      lastError = error;
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === "AbortError")
        throw caught;
      if (caught instanceof ApiError && !RETRYABLE_STATUS.has(caught.status))
        throw caught;
      if (attempt === retries)
        throw caught instanceof ApiError
          ? caught
          : new ApiError(
              "We could not reach the server. Check your connection and retry.",
              "NETWORK_ERROR",
              0,
            );
      lastError = caught;
    }
  }
  throw lastError;
}

/**
 * Sends a large PDF straight to object storage and reports progress, because a
 * 25 MB upload on a slow connection is a long silence otherwise.
 */
export function uploadWithProgress(
  url: string,
  fields: Record<string, string>,
  file: File,
  onProgress: (fraction: number) => void,
  signal: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    form.append("file", file);

    const request = new XMLHttpRequest();
    request.open("POST", url);
    // A presigned object-store request can hang indefinitely when a local
    // object store restarts or a browser blocks its CORS preflight. Keep the
    // ingestion flow recoverable: the caller can fall back to multipart.
    request.timeout = 18_000;
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    request.onload = () =>
      request.status >= 200 && request.status < 300
        ? resolve()
        : reject(
            new ApiError(
              "The upload did not complete. Please try again.",
              "UPLOAD_FAILED",
              request.status,
            ),
          );
    request.onerror = () =>
      reject(
        new ApiError(
          "The upload was interrupted. Check your connection and retry.",
          "NETWORK_ERROR",
          0,
        ),
      );
    request.ontimeout = () =>
      reject(
        new ApiError(
          "The upload took too long. We will retry it through a safer path.",
          "UPLOAD_TIMEOUT",
          408,
        ),
      );
    request.onabort = () =>
      reject(new DOMException("Upload cancelled", "AbortError"));
    signal.addEventListener("abort", () => request.abort(), { once: true });
    request.send(form);
  });
}
