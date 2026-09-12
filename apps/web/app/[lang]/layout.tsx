import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { LANGUAGES, isLanguage, type Language } from "../i18n/languages";
import { SITE_COPY } from "../content/site";
import { siteProfile } from "../seo/profile";
import {
  structuredDataDocument,
  videoFor,
  videoLinks,
} from "@/packages/core/src/domain/discoverability";

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGUAGES.map((lang) => ({ lang }));
}

/** Route params, spelled out so `tsc` does not depend on generated route types. */
type LanguageParams = { params: Promise<{ lang: string }> };

export async function generateMetadata({
  params,
}: LanguageParams): Promise<Metadata> {
  const { lang } = await params;
  const language: Language = isLanguage(lang) ? lang : "en";
  const text = SITE_COPY[language];
  const profile = siteProfile(language);
  const intro = videoFor(profile, language);
  const watchUrl = intro ? videoLinks(profile, intro).watchUrl : undefined;
  return {
    metadataBase: new URL(profile.siteUrl),
    title: { default: text.title, template: "%s | Ursly" },
    applicationName: "Ursly",
    description: text.description,
    alternates: {
      canonical: `/${language}`,
      languages: { en: "/en", fr: "/fr", "x-default": "/" },
    },
    appleWebApp: { capable: true, title: "Ursly", statusBarStyle: "default" },
    openGraph: {
      type: "website",
      url: `/${language}`,
      siteName: "Ursly",
      locale: language === "fr" ? "fr_CA" : "en_US",
      title: text.title,
      description: text.social,
      images: [
        {
          url: "/brand/social-card.png",
          width: 1200,
          height: 630,
          alt: text.title,
        },
      ],
      // Only once the introduction is published somewhere a card can play it.
      ...(watchUrl ? { videos: [{ url: watchUrl }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      images: ["/brand/social-card.png"],
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#F8F5EF",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
  params,
}: LanguageParams & { children: React.ReactNode }) {
  const { lang } = await params;
  if (!isLanguage(lang)) notFound();
  return (
    <html lang={lang}>
      <body>
        {/* What the page means, for the readers that never see it render.
            `ld+json` is data, not code, so nothing here executes. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: structuredDataDocument(siteProfile(lang), lang),
          }}
        />
        {children}
      </body>
    </html>
  );
}
