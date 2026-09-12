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
      "The next generation of internet. Bring a PDF or a captioned YouTube video and ask your questions by voice, without a keyboard.",
    social: "Explore your documents and videos by voice.",
  },
  fr: {
    title: "Ursly — Le plaisir de comprendre",
    description:
      "La nouvelle génération d'internet. Apportez un PDF ou une vidéo YouTube sous-titrée et posez vos questions à la voix, sans clavier.",
    social: "Explorez vos documents et vos vidéos à la voix.",
  },
};
