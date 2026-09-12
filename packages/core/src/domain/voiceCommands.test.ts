import { describe, expect, it } from "vitest";
import {
  VOICE_ACTIONS,
  carriesOwnPhrasing,
  defaultPhrases,
  defaultTriggers,
  dictationText,
  isLikelyQuestion,
  isSpokenContent,
  matchCommands,
  normalizeSpeech,
  spokenArgument,
  takesSpokenArgument,
  type VoiceActionId,
  type VoiceTrigger,
} from "./voiceCommands";

function actionsOf(transcript: string, language: "en" | "fr" = "en") {
  return matchCommands(transcript, [], { language }).map(
    (match) => match.trigger.action,
  );
}

describe("speech normalization", () => {
  it("folds diacritics, punctuation and dashes away", () => {
    expect(normalizeSpeech("Résumé — ça!")).toBe("resume ca");
  });

  it("splits hyphenated speech so a recognizer's hyphens never hide a phrase", () => {
    expect(normalizeSpeech("Peux-tu")).toBe("peux tu");
    expect(normalizeSpeech("vas-y")).toBe("vas y");
  });

  it("joins elided words so an apostrophe is never required", () => {
    expect(normalizeSpeech("Let's talk")).toBe("lets talk");
    expect(normalizeSpeech("lets talk")).toBe("lets talk");
  });

  it("collapses runs of whitespace", () => {
    expect(normalizeSpeech("  next   step \n please ")).toBe(
      "next step please",
    );
  });

  it("keeps nothing when nothing was said", () => {
    expect(normalizeSpeech("  …!?  ")).toBe("");
  });
});

describe("the vocabulary", () => {
  it("keeps a stable action order", () => {
    expect([...VOICE_ACTIONS]).toEqual([
      "youtube",
      "upload",
      "voice",
      "summarize",
      "ask",
      "stop",
      "back",
      "next",
      "cancel",
    ]);
  });

  it("gives every action spoken phrases in both languages", () => {
    for (const language of ["en", "fr"] as const) {
      const phrases = defaultPhrases(language);
      for (const action of VOICE_ACTIONS) {
        expect(phrases[action].length, `${language}/${action}`).toBeGreaterThan(
          0,
        );
        for (const phrase of phrases[action])
          expect(normalizeSpeech(phrase), `${language}/${action}`).not.toBe("");
      }
    }
  });

  it("speaks French rather than translated English", () => {
    const french = defaultPhrases("fr");
    expect(french.back).toContain("retour");
    expect(french.summarize).toContain("idées clés");
    expect(french.voice).toContain("on se parle");
    expect(french.upload).toContain("téléverse");
    expect(french.next).toContain("la suite");
  });

  it("spells French phrases the way they are written, so they can be shown", () => {
    // The panel prints these on its example buttons. Matching folds accents on
    // both sides, so the stored spelling is free to be the correct one.
    const written = Object.values(defaultPhrases("fr")).flat().join(" ");
    expect(written).toContain("é");
    expect(written).not.toContain("televerse");
    expect(
      matchCommands("peux-tu résumer ça", defaultTriggers("fr"), {
        language: "fr",
      })[0]?.trigger.action,
    ).toBe("summarize");
  });

  it("builds one default trigger per action from its first phrase", () => {
    const triggers = defaultTriggers("fr");
    expect(triggers.map((trigger) => trigger.action)).toEqual([
      ...VOICE_ACTIONS,
    ]);
    expect(triggers.map((trigger) => trigger.id)).toEqual(
      VOICE_ACTIONS.map((action) => `default-${action}`),
    );
    for (const trigger of triggers)
      expect(trigger.phrase).toBe(defaultPhrases("fr")[trigger.action][0]);
  });

  it("hands out a copy so a caller cannot rewrite the vocabulary", () => {
    defaultPhrases("en").back.push("moonwalk");
    expect(defaultPhrases("en").back).not.toContain("moonwalk");
  });
});

