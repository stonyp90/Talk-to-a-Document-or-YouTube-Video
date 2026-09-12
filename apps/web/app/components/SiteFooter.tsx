"use client";

import { useLanguage } from "../i18n/LanguageProvider";

/**
 * One footer, rendered from one place on both pages. The guide and the
 * downloads live on the landing page, so the links are in-page jumps there
 * and absolute cross-page links from the app, where those sections do not
 * exist: the app is never a dead end.
 */
export function SiteFooter({
  page,
  appHref,
}: {
  page: "landing" | "app";
  /** Where the way in leads; the app page is already there and omits it. */
  appHref?: string;
}) {
  const { t, language } = useLanguage();
  const prefix = page === "app" ? `/${language}` : "";
  return (
    <footer className="footer">
      <span>{t("Ursly · Made for your next “aha”.")}</span>
      <span className="footer-links">
        <a href={`${prefix}#how-we-build`}>{t("How we build")} ↓</a>
        <a href={`${prefix}#pricing`}>{t("Pricing")} ↓</a>
        <a href={`${prefix}#how-it-works`}>{t("How it works")} ↓</a>
        <a href={`${prefix}#applications`}>{t("Applications & GitHub")} ↗</a>
        {appHref && <a href={appHref}>{t("Open the app")} →</a>}
      </span>
    </footer>
  );
}
