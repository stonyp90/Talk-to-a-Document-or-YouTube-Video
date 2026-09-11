import { describe, expect, it } from "vitest";
import {
  VOICE_ACTION_IDS,
  actionLabel,
  actionReply,
  defaultTriggers,
  matchTriggers,
  normalizeSpoken,
  spokenExamples,
} from "./voiceCommands";

describe("spoken command normalization", () => {
  it("ignores case, accents and punctuation so recognition spelling cannot matter", () => {
    expect(normalizeSpoken("Résume, ça!")).toBe("resume ca");
    expect(normalizeSpoken("  Let’s   TALK  ")).toBe("lets talk");
  });
});

describe("default triggers", () => {
  it("speaks the interface language", () => {
    expect(defaultTriggers("fr").map((trigger) => trigger.phrase)).toEqual([
      "retour",
      "suivant",
      "annule",
    ]);
    expect(defaultTriggers("en").map((trigger) => trigger.phrase)).toEqual([
      "back",
      "next",
      "cancel",
    ]);
  });

  it("still answers the other language, because a caller may switch mid-sentence", () => {
    const [back] = defaultTriggers("fr");
    expect(matchTriggers("go back please", [back])).toEqual([back]);
  });

  it("covers every action with at least one phrase per language", () => {
    for (const language of ["en", "fr"] as const)
      for (const action of VOICE_ACTION_IDS)
        expect(
          spokenExamples(language).some((example) => example.action === action),
        ).toBe(true);
  });
});

describe("matching what was heard", () => {
  const triggers = defaultTriggers("en");
  const upload = spokenExamples("en").find(
    (example) => example.action === "upload",
  );
  const uploadTrigger = {
    id: "upload",
    phrase: upload?.phrase ?? "upload",
    action: "upload" as const,
    aliases: upload?.aliases,
  };

  it("finds a trigger inside a whole sentence", () => {
    expect(matchTriggers("okay, next one please", triggers)).toEqual([
      triggers[1],
    ]);
  });

  it("matches an accented French phrase transcribed without accents", () => {
    const summarize = spokenExamples("fr").find(
      (example) => example.action === "summarize",
    );
    const trigger = {
      id: "summarize",
      phrase: summarize?.phrase ?? "résume",
      action: "summarize" as const,
      aliases: summarize?.aliases,
    };
    expect(matchTriggers("resume ceci s'il te plait", [trigger])).toEqual([
      trigger,
    ]);
  });

  it("forgives a one-letter recognition slip on a long phrase", () => {
    expect(matchTriggers("uploud", [uploadTrigger])).toEqual([uploadTrigger]);
  });

  it("does not forgive a slip on a short word, where everything sounds alike", () => {
    expect(matchTriggers("beck", triggers)).toEqual([]);
  });

  it("keeps unrelated speech from firing an action", () => {
    expect(matchTriggers("I was reading the backlog", triggers)).toEqual([]);
  });

  it("returns several triggers in the order they were spoken", () => {
    expect(matchTriggers("cancel, then next", triggers)).toEqual([
      triggers[2],
      triggers[1],
    ]);
  });

  it("matches an alias without the saved phrase being spoken", () => {
    expect(matchTriggers("open the pdf", [uploadTrigger])).toEqual([
      uploadTrigger,
    ]);
  });

  it("ignores a trigger whose phrase carries no letters", () => {
    expect(
      matchTriggers("anything", [{ id: "x", phrase: "***", action: "upload" }]),
    ).toEqual([]);
  });
});

describe("action copy", () => {
  it("keeps an English label and a spoken reply for every action", () => {
    for (const action of VOICE_ACTION_IDS) {
      expect(actionLabel(action)).toMatch(/\w/);
      expect(actionReply(action)).toMatch(/\w/);
    }
  });
});
