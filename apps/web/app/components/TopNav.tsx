"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { BrandIcon } from "./BrandIcon";
import { Icon } from "./Icon";
import { ModeSwitcher, type EntryMode } from "./ModeSwitcher";
import { useLanguage } from "../i18n/LanguageProvider";
import { LANGUAGES, type Language } from "../i18n/languages";
import { appDownloads, releaseNotesUrl } from "../content/downloads";

/** Each language names itself, so a reader always recognises their own. */
const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  fr: "Français",
};

const SECTIONS = [{ id: "platform", label: "Platform" }] as const;

function subscribeToScroll(notify: () => void) {
  window.addEventListener("scroll", notify, { passive: true });
  return () => window.removeEventListener("scroll", notify);
}

/** Which linked section currently owns the viewport, for `aria-current`. */
function useActiveSection(ids: readonly string[]): string | undefined {
  const [active, setActive] = useState<string>();
  useEffect(() => {
    if (typeof IntersectionObserver !== "function") return;
    const visible = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          visible.set(
            entry.target.id,
            entry.isIntersecting ? entry.intersectionRatio : 0,
          );
        const [best] = [...visible.entries()].sort((a, b) => b[1] - a[1]);
        setActive(best && best[1] > 0 ? best[0] : undefined);
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: [0, 0.1, 0.5] },
    );
    for (const id of ids) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, [ids]);
  return active;
}

/**
 * The fixed top menu: brand, the three control modes, the platform section,
 * the intro replay and the language. It never scrolls away, so a mode change
 * or a look at the platform story is one tap from anywhere on the page.
 */
export function TopNav({
  mode,
  onModeChange,
  onReplayIntro,
  replayButton,
}: {
  mode: EntryMode;
  onModeChange: (mode: EntryMode) => void;
  onReplayIntro: () => void;
  replayButton: RefObject<HTMLButtonElement | null>;
}) {
  const { language, t } = useLanguage();
  const [scrolled, setScrolled] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const downloads = useRef<HTMLDivElement>(null);
  const active = useActiveSection(SECTIONS.map((section) => section.id));

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    return subscribeToScroll(update);
  }, []);

  // The apps menu closes the way every menu does: a press outside it, or Escape.
  useEffect(() => {
    if (!downloadsOpen) return;
    const dismiss = (event: Event) => {
      if (!downloads.current?.contains(event.target as Node))
        setDownloadsOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDownloadsOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKey);
    };
  }, [downloadsOpen]);

  return (
    <nav className="nav" aria-label={t("Primary")} data-scrolled={scrolled}>
      <div className="nav-inner">
        <a className="brand" href={`/${language}`} aria-label={t("Ursly home")}>
          {/* A vector stays crisp at every screen density. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="brand-mark"
            src="/brand/ursly-mark.svg"
            width="32"
            height="32"
            alt=""
          />
          ursly<span className="brand-dot">.</span>
        </a>

        <div className="nav-modes">
          <ModeSwitcher mode={mode} onChange={onModeChange} />
        </div>

        <div className="nav-actions">
          {SECTIONS.map((section) => (
            <a
              key={section.id}
              className="nav-link"
              href={`#${section.id}`}
              aria-current={active === section.id ? "location" : undefined}
            >
              {t(section.label)}
            </a>
          ))}
          {/* The builds are the point of the applications section, so the menu
              hands them over directly instead of scrolling someone to them. */}
          <div className="nav-downloads" ref={downloads}>
            <button
              type="button"
              className="nav-link nav-download"
              aria-expanded={downloadsOpen}
              aria-haspopup="true"
              // The label is hidden on a narrow screen, which would leave the
              // control with nothing but an icon to announce itself by.
              aria-label={t("Get the app")}
              title={t("Get the app")}
              onClick={() => setDownloadsOpen((open) => !open)}
            >
              <Icon name="download" />
              <span className="nav-download-label">{t("Get the app")}</span>
            </button>
            {downloadsOpen && (
              <div className="nav-download-menu" role="menu">
                {appDownloads.map((build) => (
                  <a
                    key={build.id}
                    className="nav-download-item"
                    role="menuitem"
                    href={build.url}
                    onClick={() => setDownloadsOpen(false)}
                  >
                    <BrandIcon name={build.icon} />
                    <span>
                      <strong>{t(build.label)}</strong>
                      <small>{t(build.detail)}</small>
                    </span>
                  </a>
                ))}
                <a
                  className="nav-download-more"
                  role="menuitem"
                  href="#applications"
                  onClick={() => setDownloadsOpen(false)}
                >
                  {t("All builds and instructions")}
                </a>
                <a
                  className="nav-download-more"
                  role="menuitem"
                  href={releaseNotesUrl}
                  onClick={() => setDownloadsOpen(false)}
                >
                  {t("Release notes")} <Icon name="external" />
                </a>
              </div>
            )}
          </div>
          <button
            ref={replayButton}
            type="button"
            className="nav-link nav-intro"
            onClick={onReplayIntro}
            aria-label={t("Watch the intro")}
            title={t("Watch the intro")}
          >
            <Icon name="play" />
            <span className="nav-intro-label">{t("Watch the intro")}</span>
          </button>
          <div className="nav-languages" aria-label={t("Language")}>
            {LANGUAGES.map((code) => (
              <a
                key={code}
                className="nav-language"
                href={`/${code}`}
                hrefLang={code}
                lang={code}
                aria-label={LANGUAGE_NAMES[code]}
                aria-current={code === language ? "true" : undefined}
              >
                {code.toUpperCase()}
              </a>
            ))}
          </div>
        </div>
      </div>
    </nav>
  );
}