describe("matching a command inside real speech", () => {
  it("finds a command anywhere in a sentence", () => {
    const matches = matchCommands("go back please", []);
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.action).toBe("back");
    expect(matches[0].confidence).toBe("exact");
    expect(matches[0].trigger.phrase).toBe("go back");
  });

  it("hears a politely wrapped English request", () => {
    expect(actionsOf("can you summarise this")).toEqual(["summarize"]);
    expect(actionsOf("open the uploader")).toEqual(["upload"]);
  });

  it("hears French speech that no English phrase could match", () => {
    const matches = matchCommands("peux-tu résumer ça", [], { language: "fr" });
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.action).toBe("summarize");
    expect(matches[0].confidence).toBe("near");
    expect(matchCommands("peux-tu résumer ça", [])).toEqual([]);
  });

  it("tolerates a mis-heard word", () => {
    const matches = matchCommands("bak", []);
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.action).toBe("back");
    expect(matches[0].confidence).toBe("near");
  });

  it("tolerates an inflected ending", () => {
    expect(actionsOf("cancelled")).toEqual(["cancel"]);
    expect(actionsOf("arrêtez tout", "fr")).toEqual(["stop"]);
  });

  it("refuses a longer word that only looks like a command", () => {
    expect(matchCommands("black", [])).toEqual([]);
    expect(matchCommands("backward", [])).toEqual([]);
  });

  it("stays silent on speech that asked for nothing", () => {
    expect(matchCommands("what is the weather in Montreal today", [])).toEqual(
      [],
    );
    expect(
      matchCommands("je ne sais pas quoi faire ce soir", [], {
        language: "fr",
      }),
    ).toEqual([]);
  });

  it("returns each action at most once, at its earliest hearing", () => {
    const matches = matchCommands("back go back previous", []);
    expect(matches).toHaveLength(1);
    expect(matches[0].position).toBe(0);
  });

  it("prefers the longest phrase when two actions claim the same words", () => {
    const matches = matchCommands("annule ça", [], { language: "fr" });
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.action).toBe("back");
  });

  it("orders several commands the way they were spoken", () => {
    expect(actionsOf("summarize this and then next")).toEqual([
      "summarize",
      "next",
    ]);
  });
});

describe("a reader's own trigger phrases", () => {
  const scram: VoiceTrigger = {
    id: "saved-1",
    phrase: "scram",
    action: "stop",
  };

  it("adds to the built-in vocabulary instead of replacing it", () => {
    const matches = matchCommands("scram now", [scram]);
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.id).toBe("saved-1");
    expect(actionsOf("go back please")).toEqual(["back"]);
    expect(
      matchCommands("go back please", [scram]).map(
        (match) => match.trigger.action,
      ),
    ).toEqual(["back"]);
  });

  it("can stand alone when the built-ins are turned off", () => {
    const options = { includeDefaults: false };
    expect(matchCommands("scram now", [scram], options)).toHaveLength(1);
    expect(matchCommands("go back please", [scram], options)).toEqual([]);
  });

  it("never reports the same action twice, whoever supplied the phrase", () => {
    const matches = matchCommands("stop, scram", [scram]);
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.action).toBe("stop");
  });

  it("ignores a trigger phrase that says nothing", () => {
    const empty: VoiceTrigger = {
      id: "saved-2",
      phrase: " -- ",
      action: "ask",
    };
    expect(
      matchCommands("hello there", [empty], { includeDefaults: false }).length,
    ).toBe(0);
  });
});

describe("what is left to send as a question", () => {
  it("keeps the accents and the casing of the words nobody commanded", () => {
    const transcript = "résume ça et dis-moi les idées";
    const matches = matchCommands(transcript, [], { language: "fr" });
    expect(matches.map((match) => match.trigger.action)).toEqual(["summarize"]);
    expect(dictationText(transcript, matches)).toBe("et dis-moi les idées");
  });

  it("keeps the question mark that decides whether to send it", () => {
    const transcript = "Ursly, pourquoi ça marche ?";
    expect(dictationText(transcript, matchCommands(transcript, []))).toBe(
      "Ursly, pourquoi ça marche ?",
    );
  });

  it("returns nothing when the whole sentence was the command", () => {
    const transcript = "go back please";
    const matches = matchCommands(transcript, []);
    expect(dictationText(transcript, matches)).toBe("please");
    expect(dictationText("next!", matchCommands("next!", []))).toBe("");
    expect(dictationText("  ", [])).toBe("");
  });

  it("leaves the transcript alone when nothing matched", () => {
    expect(dictationText("what does this say", [])).toBe("what does this say");
  });
});

describe("deciding that dictation is a question", () => {
  it("sends three words or more", () => {
    expect(isLikelyQuestion("et dis-moi les idées")).toBe(true);
    expect(isLikelyQuestion("explique ça vite")).toBe(true);
  });

  it("keeps a short aside to itself", () => {
    expect(isLikelyQuestion("can you")).toBe(false);
    expect(isLikelyQuestion("ok")).toBe(false);
    expect(isLikelyQuestion("")).toBe(false);
  });

  it("sends a short question that ends in a question mark", () => {
    expect(isLikelyQuestion("pourquoi ?")).toBe(true);
    expect(isLikelyQuestion("why?")).toBe(true);
  });
});

