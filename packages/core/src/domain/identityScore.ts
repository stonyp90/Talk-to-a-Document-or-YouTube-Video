/**
 * Digital identity as a behavioral fingerprint.
 *
 * Identity here is not a password or a token — it is the pattern a human
 * leaves behind by interacting. Every message, every question, every pause
 * is a signal. Enough signals produce a profile: a score that says who this
 * person is by how they behave, not by what they claim.
 *
 * The Slack bot is the first adapter that reads these signals. The same
 * domain will serve voice, gaze, and every sense that follows.
 */

export type SignalKind = "question" | "statement" | "reaction" | "command";

export type InteractionSignal = {
  kind: SignalKind;
  text: string;
  timestamp: number;
  channel: string;
};

export type IdentityTraits = {
  curiosity: number;
  engagement: number;
  verbosity: number;
  primaryLanguage: string;
};

/**
 * The score is a behavioral fingerprint. It changes with every interaction
 * and is never stored as a credential — it is read, not checked.
 */
export type IdentityScore = {
  engagement: number;
  consistency: number;
  depth: number;
  adaptability: number;
};

export type IdentityProfile = {
  userId: string;
  signals: InteractionSignal[];
  score: IdentityScore;
  traits: IdentityTraits;
  firstSeen: number;
  lastSeen: number;
  messageCount: number;
};

export function createProfile(userId: string, now = Date.now()): IdentityProfile {
  return {
    userId,
    signals: [],
    score: { engagement: 0, consistency: 0, depth: 0, adaptability: 0 },
    traits: {
      curiosity: 0,
      engagement: 0,
      verbosity: 0,
      primaryLanguage: "unknown",
    },
    firstSeen: now,
    lastSeen: now,
    messageCount: 0,
  };
}

const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000;
const DECAY_FACTOR = Math.LN2 / DECAY_HALF_LIFE_MS;

/**
 * How much a signal counts, given its age. Recent signals matter more; old
 * ones fade on a exponential curve with a seven-day half-life.
 */
function signalWeight(signalTime: number, now: number): number {
  return Math.exp(-DECAY_FACTOR * (now - signalTime));
}

function kindMultiplier(kind: SignalKind): number {
  switch (kind) {
    case "question":
      return 1.5;
    case "statement":
      return 1.0;
    case "reaction":
      return 0.5;
    case "command":
      return 1.2;
  }
}

export function processSignal(
  profile: IdentityProfile,
  signal: InteractionSignal,
): IdentityProfile {
  const now = signal.timestamp;
  const signals = [...profile.signals, signal];
  const messageCount = profile.messageCount + 1;

  const score = computeScore(signals, now);
  const traits = analyzeTraits(signals, profile.traits.primaryLanguage);

  return {
    ...profile,
    signals,
    score,
    traits,
    lastSeen: now,
    messageCount,
  };
}

function computeScore(
  signals: InteractionSignal[],
  now: number,
): IdentityScore {
  if (signals.length === 0)
    return { engagement: 0, consistency: 0, depth: 0, adaptability: 0 };

  const weights = signals.map((s) =>
    signalWeight(s.timestamp, now) * kindMultiplier(s.kind),
  );
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  const engagement = Math.min(100, totalWeight * 10);

  const uniqueDays = new Set(
    signals.map((s) => Math.floor(s.timestamp / 86_400_000)),
  ).size;
  const consistency = Math.min(100, (uniqueDays / Math.max(signals.length, 1)) * 100);

  const avgLength =
    signals.reduce((sum, s) => sum + s.text.length, 0) / signals.length;
  const depth = Math.min(100, avgLength * 2);

  const channels = new Set(signals.map((s) => s.channel)).size;
  const adaptability = Math.min(100, channels * 25);

  return {
    engagement: Math.round(engagement),
    consistency: Math.round(consistency),
    depth: Math.round(depth),
    adaptability: Math.round(adaptability),
  };
}

function analyzeTraits(
  signals: InteractionSignal[],
  existingLanguage: string,
): IdentityTraits {
  if (signals.length === 0)
    return { curiosity: 0, engagement: 0, verbosity: 0, primaryLanguage: "unknown" };

  const questions = signals.filter((s) => s.kind === "question").length;
  const ratio = questions / signals.length;

  const recent = signals.slice(-20);
  const avgLength =
    recent.reduce((sum, s) => sum + s.text.length, 0) / recent.length;

  const curiosity = Math.round(ratio * 100);
  const engagement = Math.min(100, signals.length * 5);
  const verbosity = Math.min(100, avgLength);

  const allText = signals.map((s) => s.text).join(" ");
  const language = detectLanguage(allText) || existingLanguage;

  return { curiosity, engagement, verbosity, primaryLanguage: language };
}

function detectLanguage(text: string): string | undefined {
  const frenchMarkers = /\b(je|tu|il|nous|vous|ils|le|la|les|un|une|des|est|sont|avoir|être|qui|que|quoi|comment|pourquoi|bonjour|merci)\b/gi;
  const chineseMarkers = /[\u4e00-\u9fff]/g;

  const frenchCount = (text.match(frenchMarkers) || []).length;
  const chineseCount = (text.match(chineseMarkers) || []).length;
  const totalWords = text.split(/\s+/).length;

  if (chineseCount > 5) return "zh";
  if (frenchCount > totalWords * 0.15) return "fr";
  if (totalWords > 0) return "en";
  return undefined;
}

/**
 * A human-readable summary of a profile, for showing the user who the
 * system thinks they are.
 */
export function formatIdentitySummary(profile: IdentityProfile): string {
  const { score, traits, messageCount } = profile;
  const lines = [
    `Messages: ${messageCount}`,
    `Engagement: ${score.engagement}/100`,
    `Consistency: ${score.consistency}/100`,
    `Depth: ${score.depth}/100`,
    `Adaptability: ${score.adaptability}/100`,
    `Curiosity: ${traits.curiosity}/100`,
    `Language: ${traits.primaryLanguage}`,
  ];
  return lines.join("\n");
}
