import {
  recordTurns,
  resolveSession,
  streamTextAnswer,
} from "@/apps/web/src/composition";
import {
  errorResponse,
  jsonError,
  rateLimit,
  type ApiError,
} from "@/apps/web/src/http";
import {
  textChatSchema,
  type TextChatStreamFrame,
} from "@/apps/web/src/validation";
import { guard, unitsFor } from "@/apps/web/src/auth";

const FALLBACK_MESSAGE = "The answer could not be produced. Please retry.";

/** Same budget and family as the blocking route: one question is one question. */
const limits = () => ({
  name: "text-chat",
  limit: Number(process.env.TEXT_CHAT_RATE_LIMIT) || 30,
  windowMs: Number(process.env.TEXT_CHAT_RATE_WINDOW_MS) || 60_000,
});

type Prepared = {
  session: Awaited<ReturnType<typeof resolveSession>>;
  question: string;
  deltas: AsyncIterable<string>;
};

/**
 * Everything that can still be answered in JSON happens here. Once the event
 * stream opens the status line is already sent and the client has committed to
 * reading frames, so a late failure can no longer be a fallback signal.
 */
async function prepare(request: Request): Promise<Response | Prepared> {
  try {
    const parsed = textChatSchema.safeParse(await request.json());
    if (!parsed.success)
      return jsonError(
        "INVALID_QUESTION",
        "Provide a source and a question of at most 4,000 characters.",
        400,
      );
    const { question, ...reference } = parsed.data;
    const session = await resolveSession(reference);
    return {
      session,
      question,
      deltas: streamTextAnswer(session.source, question, session.turns),
    };
  } catch (error) {
    return errorResponse(error, FALLBACK_MESSAGE);
  }
}

export async function POST(request: Request) {
  const limited = rateLimit(request, limits());
  if (limited) return limited;
  // The gate runs before the stream opens. Once the event stream has a status
  // line the client has committed to reading frames, and a refusal can no
  // longer be an ordinary JSON 401 or 429 it knows how to act on.
  const account = await guard(request, { units: unitsFor("textChat") });
  if (account instanceof Response) return account;

  const prepared = await prepare(request);
  if (prepared instanceof Response) return prepared;
  const { session, question, deltas } = prepared;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (frame: TextChatStreamFrame) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(frame)}\n\n`),
          );
        } catch {
          // The reader is gone; there is nobody left to tell.
        }
      };
      let answer = "";
      try {
        for await (const delta of deltas) {
          if (request.signal.aborted) break;
          answer += delta;
          send({ type: "delta", text: delta });
        }
        if (!request.signal.aborted)
          send({ type: "done", answer, sourceId: session.id });
      } catch (error) {
        const payload = (await errorResponse(
          error,
          FALLBACK_MESSAGE,
        ).json()) as ApiError;
        send({ type: "error", error: payload.error, code: payload.code });
      } finally {
        // A disconnect still leaves the deltas already written on the reader's
        // screen, so they are recorded as real history. Dropping them would let
        // a typed follow-up contradict an answer the reader can still see.
        if (answer)
          await recordTurns(session.id, [
            { role: "user", text: question },
            { role: "assistant", text: answer },
          ]).catch((error) => console.error("[api] text-chat stream", error));
        try {
          controller.close();
        } catch {
          // Already closed by a client that walked away.
        }
      }
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      // Proxies that buffer a response would hold the whole answer back and
      // hand the reader the spinner this endpoint exists to remove.
      "X-Accel-Buffering": "no",
    },
  });
}
