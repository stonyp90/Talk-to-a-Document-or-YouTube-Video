import type {
  CredentialPort,
  EnrolledVoice,
  VoiceEnrollmentPort,
  VoiceEnrollmentRequest,
  VoiceRecording,
} from "../../core/src/application/ports";

/**
 * Answering in a particular person's voice is not something a caller can ask
 * for by speaking to the application: the provider mints a voice from two
 * recordings, a consent sentence and a speech sample, and only then hands back
 * an identifier the realtime session can select. The consent sentence is fixed
 * by the provider, word for word, per language.
 */
export const VOICE_CONSENT_PHRASES: Readonly<Record<string, string>> = {
  de: "Ich bin der Eigentümer dieser Stimme und bin damit einverstanden, dass OpenAI diese Stimme zur Erstellung eines synthetischen Stimmmodells verwendet.",
  en: "I am the owner of this voice and I consent to OpenAI using this voice to create a synthetic voice model.",
  es: "Soy el propietario de esta voz y doy mi consentimiento para que OpenAI la utilice para crear un modelo de voz sintética.",
  fr: "Je suis le propriétaire de cette voix et j'autorise OpenAI à utiliser cette voix pour créer un modèle de voix synthétique.",
  it: "Sono il proprietario di questa voce e acconsento che OpenAI la utilizzi per creare un modello di voce sintetica.",
  nl: "Ik ben de eigenaar van deze stem en ik geef OpenAI toestemming om deze stem te gebruiken om een synthetisch stemmodel te maken.",
  pt: "Eu sou o proprietário desta voz e autorizo o OpenAI a usá-la para criar um modelo de voz sintética.",
};

/** What the provider accepts for the sample, stated where the CLI can quote it. */
export const VOICE_SAMPLE_LIMITS = {
  minimumSpeechSeconds: 5,
  idealSeconds: { from: 10, to: 30 },
  maximumSeconds: 30,
  maximumBytes: 10 * 1024 * 1024,
  formats: ["wav", "mp3", "ogg", "aac", "flac", "webm", "mp4"],
} as const;

const MEDIA_TYPES: Readonly<Record<string, string>> = {
  wav: "audio/x-wav",
  mp3: "audio/mpeg",
  mpeg: "audio/mpeg",
  ogg: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  webm: "audio/webm",
  mp4: "audio/mp4",
  m4a: "audio/mp4",
};

/** The language of a tag such as `fr-CA`, when its exact phrase is known. */
export function consentLanguage(tag: string): string | undefined {
  const language = tag.trim().toLowerCase().split(/[-_]/)[0];
  return language && language in VOICE_CONSENT_PHRASES ? language : undefined;
}

export function consentPhrase(tag: string): string {
  const language = consentLanguage(tag);
  if (!language)
    throw new Error(
      `No approved consent phrase is known for "${tag}". Use one of: ${Object.keys(VOICE_CONSENT_PHRASES).join(", ")}.`,
    );
  return VOICE_CONSENT_PHRASES[language];
}

function mediaType(filename: string): string {
  const extension = filename.split(".").pop()?.toLowerCase() ?? "";
  return MEDIA_TYPES[extension] ?? "application/octet-stream";
}

function blobOf(recording: VoiceRecording): Blob {
  // A copy keeps the Blob independent of the caller's buffer, which a CLI may
  // reuse while streaming the next file.
  return new Blob([new Uint8Array(recording.bytes)], {
    type: mediaType(recording.filename),
  });
}

type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export function createVoiceEnrollment(
  credentials: CredentialPort,
  options: { fetcher?: Fetcher; baseUrl?: string } = {},
): VoiceEnrollmentPort {
  const fetcher = options.fetcher ?? ((url, init) => fetch(url, init));
  const baseUrl = (
    options.baseUrl ??
    process.env.OPENAI_BASE_URL ??
    "https://api.openai.com"
  ).replace(/\/+$/, "");

  async function post(
    path: string,
    body: FormData,
    apiKey: string,
    refusal: string,
  ): Promise<string> {
    const response = await fetcher(`${baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body,
    });
    // The provider echoes request fields on failure, so only its status is
    // reported: a recording path or a key must never reach a log.
    if (!response.ok) throw new Error(`${refusal} (${response.status}).`);
    const payload = (await response.json()) as { id?: string };
    if (!payload.id) throw new Error(`${refusal} (no identifier returned).`);
    return payload.id;
  }

  async function enroll(
    request: VoiceEnrollmentRequest,
  ): Promise<EnrolledVoice> {
    const language = consentLanguage(request.language);
    if (!language) consentPhrase(request.language);
    const apiKey = await credentials.getKey();
    if (!apiKey) throw new Error("OpenAI is not configured on the server.");

    const consentForm = new FormData();
    consentForm.append("name", `${request.name}-consent`);
    consentForm.append("language", language as string);
    consentForm.append(
      "recording",
      blobOf(request.consentRecording),
      request.consentRecording.filename,
    );
    const consentId = await post(
      "/v1/audio/voice_consents",
      consentForm,
      apiKey,
      "The consent recording was refused",
    );

    const voiceForm = new FormData();
    voiceForm.append("name", request.name);
    voiceForm.append("consent", consentId);
    voiceForm.append(
      "audio_sample",
      blobOf(request.sample),
      request.sample.filename,
    );
    const id = await post(
      "/v1/audio/voices",
      voiceForm,
      apiKey,
      "The voice sample was refused",
    );
    return { id, consentId };
  }

  return { enroll };
}
