import type { CredentialPort } from "../../core/src/application/ports";

/** Transcription only: no source, generated replies, or executable model tools. */
export async function createCommandSpeechSession(
  credentials: CredentialPort,
  language: "en" | "fr",
  signal?: AbortSignal,
) {
  const key = await credentials.getKey();
  const response = await fetch(
    `${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/realtime/client_secrets`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.any([
        AbortSignal.timeout(15000),
        ...(signal ? [signal] : []),
      ]),
      body: JSON.stringify({
        expires_after: { anchor: "created_at", seconds: 60 },
        session: {
          type: "transcription",
          audio: {
            input: {
              noise_reduction: { type: "near_field" },
              transcription: {
                model:
                  process.env.OPENAI_TRANSCRIBE_MODEL ??
                  "gpt-4o-mini-transcribe",
                language,
                prompt:
                  "Ursly commands: upload, YouTube, summarize, next, back, cancel, let's talk. Transcribe the words actually spoken, including questions.",
              },
              turn_detection: {
                type: "server_vad",
                threshold: 0.5,
                prefix_padding_ms: 300,
                silence_duration_ms: 650,
              },
            },
          },
        },
      }),
    },
  );
  if (!response.ok)
    throw new Error(`Speech session unavailable (${response.status}).`);
  const body = (await response.json()) as {
    value?: string;
    expires_at?: number;
  };
  if (!body.value || !body.expires_at || body.expires_at * 1000 <= Date.now())
    throw new Error(
      "Speech session did not return a valid temporary credential.",
    );
  return { clientSecret: body.value, expiresAt: body.expires_at * 1000 };
}
