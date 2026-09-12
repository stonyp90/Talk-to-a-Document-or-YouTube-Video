import { describe, expect, it } from "vitest";
import {
  VOICE_SAMPLE_LIMITS,
  consentLanguage,
  consentPhrase,
  createVoiceEnrollment,
} from "./voiceEnrollment";

describe("the words a speaker must say to lend their voice", () => {
  it("gives the provider's exact English consent sentence", () => {
    expect(consentPhrase("en")).toBe(
      "I am the owner of this voice and I consent to OpenAI using this voice to create a synthetic voice model.",
    );
  });

  it("gives the French sentence for a French speaker", () => {
    expect(consentPhrase("fr")).toBe(
      "Je suis le propriétaire de cette voix et j'autorise OpenAI à utiliser cette voix pour créer un modèle de voix synthétique.",
    );
  });

  it("reads a regional tag as its language", () => {
    expect(consentLanguage("fr-CA")).toBe("fr");
    expect(consentLanguage("EN_us")).toBe("en");
  });

  it("refuses a language whose exact phrase it does not know, rather than guessing one", () => {
    expect(consentLanguage("kl")).toBeUndefined();
    expect(() => consentPhrase("kl")).toThrow(/consent phrase/i);
  });

  it("states the sample limits the provider enforces", () => {
    expect(VOICE_SAMPLE_LIMITS.maximumSeconds).toBe(30);
    expect(VOICE_SAMPLE_LIMITS.minimumSpeechSeconds).toBe(5);
    expect(VOICE_SAMPLE_LIMITS.maximumBytes).toBe(10 * 1024 * 1024);
  });
});

describe("enrolling a voice with the provider", () => {
  const recording = new Uint8Array([1, 2, 3]);

  function stubFetch() {
    const calls: { url: string; body: FormData; authorization?: string }[] = [];
    const fetcher = async (url: string, init: RequestInit) => {
      calls.push({
        url,
        body: init.body as FormData,
        authorization:
          new Headers(init.headers).get("Authorization") ?? undefined,
      });
      return new Response(
        JSON.stringify(
          url.endsWith("/voice_consents")
            ? { id: "cons_123" }
            : { id: "voice_456" },
        ),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    };
    return { calls, fetcher };
  }

  it("records consent and then the sample, and returns the voice identifier", async () => {
    const { calls, fetcher } = stubFetch();
    const enrollment = createVoiceEnrollment(
      { getKey: async () => "sk-test" },
      { fetcher, baseUrl: "https://provider.test" },
    );
    const voice = await enrollment.enroll({
      name: "founder",
      language: "fr",
      consentRecording: { bytes: recording, filename: "consent.wav" },
      sample: { bytes: recording, filename: "sample.wav" },
    });

    expect(voice).toEqual({ id: "voice_456", consentId: "cons_123" });
    expect(calls.map((call) => call.url)).toEqual([
      "https://provider.test/v1/audio/voice_consents",
      "https://provider.test/v1/audio/voices",
    ]);
    expect(calls[0].authorization).toBe("Bearer sk-test");
    expect(calls[0].body.get("language")).toBe("fr");
    expect(calls[0].body.get("name")).toBe("founder-consent");
    expect(calls[1].body.get("consent")).toBe("cons_123");
    expect(calls[1].body.get("name")).toBe("founder");
  });

  it("explains a rejected enrollment instead of leaking the response body", async () => {
    const enrollment = createVoiceEnrollment(
      { getKey: async () => "sk-test" },
      {
        fetcher: async () => new Response("sk-test leaked", { status: 400 }),
        baseUrl: "https://provider.test",
      },
    );
    await expect(
      enrollment.enroll({
        name: "founder",
        language: "en",
        consentRecording: { bytes: recording, filename: "consent.wav" },
        sample: { bytes: recording, filename: "sample.wav" },
      }),
    ).rejects.toThrow(/consent recording was refused \(400\)/i);
  });

  it("will not start without a server key", async () => {
    const enrollment = createVoiceEnrollment(
      { getKey: async () => "" },
      {
        fetcher: async () => new Response("{}"),
        baseUrl: "https://provider.test",
      },
    );
    await expect(
      enrollment.enroll({
        name: "founder",
        language: "en",
        consentRecording: { bytes: recording, filename: "consent.wav" },
        sample: { bytes: recording, filename: "sample.wav" },
      }),
    ).rejects.toThrow(/not configured/i);
  });
});
