import { ApiError } from "./api";

/**
 * Reads a server-sent answer as it is written. A whole answer can take many
 * seconds to compose, and a reader who watches the words arrive is willing to
 * wait for them; a reader who watches a spinner is not.
 *
 * Every failure it raises is an `ApiError` the interface can explain, except a
 * cancellation, which stays a `DOMException` so the caller can tell a stop from
 * a fault. `STREAM_UNSUPPORTED` is the signal to retry the plain JSON endpoint.
 */

type ServerFrame =
  | { type: "delta"; text?: string }
  | { type: "done"; answer?: string; sourceId?: string }
  | { type: "error"; error?: string; code?: string };

export type StreamedAnswer = { answer: string; sourceId?: string };

const FRAME_SEPARATOR = /\n\n/;

function parseFrame(block: string): ServerFrame | undefined {
  const payload = block
    .split("\n")
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("");
  if (!payload) return undefined;
  try {
    const parsed: unknown = JSON.parse(payload);
    return parsed && typeof parsed === "object"
      ? (parsed as ServerFrame)
      : undefined;
  } catch {
    return undefined;
  }
}

export async function streamAnswer(
  url: string,
  body: unknown,
  onDelta: (text: string) => void,
  signal: AbortSignal,
): Promise<StreamedAnswer> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (caught) {
    if (caught instanceof DOMException && caught.name === "AbortError")
      throw caught;
    throw new ApiError(
      "We could not reach the server. Check your connection and retry.",
      "NETWORK_ERROR",
      0,
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      error?: string;
      code?: string;
    };
    throw new ApiError(
      payload.error ?? "The server could not answer this question.",
      payload.code ?? "REQUEST_FAILED",
      response.status,
    );
  }

  // An old runtime, or a proxy that buffers the whole body, leaves nothing to
  // read incrementally. The caller has a non-streaming endpoint for that case.
  if (!response.body)
    throw new ApiError(
      "This connection cannot stream an answer.",
      "STREAM_UNSUPPORTED",
      response.status,
    );

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let answer = "";
  let sourceId: string | undefined;

  const handle = (frame: ServerFrame): boolean => {
    if (frame.type === "delta" && frame.text) {
      answer += frame.text;
      onDelta(frame.text);
      return false;
    }
    if (frame.type === "done") {
      answer = frame.answer ?? answer;
      sourceId = frame.sourceId;
      return true;
    }
    if (frame.type === "error")
      throw new ApiError(
        frame.error ?? "The answer could not be produced.",
        frame.code ?? "STREAM_FAILED",
        200,
      );
    return false;
  };

  try {
    for (;;) {
      // A stop is not a fault. The caller keeps the words already rendered and
      // tells them apart from a failure by the kind of error raised here.
      if (signal.aborted)
        throw new DOMException("Answer cancelled", "AbortError");
      const { done, value } = await reader.read();
      if (value) buffer += decoder.decode(value, { stream: true });
      let separator = buffer.search(FRAME_SEPARATOR);
      while (separator >= 0) {
        const block = buffer.slice(0, separator);
        buffer = buffer.slice(separator + 2);
        const frame = parseFrame(block);
        if (frame && handle(frame)) return { answer, sourceId };
        separator = buffer.search(FRAME_SEPARATOR);
      }
      if (done) break;
    }
    const trailing = parseFrame(buffer);
    if (trailing) handle(trailing);
    // A stream that ends without its closing frame still delivered words the
    // reader watched appear; keeping them beats replacing them with an error.
    return { answer, sourceId };
  } finally {
    await reader.cancel().catch(() => {});
  }
}
