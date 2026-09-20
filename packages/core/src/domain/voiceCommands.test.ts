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

  it("treats every apostrophe a keyboard or recognizer produces as the same mark", () => {
    for (const said of ["don't", "don’t", "don‘t", "donʼt", "don´t"])
      expect(normalizeSpeech(said), said).toBe("dont");
  });

  it("treats a non-breaking space and French spacing as ordinary spaces", () => {
    expect(normalizeSpeech("go\u00a0back")).toBe("go back");
    expect(normalizeSpeech("suivant\u00a0?")).toBe("suivant");
    expect(normalizeSpeech("Suivant\u202f!")).toBe("suivant");
  });

  it("hears a word the same with or without its trailing punctuation", () => {
    expect(normalizeSpeech("next?")).toBe(normalizeSpeech("next"));
    expect(normalizeSpeech("next…")).toBe(normalizeSpeech("Next."));
    expect(actionsOf("next?")).toEqual(["next"]);
    expect(actionsOf("suivant…", "fr")).toEqual(["next"]);
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
      "open",
      "select",
      "search",
      "settings",
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
    expect(actionsOf("open the uploader")).toEqual(["open", "upload"]);
  });

  it("hears French speech that no English phrase could match", () => {
    const matches = matchCommands("peux-tu résumer ça", [], { language: "fr" });
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.action).toBe("summarize");
    expect(matches[0].confidence).toBe("near");
  });

  it("hears a command in either language, whichever the interface is in", () => {
    // A bilingual speaker switches without noticing, and being refused for it
    // is the kind of thing that teaches someone to stop speaking to a product.
    expect(actionsOf("go back please", "fr")).toEqual(["back"]);
    expect(actionsOf("résume ça", "en")).toEqual(["summarize"]);
  });

  it("tolerates a mis-heard word once the phrase is long enough to be sure", () => {
    const matches = matchCommands("sumary", []);
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.action).toBe("summarize");
    expect(matches[0].confidence).toBe("near");
  });

  it("refuses to guess at a short word", () => {
    // "bak" could be almost anything. Waiting to be asked again costs less
    // than running a command nobody said.
    expect(actionsOf("bak")).toEqual([]);
    expect(actionsOf("je lisais le backlog hier", "fr")).toEqual([]);
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

  it("fires the longest phrase exactly once when a shorter one is inside it", () => {
    for (const [said, phrase, action] of [
      ["stop talking", "stop talking", "stop"],
      ["go back", "go back", "back"],
      ["please stop listening now", "stop listening", "stop"],
      ["laisse tomber", "laisse tomber", "cancel"],
      ["on se parle", "on se parle", "voice"],
    ] as const) {
      const matches = matchCommands(said, [], { language: "en" });
      expect(matches, said).toHaveLength(1);
      expect(matches[0].trigger.action, said).toBe(action);
      expect(matches[0].trigger.phrase, said).toBe(phrase);
    }
  });

  it("gives overlapping words to one action, never to two", () => {
    // "annule ça" is a back phrase that contains the cancel phrase, and a saved
    // "stop talking" for cancel overlaps the built-in one for stop. Whichever
    // wins, the words are spent once.
    const saved: VoiceTrigger = {
      id: "saved-cancel",
      phrase: "stop talking now",
      action: "cancel",
    };
    const matches = matchCommands("stop talking now", [saved]);
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.id).toBe("saved-cancel");
  });
});

/**
 * The contract in the product's own words: a command word is only a command
 * when it is meant. Frozen as data so that a change to the rules has to argue
 * with every line here, in both languages, rather than with one example.
 */
