import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api";
import { streamAnswer } from "./streamAnswer";

const encoder = new TextEncoder();

/** A response whose body arrives in the given pieces, split wherever we like. */
function streamed(pieces: string[], status = 200): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      pieces.forEach((piece) => controller.enqueue(encoder.encode(piece)));
      controller.close();
    },
  });
  return new Response(body, {
    status,
    headers: { "content-type": "text/event-stream" },
  });
}

const frame = (payload: unknown) => `data: ${JSON.stringify(payload)}\n\n`;

afterEach(() => vi.unstubAllGlobals());

describe("streamAnswer", () => {
  it("reports every delta in order and returns the finished answer", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamed([
            frame({ type: "delta", text: "Hel" }),
            frame({ type: "delta", text: "lo" }),
            frame({ type: "done", answer: "Hello", sourceId: "abc" }),
          ]),
        ),
    );
    const deltas: string[] = [];
    const result = await streamAnswer(
      "/api/text-chat/stream",
      { question: "hi" },
      (text) => deltas.push(text),
      new AbortController().signal,
    );
    expect(deltas).toEqual(["Hel", "lo"]);
    expect(result).toEqual({ answer: "Hello", sourceId: "abc" });
  });

  it("reassembles a frame split across two network chunks", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamed([
            'data: {"type":"delta","te',
            'xt":"whole"}\n\n' + frame({ type: "done", answer: "whole" }),
          ]),
        ),
    );
    const deltas: string[] = [];
    await streamAnswer(
      "/api/text-chat/stream",
      {},
      (text) => deltas.push(text),
      new AbortController().signal,
    );
    expect(deltas).toEqual(["whole"]);
  });

  it("falls back to the accumulated text when the stream ends without a done frame", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamed([frame({ type: "delta", text: "partial" })]),
        ),
    );
    await expect(
      streamAnswer(
        "/api/text-chat/stream",
        {},
        () => {},
        new AbortController().signal,
      ),
    ).resolves.toEqual({ answer: "partial", sourceId: undefined });
  });

  it("raises the server's error frame as a readable failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamed([
            frame({ type: "delta", text: "a" }),
            frame({
              type: "error",
              error: "Provider refused.",
              code: "UPSTREAM",
            }),
          ]),
        ),
    );
    await expect(
      streamAnswer(
        "/api/text-chat/stream",
        {},
        () => {},
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "UPSTREAM", message: "Provider refused." });
  });

  it("raises the rejection body when the request never becomes a stream", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: "Sign in first.", code: "UNAUTHENTICATED" }),
          {
            status: 401,
            headers: { "content-type": "application/json" },
          },
        ),
      ),
    );
    await expect(
      streamAnswer(
        "/api/text-chat/stream",
        {},
        () => {},
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  });

  it("asks the caller to fall back when the runtime gives no readable body", async () => {
    const response = new Response(null, { status: 200 });
    Object.defineProperty(response, "body", { value: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));
    await expect(
      streamAnswer(
        "/api/text-chat/stream",
        {},
        () => {},
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: "STREAM_UNSUPPORTED" });
  });

  it("keeps the partial answer on the error it throws when the reader is cancelled", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(() => {
        controller.abort();
        return Promise.resolve(
          streamed([frame({ type: "delta", text: "cut" })]),
        );
      }),
    );
    await expect(
      streamAnswer("/api/text-chat/stream", {}, () => {}, controller.signal),
    ).rejects.toBeInstanceOf(DOMException);
  });

  it("ignores comment and blank lines a proxy may inject to keep the pipe warm", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          streamed([
            ": keep-alive\n\n",
            frame({ type: "delta", text: "ok" }),
            "\n\n",
            frame({ type: "done", answer: "ok" }),
          ]),
        ),
    );
    const deltas: string[] = [];
    await streamAnswer(
      "/api/text-chat/stream",
      {},
      (text) => deltas.push(text),
      new AbortController().signal,
    );
    expect(deltas).toEqual(["ok"]);
  });

  it("reports a transport failure as a network error the reader can act on", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );
    await expect(
      streamAnswer(
        "/api/text-chat/stream",
        {},
        () => {},
        new AbortController().signal,
      ),
    ).rejects.toBeInstanceOf(ApiError);
  });
});
