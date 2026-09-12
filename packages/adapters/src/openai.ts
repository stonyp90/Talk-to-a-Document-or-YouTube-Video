import {
  buildContextInstructions,
  IngestedSource,
} from "@/packages/core/src/domain/ingestion";
import type {
  ConversationPort,
  ConversationTurn,
  CredentialPort,
  RealtimeSession,
} from "../../core/src/application/ports";

export function createConversationAdapter(
  credentials: CredentialPort,
  contextBudget?: number,
): ConversationPort {
  function realtimeSessionConfig(source: IngestedSource) {
    return {
      type: "realtime",
      model: process.env.OPENAI_REALTIME_MODEL ?? "gpt-realtime",
      output_modalities: ["audio"],
      audio: {
        input: {
          // Server-side voice activity detection is what lets the caller cut in
          // mid-answer; the client stops its own captions on the same event.
          turn_detection: { type: "server_vad" },
          transcription: { model: "gpt-4o-mini-transcribe" },
        },
      },
      instructions: buildContextInstructions(source, contextBudget),
    };
  }

  async function createRealtimeSession(
    source: IngestedSource,
  ): Promise<RealtimeSession> {
    const mode = process.env.PROVIDER_MODE ?? "mock";
    const config = realtimeSessionConfig(source);
    if (mode === "mock") {
      return {
        mode: "mock",
        clientSecret: `mock_${crypto.randomUUID()}`,
        expiresAt: Date.now() + 60 * 60 * 1000,
        model: config.model,
        instructions: config.instructions,
      };
    }
    const apiKey = await credentials.getKey();
    if (!apiKey) throw new Error("OpenAI is not configured on the server.");
    const response = await fetch(
      `${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/realtime/client_secrets`,
      {
        signal: AbortSignal.timeout(20000),
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ session: config }),
      },
    );
    if (!response.ok)
      throw new Error(`OpenAI session setup failed (${response.status}).`);
    const payload = (await response.json()) as {
      value?: string;
      expires_at?: number;
    };
    if (!payload.value)
      throw new Error("OpenAI did not return an ephemeral client secret.");
    return {
      mode: "live",
      clientSecret: payload.value,
      expiresAt: payload.expires_at
        ? payload.expires_at * 1000
        : Date.now() + 60 * 1000,
      model: config.model,
      instructions: config.instructions,
    };
  }

  async function createRealtimeCallAnswer(
    sdp: string,
    source: IngestedSource,
  ): Promise<string> {
    const apiKey = await credentials.getKey();
    if (!apiKey) throw new Error("OpenAI is not configured on the server.");
    const form = new FormData();
    form.append(
      "sdp",
      new Blob([sdp], { type: "application/sdp" }),
      "offer.sdp",
    );
    form.append(
      "session",
      new Blob([JSON.stringify(realtimeSessionConfig(source))], {
        type: "application/json",
      }),
      "session.json",
    );
    const response = await fetch(
      `${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/realtime/calls`,
      {
        signal: AbortSignal.timeout(20000),
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form,
      },
    );
    if (!response.ok)
      throw new Error(`OpenAI WebRTC setup failed (${response.status}).`);
    return response.text();
  }

  const demoAnswer = (source: IngestedSource) =>
    `Local demo response: I found this source context relevant to your question: ${source.text.slice(0, 180)}${source.text.length > 180 ? "…" : ""}`;

  /** The one request shape both text paths send, streamed or not. */
  const textRequestBody = (
    source: IngestedSource,
    question: string,
    history?: ConversationTurn[],
  ) => ({
    model: process.env.OPENAI_TEXT_MODEL ?? "gpt-4.1-mini",
    instructions: buildContextInstructions(source, contextBudget),
    input: [
      ...(history ?? []).map((turn) => ({
        role: turn.role,
        content: turn.text,
      })),
      { role: "user", content: question },
    ],
  });

  async function answerTextQuestion(
    source: IngestedSource,
    question: string,
    history?: ConversationTurn[],
  ): Promise<string> {
    if ((process.env.PROVIDER_MODE ?? "mock") === "mock")
      return demoAnswer(source);
    const apiKey = await credentials.getKey();
    if (!apiKey) throw new Error("OpenAI is not configured on the server.");
    const response = await fetch(
      `${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/responses`,
      {
        signal: AbortSignal.timeout(20000),
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(textRequestBody(source, question, history)),
      },
    );
    if (!response.ok)
      throw new Error(`OpenAI text response failed (${response.status}).`);
    const payload = (await response.json()) as {
      output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
    };
    const text = payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!text) throw new Error("The provider returned no text. Please retry.");
    return text;
  }

  /**
   * Streaming is not one request and one reply: the connection stays open for
   * as long as the model keeps writing, so the 20 s budget that bounds the
   * other calls would cut a long answer off mid-sentence. This is a deadline
   * for the whole stream rather than for the first byte, generous enough for a
   * full answer and still finite, so a wedged connection cannot pin a worker.
   */
  const streamTimeoutMs = () =>
    Number(process.env.OPENAI_STREAM_TIMEOUT_MS ?? 120_000);

  async function* streamMockAnswer(
    source: IngestedSource,
  ): AsyncGenerator<string> {
    const answer = demoAnswer(source);
    const size = Number(process.env.OPENAI_MOCK_STREAM_CHUNK_CHARACTERS) || 24;
    // Zero by default: the local demo should feel instant and the suites fast.
    const delay = Number(process.env.OPENAI_STREAM_CHUNK_DELAY_MS) || 0;
    for (let at = 0; at < answer.length; at += size) {
      if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      yield answer.slice(at, at + size);
    }
  }

  /**
   * Reads the `data:` payloads of one complete SSE frame. A payload that does
   * not parse is skipped rather than fatal: the frame boundary is already
   * known, so a single malformed event should not end a usable answer.
   */
  function frameEvents(frame: string): Array<Record<string, unknown>> {
    return frame
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice("data:".length).trim())
      .filter((payload) => payload && payload !== "[DONE]")
      .flatMap((payload) => {
        try {
          return [JSON.parse(payload) as Record<string, unknown>];
        } catch {
          return [];
        }
      });
  }

  async function* streamLiveAnswer(
    source: IngestedSource,
    question: string,
    history?: ConversationTurn[],
  ): AsyncGenerator<string> {
    const apiKey = await credentials.getKey();
    if (!apiKey) throw new Error("OpenAI is not configured on the server.");
    const response = await fetch(
      `${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/responses`,
      {
        signal: AbortSignal.timeout(streamTimeoutMs()),
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          ...textRequestBody(source, question, history),
          stream: true,
        }),
      },
    );
    if (!response.ok || !response.body)
      throw new Error(`OpenAI text stream failed (${response.status}).`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // A frame is only complete at a blank line; the network splits payloads
        // wherever it likes, including halfway through a JSON event.
        let boundary = buffer.indexOf("\n\n");
        while (boundary !== -1) {
          const frame = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          for (const event of frameEvents(frame)) {
            if (event.type === "response.output_text.delta") {
              if (typeof event.delta === "string" && event.delta)
                yield event.delta;
            } else if (event.type === "response.completed") {
              return;
            } else if (
              event.type === "response.failed" ||
              event.type === "error"
            ) {
              // Provider text can name models and account state, so the reason
              // stays in the log and the reader gets a safe sentence.
              console.error("[openai] stream event", event.type);
              throw new Error(
                "The provider could not complete the answer. Please retry.",
              );
            }
          }
          boundary = buffer.indexOf("\n\n");
        }
      }
    } finally {
      // Closes the connection when the reader stops early, so an abandoned
      // answer is not still being paid for.
      await reader.cancel().catch(() => undefined);
    }
  }

  function streamTextAnswer(
    source: IngestedSource,
    question: string,
    history?: ConversationTurn[],
  ): AsyncIterable<string> {
    return (process.env.PROVIDER_MODE ?? "mock") === "mock"
      ? streamMockAnswer(source)
      : streamLiveAnswer(source, question, history);
  }

  return {
    createRealtimeSession,
    createRealtimeCallAnswer,
    answerTextQuestion,
    streamTextAnswer,
  };
}
