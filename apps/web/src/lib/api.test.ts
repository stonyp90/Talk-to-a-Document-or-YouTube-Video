import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, requestJson } from "./api";

const ok = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
const failure = (status: number, body: unknown = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

afterEach(() => vi.unstubAllGlobals());

describe("requestJson", () => {
  it("returns the parsed body on the first success", async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok({ answer: "42" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      requestJson<{ answer: string }>("/api/text-chat"),
    ).resolves.toEqual({
      answer: "42",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("treats an empty success as a success, not as an unreadable body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      requestJson("/api/auth/request-code"),
    ).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a transient server failure and then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(failure(503))
      .mockResolvedValueOnce(ok({ answer: "42" }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestJson("/api/text-chat")).resolves.toEqual({
      answer: "42",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a dropped connection", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(ok({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestJson("/api/health")).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("never retries a rejection the caller has to fix", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        failure(400, {
          error: "Please upload a PDF file.",
          code: "INVALID_FILE_TYPE",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    await expect(requestJson("/api/ingest")).rejects.toMatchObject({
      code: "INVALID_FILE_TYPE",
      status: 400,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces an expired session so the caller can resend the source", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          failure(409, { error: "Send it again.", code: "SOURCE_EXPIRED" }),
        ),
    );
    await expect(requestJson("/api/text-chat")).rejects.toMatchObject({
      code: "SOURCE_EXPIRED",
    });
  });

  it("gives up after the retry budget and reports a network problem", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    const error = await requestJson("/api/health", { retries: 1 }).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe("NETWORK_ERROR");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("stops immediately when the caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new DOMException("aborted", "AbortError")),
    );
    await expect(
      requestJson("/api/health", { signal: controller.signal }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });
});
