"use client";

import { useLanguage } from "../i18n/LanguageProvider";
import {
  appDownloads,
  checksumsUrl,
  releaseNotesUrl,
  repositoryUrl,
} from "../content/downloads";
import { SITE_COPY } from "../content/site";
import { socialProfiles } from "../content/social";
import { BrandIcon } from "./BrandIcon";

/**
 * The four sections a reader needs at the end of the page — who is speaking,
 * where the application lives, what can be installed today, and where the
 * source sits — with the social profiles on the base line.
 */
export function SiteFooter({
  page = "landing",
  appHref,
}: {
  page?: "landing" | "app";
  appHref?: string;
}) {
  const { language, t } = useLanguage();
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <span className="footer-brand-name">Ursly</span>
          <p className="footer-brand-tagline">
            {t("Ursly · Made for your next “aha”.")}
          </p>
          <p className="footer-brand-note">{SITE_COPY[language].social}</p>
        </div>
        <nav className="footer-col" aria-label={t("Product")}>
          <h2 className="footer-col-title">{t("Product")}</h2>
          <div className="footer-links">
            {page === "landing" ? (
              <a href={appHref ?? `/${language}/app`}>
                {t("Open the app")} &rarr;
              </a>
            ) : (
              <a href={`/${language}`}>{t("Back to the story")}</a>
            )}
          </div>
        </nav>
        <section className="footer-col footer-builds" aria-label={t("Get the app")}>
          <h2 className="footer-col-title footer-builds-label">
            {t("Get the app")}
          </h2>
          <div className="footer-links">
            {appDownloads.map((build) => (
              <a key={build.id} href={build.url}>
                {t(build.label)}
              </a>
            ))}
            <a href={releaseNotesUrl}>{t("Release notes")}</a>
          </div>
        </section>
        <nav className="footer-col" aria-label={t("Resources")}>
          <h2 className="footer-col-title">{t("Resources")}</h2>
          <div className="footer-links">
            <a href={repositoryUrl}>{t("Source code")}</a>
            <a href={checksumsUrl}>{t("Checksums")}</a>
            <a href="/llms.txt">{t("For AI readers")}</a>
          </div>
        </nav>
      </div>
      <div className="footer-base">
        <span>© {new Date().getFullYear()} Ursly</span>
        <div className="footer-social">
          {socialProfiles.map((profile) => (
            <a key={profile.id} href={profile.url} aria-label={profile.label}>
              <BrandIcon name={profile.id} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
