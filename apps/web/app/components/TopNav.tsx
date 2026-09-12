"use client";

import { useEffect, useState, type RefObject } from "react";
import { Icon } from "./Icon";
import { ModeSwitcher, type EntryMode } from "./ModeSwitcher";
import { useLanguage } from "../i18n/LanguageProvider";
import { LANGUAGES, type Language } from "../i18n/languages";

/** Each language names itself, so a reader always recognises their own. */
const LANGUAGE_NAMES: Record<Language, string> = { en: "English", fr: "Français" };

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
          visible.set(entry.target.id, entry.isIntersecting ? entry.intersectionRatio : 0);
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
 * The fixed top menu: brand, the control modes, the platform section, the
 * intro replay and the language. It never scrolls away, so a mode change or a
 * look at the platform story is one tap from anywhere on the page. The modes
 * are the argument in miniature, which is why they sit in the middle of it.
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
  const active = useActiveSection(SECTIONS.map((section) => section.id));

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    return subscribeToScroll(update);
  }, []);

  return (
    <nav className="nav" aria-label={t("Primary")} data-scrolled={scrolled}>
      <div className="nav-inner">
        <a className="brand" href={`/${language}`} aria-label={t("Ursly home")}>
          {/* A vector stays crisp at every screen density. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="brand-mark" src="/brand/ursly-mark.svg" width="32" height="32" alt="" />
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
