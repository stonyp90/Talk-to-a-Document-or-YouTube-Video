import { describe, expect, it } from "vitest";
import { SPEECH_DELIVERY, selectSpeechVoice } from "./speechVoice";

type Voice = {
  name: string;
  lang: string;
  localService: boolean;
  default?: boolean;
};

const voice = (
  name: string,
  lang: string,
  localService = true,
  extra: Partial<Voice> = {},
): Voice => ({ name, lang, localService, ...extra });

describe("choosing the voice that speaks back", () => {
  it("prefers a named premium voice for the exact locale", () => {
    const chosen = selectSpeechVoice(
      [
        voice("Amélie (Compact)", "fr-CA"),
        voice("Google français", "fr-FR"),
        voice("Amélie (Premium)", "fr-CA"),
      ],
      "fr-CA",
    );
    expect(chosen?.name).toBe("Amélie (Premium)");
  });

  it("avoids the compact voice when a plain one exists for the same locale", () => {
    const chosen = selectSpeechVoice(
      [voice("Thomas (Compact)", "fr-FR"), voice("Thomas", "fr-FR")],
      "fr-FR",
    );
    expect(chosen?.name).toBe("Thomas");
  });

  it("falls back to the same language in another region", () => {
    const chosen = selectSpeechVoice(
      [voice("Daniel", "en-GB"), voice("Thomas", "fr-FR")],
      "fr-CA",
    );
    expect(chosen?.name).toBe("Thomas");
  });

  it("prefers a locally installed voice over a network one of the same rank", () => {
    const chosen = selectSpeechVoice(
      [voice("Remote Voice", "en-US", false), voice("Local Voice", "en-US")],
      "en-US",
    );
    expect(chosen?.name).toBe("Local Voice");
  });

  it("returns nothing when no voice speaks the language, so the browser default is used", () => {
    expect(
      selectSpeechVoice([voice("Daniel", "en-GB")], "ja-JP"),
    ).toBeUndefined();
  });

  it("is stable: the same list always yields the same voice", () => {
    const list = [voice("Alice", "en-US"), voice("Bob", "en-US")];
    expect(selectSpeechVoice(list, "en-US")).toEqual(
      selectSpeechVoice([...list].reverse(), "en-US"),
    );
  });

  it("keeps the spoken reply slightly slower than the browser default", () => {
    expect(SPEECH_DELIVERY.rate).toBeLessThan(1);
    expect(SPEECH_DELIVERY.rate).toBeGreaterThan(0.5);
  });
});
