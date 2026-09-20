/**
 * The Slack bot as an inbound adapter.
 *
 * Every transport the product speaks through — HTTP, WebSocket, Slack, voice,
 * eventually smell — is a bridge to the same human. The Slack bot reads
 * messages, scores the sender's identity, and answers in kind.
 */
import { App } from "@slack/bolt";
import type {
  IdentityProfile,
  InteractionSignal,
} from "../../../packages/core/src/domain/identityScore";
import {
  createProfile,
  formatIdentitySummary,
  processSignal,
} from "../../../packages/core/src/domain/identityScore";
import { getOpenAiKey } from "../../../packages/adapters/src/secrets";

const BRIDGE_INTRO_EN = [
  "*I am Ursly — a bridge.*",
  "",
  "Digital identity is not a password. It is the pattern you leave by being yourself: how you ask, what you care about, the way you think.",
  "",
  "Every message you send here shapes how I recognize you. No credentials. No login. Just the fingerprint of who you are.",
  "",
  "Talk to me. Ask anything. I will learn who you are as we go.",
].join("\n");

const BRIDGE_INTRO_FR = [
  "*Je suis Ursly — un pont.*",
  "",
  "L'identité numérique n'est pas un mot de passe. C'est l'empreinte de qui vous êtes : comment vous posez des questions, ce qui vous intéresse, votre façon de penser.",
  "",
  "Chaque message que vous envoyez ici façonne la façon dont je vous reconnais. Pas d'identifiants. Pas de connexion. Juste l'empreinte de qui vous êtes.",
  "",
  "Parlez-moi. Posez n'importe quelle question. J'apprends qui vous êtes au fil de notre échange.",
].join("\n");

const IDENTITY_HEADER_EN = "*Your identity fingerprint:*";
const IDENTITY_HEADER_FR = "*Votre empreinte identitaire :*";

type SlackDeps = {
  app: App;
  logFailure?: (error: unknown) => void;
};

