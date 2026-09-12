import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Workspace from "../../components/Workspace";
import { LanguageProvider } from "../../i18n/LanguageProvider";
import { dictionaryFor } from "../../i18n/dictionaries";
import { isLanguage, type Language } from "../../i18n/languages";

const copy: Record<Language, { title: string; description: string }> = {
  en: {
    title: "The app",
    description:
      "Add a PDF or a captioned YouTube video, then ask about it by voice or keyboard.",
  },
  fr: {
    title: "L’application",
    description:
      "Ajoutez un PDF ou une vidéo YouTube sous-titrée, puis posez vos questions à la voix ou au clavier.",
  },
};

/** Route params, spelled out so `tsc` does not depend on generated route types. */
type LanguageParams = { params: Promise<{ lang: string }> };

/**
 * Without this the page would inherit the layout's canonical, and both
 * `/en/app` and `/fr/app` would claim the landing page as their own.
 */
export async function generateMetadata({
  params,
}: LanguageParams): Promise<Metadata> {
  const { lang } = await params;
  const language: Language = isLanguage(lang) ? lang : "en";
  const text = copy[language];
  return {
    title: text.title,
    description: text.description,
    alternates: {
      canonical: `/${language}/app`,
      languages: { en: "/en/app", fr: "/fr/app", "x-default": "/app" },
    },
  };
}

export default async function Page({ params }: LanguageParams) {
  const { lang } = await params;
  if (!isLanguage(lang)) notFound();
  return (
    <LanguageProvider language={lang} dictionary={dictionaryFor(lang)}>
      <Workspace />
    </LanguageProvider>
  );
}