describe("the actions the interface has to handle", () => {
  it("covers the two new spoken intents", () => {
    const ids: VoiceActionId[] = ["ask", "stop"];
    for (const id of ids) expect(VOICE_ACTIONS).toContain(id);
    expect(actionsOf("go ahead")).toEqual(["ask"]);
    expect(actionsOf("stop talking")).toEqual(["stop"]);
    expect(actionsOf("envoie", "fr")).toEqual(["ask"]);
  });
});

describe("spoken arguments", () => {
  it("knows which actions are completed by what else was said", () => {
    expect(takesSpokenArgument("youtube")).toBe(true);
    expect(takesSpokenArgument("summarize")).toBe(false);
  });

  it("keeps the words that name what the speaker wants", () => {
    expect(spokenArgument("Daft Punk Around the World")).toBe(
      "Daft Punk Around the World",
    );
  });

  it("drops the connective a speaker puts in front of it", () => {
    expect(spokenArgument("search for Miles Davis")).toBe("Miles Davis");
    // An article belongs to the title, so it stays: "the Beatles" is a name.
    expect(spokenArgument("about the Apollo programme")).toBe(
      "the Apollo programme",
    );
    expect(spokenArgument("cherche Jean Leloup")).toBe("Jean Leloup");
  });

  it("returns nothing when only a connective was said", () => {
    expect(spokenArgument("  for ")).toBe("");
    expect(spokenArgument("")).toBe("");
  });

  it("takes the search terms straight out of a spoken command", () => {
    const transcript = "YouTube Daft Punk Around the World";
    const matches = matchCommands(transcript, defaultTriggers("en"), {
      language: "en",
    });
    expect(matches[0]?.trigger.action).toBe("youtube");
    expect(spokenArgument(dictationText(transcript, matches))).toBe(
      "Daft Punk Around the World",
    );
  });
});

describe("commands the speaker rephrases", () => {
  it("marks the actions whose built-in wording is only a default", () => {
    expect(carriesOwnPhrasing("summarize")).toBe(true);
    expect(carriesOwnPhrasing("back")).toBe(false);
    expect(carriesOwnPhrasing("youtube")).toBe(false);
  });

  it("leaves the speaker's own wording behind the command", () => {
    const transcript = "summarize this in three short points";
    const matches = matchCommands(transcript, defaultTriggers("en"), {
      language: "en",
    });
    expect(matches[0]?.trigger.action).toBe("summarize");
    const leftover = dictationText(transcript, matches);
    expect(isLikelyQuestion(leftover)).toBe(true);
  });

  it("leaves nothing behind the bare command", () => {
    const transcript = "summarize this";
    const matches = matchCommands(transcript, defaultTriggers("en"), {
      language: "en",
    });
    expect(dictationText(transcript, matches)).toBe("");
  });
});

describe("what is left after a command", () => {
  it("treats the padding around a command as padding", () => {
    const transcript = "can you go back please";
    const matches = matchCommands(transcript, defaultTriggers("en"), {
      language: "en",
    });
    expect(matches[0]?.trigger.action).toBe("back");
    const leftover = dictationText(transcript, matches);
    // Three words, so the word count alone would have called it a question.
    expect(isLikelyQuestion(leftover)).toBe(true);
    expect(isSpokenContent(leftover)).toBe(false);
  });

  it("treats the same padding in French as padding", () => {
    const transcript = "peux-tu résumer ça";
    const matches = matchCommands(transcript, defaultTriggers("fr"), {
      language: "fr",
    });
    expect(matches[0]?.trigger.action).toBe("summarize");
    expect(isSpokenContent(dictationText(transcript, matches))).toBe(false);
  });

  it("keeps a real request made around a command", () => {
    const transcript = "summarize this in three short points";
    const matches = matchCommands(transcript, defaultTriggers("en"), {
      language: "en",
    });
    expect(isSpokenContent(dictationText(transcript, matches))).toBe(true);
  });

  it("keeps a question that stands on its own", () => {
    expect(isSpokenContent("what does the author say about funding")).toBe(
      true,
    );
  });

  it("has nothing to keep when nothing is left", () => {
    expect(isSpokenContent("")).toBe(false);
    expect(isSpokenContent("   ")).toBe(false);
  });
});
