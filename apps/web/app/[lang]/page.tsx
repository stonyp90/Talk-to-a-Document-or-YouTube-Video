import { notFound } from "next/navigation";
import HomePage from "../components/HomePage";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { dictionaryFor } from "../i18n/dictionaries";
import { isLanguage } from "../i18n/languages";

export default async function Page({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLanguage(lang)) notFound();
  return (
    <LanguageProvider language={lang} dictionary={dictionaryFor(lang)}>
      <HomePage />
    </LanguageProvider>
  );
}
