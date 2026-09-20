import { describe, expect, it } from "vitest";
import {
  createProfile,
  formatIdentitySummary,
  processSignal,
  type InteractionSignal,
} from "../../../packages/core/src/domain/identityScore";

const signal = (
  overrides: Partial<InteractionSignal> = {},
): InteractionSignal => ({
  kind: "statement",
  text: "hello world",
  timestamp: Date.now(),
  channel: "slack",
  ...overrides,
});

describe("createProfile", () => {
  it("starts with zero scores and empty signals", () => {
    const profile = createProfile("U123");
    expect(profile.userId).toBe("U123");
    expect(profile.messageCount).toBe(0);
    expect(profile.signals).toEqual([]);
    expect(profile.score.engagement).toBe(0);
    expect(profile.traits.primaryLanguage).toBe("unknown");
  });
});

describe("processSignal", () => {
  it("increments message count and records the signal", () => {
    const profile = processSignal(createProfile("U1"), signal({ text: "hi" }));
    expect(profile.messageCount).toBe(1);
    expect(profile.signals).toHaveLength(1);
    expect(profile.signals[0].text).toBe("hi");
  });

  it("increases engagement with more signals", () => {
    let profile = createProfile("U1");
    for (let i = 0; i < 5; i++) {
      profile = processSignal(profile, signal({ text: `message ${i}` }));
    }
    expect(profile.score.engagement).toBeGreaterThan(0);
  });

  it("gives questions more weight than statements", () => {
    let profileQ = createProfile("U1");
    let profileS = createProfile("U2");
    const now = Date.now();

    for (let i = 0; i < 3; i++) {
      profileQ = processSignal(
        profileQ,
        signal({ kind: "question", text: "why?", timestamp: now }),
      );
      profileS = processSignal(
        profileS,
        signal({ kind: "statement", text: "ok", timestamp: now }),
      );
    }

    expect(profileQ.score.engagement).toBeGreaterThan(
      profileS.score.engagement,
    );
  });

  it("detects French language", () => {
    let profile = createProfile("U1");
    const frenchTexts = [
      "Bonjour, comment allez-vous?",
      "Je suis intéressé par ce projet",
      "Qu'est-ce que c'est?",
      "Nous avons besoin de plus d'informations",
    ];
    for (const text of frenchTexts) {
      profile = processSignal(profile, signal({ text }));
    }
    expect(profile.traits.primaryLanguage).toBe("fr");
  });

  it("detects Chinese language", () => {
    let profile = createProfile("U1");
    const chineseTexts = [
      "你好世界",
      "这是什么东西呢？",
      "我想要了解更多关于这个项目",
      "我们什么时候开始？",
      "非常好的想法",
      "谢谢你的帮助",
    ];
    for (const text of chineseTexts) {
      profile = processSignal(profile, signal({ text }));
    }
    expect(profile.traits.primaryLanguage).toBe("zh");
  });

  it("detects English language", () => {
    let profile = createProfile("U1");
    for (let i = 0; i < 5; i++) {
      profile = processSignal(
        profile,
        signal({ text: `This is an English sentence about topic ${i}.` }),
      );
    }
    expect(profile.traits.primaryLanguage).toBe("en");
  });

  it("tracks curiosity as question ratio", () => {
    let profile = createProfile("U1");
    const now = Date.now();
    profile = processSignal(
      profile,
      signal({ kind: "question", text: "what?", timestamp: now }),
    );
    profile = processSignal(
      profile,
      signal({ kind: "statement", text: "ok", timestamp: now }),
    );
    expect(profile.traits.curiosity).toBe(50);
  });

  it("updates lastSeen to the latest signal timestamp", () => {
    let profile = createProfile("U1");
    const t1 = 1000;
    const t2 = 2000;
    profile = processSignal(profile, signal({ timestamp: t1 }));
    expect(profile.lastSeen).toBe(t1);
    profile = processSignal(profile, signal({ timestamp: t2 }));
    expect(profile.lastSeen).toBe(t2);
  });
});

describe("formatIdentitySummary", () => {
  it("includes all score dimensions", () => {
    let profile = createProfile("U1");
    profile = processSignal(
      profile,
      signal({ kind: "question", text: "why is the sky blue?" }),
    );
    const summary = formatIdentitySummary(profile);
    expect(summary).toContain("Messages: 1");
    expect(summary).toContain("Engagement:");
    expect(summary).toContain("Consistency:");
    expect(summary).toContain("Depth:");
    expect(summary).toContain("Adaptability:");
    expect(summary).toContain("Curiosity:");
    expect(summary).toContain("Language:");
  });
});
