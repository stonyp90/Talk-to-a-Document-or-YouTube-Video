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
    title: "Ursly — The human interface.",
    description:
      "Make the keyboard obsolete. Speak, gesture, look, move — the interface adapts to you. No menus, no buttons, no typing.",
    social: "Ursly is the human interface.",
  },
  fr: {
    title: "Ursly — L'interface humaine.",
    description:
      "Rendez le clavier obsolète. Parlez, gestuez, regardez, bougez — l'interface s'adapte à vous. Pas de menus, pas de boutons, pas de saisie.",
    social: "Ursly est l'interface humaine.",
  },
};