const MUST_NOT_EXECUTE: ReadonlyArray<[string, "en" | "fr"]> = [
  // Negated
  ["Don't go next", "en"],
  ["Do not go to the next one", "en"],
  ["Don’t stop", "en"],
  ["Please don't summarize this", "en"],
  ["I can't go back from here", "en"],
  ["Not the summary, the introduction", "en"],
  ["Don't cancel it", "en"],
  ["ne passe pas au suivant", "fr"],
  ["Ne résume pas ça", "fr"],
  ["n'arrête pas", "fr"],
  ["continue pas", "fr"],
  ["Je ne veux pas revenir en arrière", "fr"],
  ["Sans retour possible", "fr"],
  // Quoted or mentioned
  ["Explain the word next", "en"],
  ["What does “next” mean in this chapter", "en"],
  ["The term 'previous' appears twice", "en"],
  ["Define upload for me", "en"],
  ["How would you translate continue", "en"],
  ["le mot suivant", "fr"],
  ["Explique le mot « suivant »", "fr"],
  ["Que veut dire le terme retour ici", "fr"],
  ["Traduis continue en français", "fr"],
  // Questions addressed to the document
  ["What is the next chapter about", "en"],
  ["What happens when you upload a file in this system", "en"],
  ["Why did they stop the trial", "en"],
  ["Is this the previous version of the report", "en"],
  ["How do I go back to the introduction", "en"],
  ["Does the author summarise the findings anywhere", "en"],
  ["Which video does the paper cite", "en"],
  ["Pourquoi ont-ils arrêté l'étude", "fr"],
  ["Quelle est la suite de l'argument", "fr"],
  ["Comment continue le récit après ce chapitre", "fr"],
  ["Qu'est-ce que suivant veut dire", "fr"],
  ["C'est quoi la vidéo mentionnée", "fr"],
];

const MUST_EXECUTE: ReadonlyArray<[string, "en" | "fr", VoiceActionId]> = [
  ["next", "en", "next"],
  ["Next?", "en", "next"],
  ["okay, next", "en", "next"],
  ["can you go back please", "en", "back"],
  ["Don't summarize, just go next", "en", "next"],
  ["Explain this, then next", "en", "next"],
  ["stop talking", "en", "stop"],
  ["never mind", "en", "cancel"],
  ["summarize this", "en", "summarize"],
  ["let's talk", "en", "voice"],
  ["suivant", "fr", "next"],
  ["Suivant\u00a0!", "fr", "next"],
  ["peux-tu résumer ça", "fr", "summarize"],
  ["bon, la suite", "fr", "next"],
  ["arrête", "fr", "stop"],
  ["Résume ça et ensuite suivant", "fr", "summarize"],
  ["laisse tomber", "fr", "cancel"],
];

describe("a command word that is mentioned rather than meant", () => {
  it("freezes a corpus large enough to argue with", () => {
    expect(MUST_NOT_EXECUTE.length).toBeGreaterThanOrEqual(25);
    expect(MUST_EXECUTE.length).toBeGreaterThanOrEqual(15);
    for (const language of ["en", "fr"] as const) {
      expect(
        MUST_NOT_EXECUTE.filter(([, said]) => said === language).length,
      ).toBeGreaterThanOrEqual(10);
      expect(
        MUST_EXECUTE.filter(([, said]) => said === language).length,
      ).toBeGreaterThanOrEqual(6);
    }
  });

  it.each(MUST_NOT_EXECUTE)("does not execute “%s” (%s)", (said, language) => {
    expect(actionsOf(said, language)).toEqual([]);
  });

  it.each(MUST_EXECUTE)(
    "executes “%s” (%s) as %s",
    (said, language, action) => {
      expect(actionsOf(said, language)).toContain(action);
    },
  );

  it("shields only the mentioned word, not the whole sentence", () => {
    expect(actionsOf("Don't summarize, just go next")).toEqual(["next"]);
    expect(actionsOf("Explain the word next and then go back")).toEqual([
      "back",
    ]);
  });

  it("hands the mention on as the question it was", () => {
    const transcript = "Explain the word next";
    const matches = matchCommands(transcript, []);
    expect(matches).toEqual([]);
    expect(dictationText(transcript, matches)).toBe(transcript);
    expect(isLikelyQuestion(transcript)).toBe(true);
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

describe("voiceCommands extensions", () => {
  it("includes settings action in phrases", () => {
    const phrases = defaultPhrases("en");
    expect(phrases).toHaveProperty("settings");
  });

  it('matches "settings" in English', () => {
    const triggers = defaultTriggers("en");
    const matches = matchCommands("open settings", triggers, { language: "en" });
    expect(matches.some((m) => m.trigger.action === "settings")).toBe(true);
  });

  it('matches "paramètres" in French', () => {
    const triggers = defaultTriggers("fr");
    const matches = matchCommands("ouvre les paramètres", triggers, {
      language: "fr",
    });
    expect(matches.some((m) => m.trigger.action === "settings")).toBe(true);
  });
});
