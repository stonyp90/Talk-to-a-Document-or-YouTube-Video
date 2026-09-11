import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import "../globals.css";
import { LANGUAGES, isLanguage, type Language } from "../i18n/languages";

const copy: Record<Language, { title: string; description: string; social: string }> = {
  en: {
    title: "Ursly — The joy of understanding",
    description:
      "Your sources. Your questions. A real conversation. Explore PDFs and captioned YouTube videos with voice or text.",
    social: "Explore your documents and videos through conversation.",
  },
  fr: {
    title: "Ursly — Le plaisir de comprendre",
    description:
      "Vos sources. Vos questions. Une vraie conversation. Explorez des PDF et des vidéos YouTube sous-titrées, à la voix ou au clavier.",
    social: "Explorez vos documents et vos vidéos en conversant.",
  },
};

export const dynamicParams = false;

export function generateStaticParams() {
  return LANGUAGES.map((lang) => ({ lang }));
}

export async function generateMetadata({
  params,
}: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  const language: Language = isLanguage(lang) ? lang : "en";
  const text = copy[language];
  return {
    metadataBase: new URL("https://ursly.io"),
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
    },
    twitter: { card: "summary_large_image", images: ["/brand/social-card.png"] },
  };
}

export const viewport: Viewport = {
  themeColor: "#F8F5EF",
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLanguage(lang)) notFound();
  return (
    <html lang={lang}>
      <body>{children}</body>
    </html>
  );
}