export function createSlackBot({
  app,
  logFailure = (error: unknown) => console.error("[slack-bot]", error),
}: SlackDeps) {
  const profiles = new Map<string, IdentityProfile>();
  let botIdCache: string | undefined;

  function getOrCreateProfile(userId: string): IdentityProfile {
    let profile = profiles.get(userId);
    if (!profile) {
      profile = createProfile(userId);
      profiles.set(userId, profile);
    }
    return profile;
  }

  function classifySignal(text: string): InteractionSignal["kind"] {
    const trimmed = text.trim();
    if (trimmed.startsWith("/")) return "command";
    if (
      /[?？]$/.test(trimmed) ||
      /^(what|how|why|when|where|who|can|could|would|should|is|are|do|does|quel|comment|pourquoi|quand|où|qui|est|sont|peux|que|quoi|什么|怎么|为什么|如何)/i.test(
        trimmed,
      )
    )
      return "question";
    return "statement";
  }

  function introForLanguage(lang: string): string {
    if (lang === "fr") return BRIDGE_INTRO_FR;
    return BRIDGE_INTRO_EN;
  }

  async function converse(userId: string, text: string): Promise<string> {
    let profile = getOrCreateProfile(userId);

    const signal: InteractionSignal = {
      kind: classifySignal(text),
      text,
      timestamp: Date.now(),
      channel: "slack",
    };
    profile = processSignal(profile, signal);
    profiles.set(userId, profile);

    if (text.trim().toLowerCase().startsWith("/identity")) {
      const header =
        profile.traits.primaryLanguage === "fr"
          ? IDENTITY_HEADER_FR
          : IDENTITY_HEADER_EN;
      return `${header}\n\`\`\`\n${formatIdentitySummary(profile)}\n\`\`\``;
    }

    const lowText = text.trim().toLowerCase();
    if (
      profile.messageCount <= 2 &&
      (lowText.includes("who are you") ||
        lowText.includes("what is this") ||
        lowText.includes("qui es-tu") ||
        lowText.includes("qu'est-ce que") ||
        lowText.includes("c'est quoi"))
    ) {
      return introForLanguage(profile.traits.primaryLanguage);
    }

    const answer = await callProvider(profile, text);
    return answer;
  }

  async function callProvider(
    profile: IdentityProfile,
    text: string,
  ): Promise<string> {
    const mode = process.env.PROVIDER_MODE ?? "mock";
    if (mode === "mock") {
      return mockAnswer(profile, text);
    }

    const apiKey = await getOpenAiKey();
    if (!apiKey) throw new Error("OpenAI is not configured on the server.");

    const instructions = buildSystemPrompt(profile);
    const history = profile.signals.slice(-10).map((s) => ({
      role: s.kind === "question" ? "user" : "user",
      content: s.text,
    }));

    const response = await fetch(
      `${process.env.OPENAI_BASE_URL ?? "https://api.openai.com"}/v1/responses`,
      {
        signal: AbortSignal.timeout(20_000),
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: process.env.OPENAI_TEXT_MODEL ?? "gpt-4.1-mini",
          instructions,
          input: [...history, { role: "user", content: text }],
        }),
      },
    );
    if (!response.ok)
      throw new Error(`OpenAI text response failed (${response.status}).`);

    const payload = (await response.json()) as {
      output?: Array<{ content?: Array<{ type: string; text?: string }> }>;
    };
    const answer = payload.output
      ?.flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    if (!answer) throw new Error("The provider returned no text.");
    return answer;
  }

  function mockAnswer(profile: IdentityProfile, text: string): string {
    const lang = profile.traits.primaryLanguage;
    if (lang === "fr") {
      return `[mode démo] J'ai bien reçu : « ${text} ». En production, cette réponse serait générée par le modèle, adaptée à votre profil (engagement ${profile.score.engagement}, curiosité ${profile.traits.curiosity}).`;
    }
    return `[demo mode] Received: "${text}". In production, this answer comes from the model, adapted to your profile (engagement ${profile.score.engagement}, curiosity ${profile.traits.curiosity}).`;
  }

  function buildSystemPrompt(profile: IdentityProfile): string {
    return [
      "You are Ursly, a digital identity bridge.",
      "",
      "Core concept: you are not a chatbot. You are a bridge between the human and their content. Digital identity is not a password — it is a protocol for interfacing with the real human. Every interaction shapes the identity fingerprint.",
      "",
      "The human you are speaking with has this behavioral profile:",
      `- Engagement: ${profile.score.engagement}/100`,
      `- Curiosity: ${profile.traits.curiosity}/100`,
      `- Language: ${profile.traits.primaryLanguage}`,
      `- Messages exchanged: ${profile.messageCount}`,
      "",
      "Adapt your tone and depth to match. Be concise. Be honest. Never pretend to be something you are not.",
      "If asked about identity, explain: identity here is not credentials — it is the pattern of who someone is, read from how they interact.",
      "Eventually this bridge will extend beyond text to all five senses. For now, words are the starting point.",
    ].join("\n");
  }

  async function getBotId(client: App["client"]): Promise<string> {
    if (botIdCache) return botIdCache;
    const result = await client.auth.test();
    botIdCache = result.bot_id ?? result.user_id ?? "";
    return botIdCache;
  }

  app.message(async ({ message, say, client }) => {
    if (!("text" in message) || !message.text || !("user" in message)) return;

    const userId = message.user;
    if (!userId) return;
    const text = message.text;
    const isDM = "channel_type" in message && message.channel_type === "im";

    try {
      const botId = await getBotId(client);
      if (isDM || text.includes(`<@${botId}>`)) {
        const cleaned = text.replace(/<@[^>]+>/, "").trim();
        if (!cleaned) return;
        const reply = await converse(userId, cleaned);
        await say(reply);
      }
    } catch (error) {
      logFailure(error);
      await say("Something went wrong. I am still here — try again.");
    }
  });

  app.event("member_joined_channel", async ({ event, say }) => {
    try {
      await say(
        `Welcome <@${event.user}>. I am Ursly — a bridge, not a bot. Your identity here is not a password: it is the pattern you leave by being yourself. Say anything to start.`,
      );
    } catch (error) {
      logFailure(error);
    }
  });

  return {
    getProfile(userId: string): IdentityProfile | undefined {
      return profiles.get(userId);
    },
    processMessage: converse,
  };
}
