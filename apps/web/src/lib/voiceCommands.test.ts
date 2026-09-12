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
      "YouTube",
      "Téléverse",
      "Parlons-en",
      "Résume ceci",
      "retour",
      "suivant",
      "annule",
    ]);
    expect(defaultTriggers("en").map((trigger) => trigger.phrase)).toEqual([
      "YouTube",
      "Upload",
      "Let’s talk",
      "Summarize this",
      "back",
      "next",
      "cancel",
    ]);
  });

  it("still answers the other language, because a caller may switch mid-sentence", () => {
    const back = defaultTriggers("fr").find((t) => t.action === "back")!;
    expect(matchTriggers("go back please", [back])).toEqual([
      { ...back, argument: "please" },
    ]);
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

  const byAction = (action: string) =>
    triggers.find((trigger) => trigger.action === action)!;

  it("finds a trigger inside a whole sentence", () => {
    expect(matchTriggers("okay, next one please", triggers)).toEqual([
      { ...byAction("next"), argument: "one please" },
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
      { ...trigger, argument: "s'il te plait" },
    ]);
  });

  it("forgives a one-letter recognition slip on a long phrase", () => {
    expect(matchTriggers("uploud", [uploadTrigger])).toEqual([
      { ...uploadTrigger, argument: "" },
    ]);
  });

  it("does not forgive a slip on a short word, where everything sounds alike", () => {
    expect(matchTriggers("beck", triggers)).toEqual([]);
  });

  it("keeps unrelated speech from firing an action", () => {
    expect(matchTriggers("I was reading the backlog", triggers)).toEqual([]);
  });

  it("returns several triggers in the order they were spoken", () => {
    expect(matchTriggers("cancel, then next", triggers)).toEqual([
      { ...byAction("cancel"), argument: "then next" },
      { ...byAction("next"), argument: "" },
    ]);
  });

  it("matches an alias without the saved phrase being spoken", () => {
    expect(matchTriggers("open the pdf", [uploadTrigger])).toEqual([
      { ...uploadTrigger, argument: "" },
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

describe("the vocabulary the interface advertises", () => {
  /**
   * The defect the owner hit: the panel offered “YouTube”, “Upload”,
   * “Let’s talk” and “Summarize this”, and the microphone was armed for
   * “back”, “next” and “cancel”. Saying an advertised word matched nothing.
   * One list must govern both, in both languages.
   */
  for (const language of ["en", "fr"] as const)
    it(`arms every phrase it offers in ${language}`, () => {
      const armed = defaultTriggers(language);
      for (const example of spokenExamples(language)) {
        const hit = matchTriggers(example.phrase, armed);
        expect(
          hit.map((t) => t.action),
          example.phrase,
        ).toContain(example.action);
      }
      expect(armed.map((t) => t.action).sort()).toEqual(
        [...VOICE_ACTION_IDS].sort(),
      );
    });

  it("carries the words after the keyword as the argument", () => {
    const armed = defaultTriggers("en");
    const [match] = matchTriggers("YouTube Pennywise", armed);
    expect(match.action).toBe("youtube");
    expect(match.argument).toBe("Pennywise");
  });

  it("keeps the argument verbatim, accents and capitals included", () => {
    const [match] = matchTriggers("YouTube Édith Piaf", defaultTriggers("fr"));
    expect(match.argument).toBe("Édith Piaf");
  });

  it("leaves the argument empty when only the keyword was said", () => {
    const [match] = matchTriggers("YouTube", defaultTriggers("en"));
    expect(match.argument).toBe("");
  });

  it("does not open the picker because a sentence mentions a pdf", () => {
    const armed = defaultTriggers("en");
    expect(matchTriggers("I'll send you the pdf later", armed)).toEqual([]);
    expect(matchTriggers("je t'envoie le pdf", defaultTriggers("fr"))).toEqual(
      [],
    );
  });
});
