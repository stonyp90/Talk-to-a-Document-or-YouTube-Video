/**
 * How the site names and describes itself. One record, read by the page
 * metadata, by the structured data, and by the plain-text reading at
 * `/llms.txt`, so a crawler and a reader are never told two different things.
 */
import type { Language } from "../i18n/languages";

export type SiteCopy = {
  title: string;
  description: string;
  /** The shorter line social cards and unfurls have room for. */
  social: string;
};

export const SITE_NAME = "Ursly";

export const SITE_COPY: Record<Language, SiteCopy> = {
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
