import { describe, expect, it } from "vitest";
import {
  FILE_NAVIGATION_ACTIONS,
  fileDefaultPhrases,
  fileDefaultTriggers,
} from "./fileVoiceActions";
import { matchCommands } from "./voiceCommands";

describe("file voice actions", () => {
  it("defines navigation action ids", () => {
    expect(FILE_NAVIGATION_ACTIONS).toContain("open");
    expect(FILE_NAVIGATION_ACTIONS).toContain("select");
    expect(FILE_NAVIGATION_ACTIONS).toContain("search");
  });

  it("provides English phrases for file actions", () => {
    const phrases = fileDefaultPhrases("en");
    expect(phrases.open).toContain("open");
    expect(phrases.select).toContain("select");
    expect(phrases.search).toContain("search");
  });

  it("provides French phrases for file actions", () => {
    const phrases = fileDefaultPhrases("fr");
    expect(phrases.open).toContain("ouvrir");
    expect(phrases.select).toContain("sélectionner");
    expect(phrases.search).toContain("chercher");
  });

  it("creates default triggers for file actions", () => {
    const triggers = fileDefaultTriggers("en");
    expect(triggers).toHaveLength(3);
    expect(triggers[0].action).toBe("open");
  });

  it("matches spoken open command", () => {
    const triggers = fileDefaultTriggers("en");
    const matches = matchCommands("open report", triggers, { language: "en" });
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.action).toBe("open");
  });

  it("matches spoken select command with argument", () => {
    const triggers = fileDefaultTriggers("en");
    const matches = matchCommands("select the third one", triggers, {
      language: "en",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.action).toBe("select");
  });

  it("matches French ouvrir command", () => {
    const triggers = fileDefaultTriggers("fr");
    const matches = matchCommands("ouvrir le dossier", triggers, {
      language: "fr",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.action).toBe("open");
  });
});
