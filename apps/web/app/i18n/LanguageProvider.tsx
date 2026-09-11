"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { DEFAULT_LANGUAGE, type Language } from "./languages";
import { createTranslator, type Dictionary, type Translate } from "./translate";

type LanguageContextValue = { language: Language; t: Translate };

const LanguageContext = createContext<LanguageContextValue>({
  language: DEFAULT_LANGUAGE,
  t: createTranslator({}),
});

/**
 * Makes the negotiated language and its dictionary available to every client
 * component. The server decides the language from the URL, so the first paint
 * is already in the right language and hydration has nothing to correct.
 */
export function LanguageProvider({
  language,
  dictionary,
  children,
}: {
  language: Language;
  dictionary: Dictionary;
  children: ReactNode;
}) {
  const value = useMemo(
    () => ({ language, t: createTranslator(dictionary) }),
    [language, dictionary],
  );
  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
