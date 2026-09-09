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

  async function answerTextQuestion(
    source: IngestedSource,
    question: string,
    history?: ConversationTurn[],
  ): Promise<string> {
    if ((process.env.PROVIDER_MODE ?? "mock") === "mock") {
      return `Local demo response: I found this source context relevant to your question: ${source.text.slice(0, 180)}${source.text.length > 180 ? "…" : ""}`;
    }
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
        body: JSON.stringify({
          model: process.env.OPENAI_TEXT_MODEL ?? "gpt-4.1-mini",
          instructions: buildContextInstructions(source, contextBudget),
          input: [
            ...(history ?? []).map((turn) => ({
              role: turn.role,
              content: turn.text,
            })),
            { role: "user", content: question },
          ],
        }),
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

  return {
    createRealtimeSession,
    createRealtimeCallAnswer,
    answerTextQuestion,
  };
}
