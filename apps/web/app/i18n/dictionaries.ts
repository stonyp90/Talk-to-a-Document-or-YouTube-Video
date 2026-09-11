import type { Language } from "./languages";
import type { Dictionary } from "./translate";
import { french } from "./fr";

/** English is the source language, so it needs no dictionary. */
const dictionaries: Record<Language, Dictionary> = { en: {}, fr: french };

export function dictionaryFor(language: Language): Dictionary {
  return dictionaries[language];
}
