"use client";

import { useEffect, useState, type RefObject } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./Icon";
import { ModeSwitcher, type EntryMode } from "./ModeSwitcher";
import { useLanguage } from "../i18n/LanguageProvider";
import { LANGUAGES, withLanguage, type Language } from "../i18n/languages";
import { MENU_SECTIONS, appHref } from "../content/story";

/** Each language names itself, so a reader always recognises their own. */
const LANGUAGE_NAMES: Record<Language, string> = {
  en: "English",
  fr: "Français",
};

const SECTIONS = MENU_SECTIONS;
/** Stable across renders, so the observer is not rebuilt on every one. */
const SECTION_IDS = SECTIONS.map((section) => section.id);

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

const NO_SECTIONS: readonly string[] = [];

/**
 * Each page carries only its own concerns: the landing page owns the story
 * anchors and the intro replay, the app page owns the control modes. Making
 * that a union rather than optional props means neither page can accidentally
 * render a control that does nothing where it stands.
 */
type StoryControls = {
  page: "landing";
  onReplayIntro: () => void;
  replayButton: RefObject<HTMLButtonElement | null>;
};

type TopNavProps =
  | StoryControls
  | {
      page: "app";
      mode: EntryMode;
      onModeChange: (mode: EntryMode) => void;
    };

/**
 * The story anchors and the intro replay: landing-page furniture, in its own
 * component so the button's ref arrives as a plain parameter rather than
 * being read off a narrowed props object during render.
 */
function StoryNavControls({
  onReplayIntro,
  replayButton,
  active,
}: StoryControls & { active?: string }) {
  const { t } = useLanguage();
  return (
    <>
      {SECTIONS.map((section) => (
        <a
          key={section.id}
          className="nav-link nav-section-link"
          data-section={section.id}
          href={`#${section.id}`}
          aria-label={t(section.label)}
          aria-current={active === section.id ? "location" : undefined}
        >
          {/* The full label where the bar is wide, the short one where it is
              not: the accessible name stays the section's real name. */}
          <span className="nav-section-full">{t(section.label)}</span>
          <span className="nav-section-short" aria-hidden="true">
            {t(section.short)}
          </span>
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
    </>
  );
}

/**
 * The fixed top menu: brand, the control modes on the app page, the story
 * anchors and the intro replay on the landing page, the route between the
 * two, and the language. It never scrolls away, so the way in or out is one
 * tap from anywhere on either page.
 */
export function TopNav(props: TopNavProps) {
  const { page } = props;
  const story = props.page === "landing" ? props : undefined;
  const { language, t } = useLanguage();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection(
    page === "landing" ? SECTION_IDS : NO_SECTIONS,
  );

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    return subscribeToScroll(update);
  }, []);

  // One slot, two faces: on the landing page it is the commitment to go and
  // use the app; in the app it is the quiet way back to the story.
  const route =
    page === "landing"
      ? {
          href: appHref(language),
          full: "Open the app",
          short: "App",
          className: "primary",
        }
      : {
          href: `/${language}`,
          full: "Back to the story",
          short: "Story",
          className: "nav-link",
        };

  return (
    <nav
      className="nav"
      aria-label={t("Primary")}
      data-scrolled={scrolled}
      data-page={page}
    >
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

        {props.page === "app" && (
          <div className="nav-modes">
            <ModeSwitcher mode={props.mode} onChange={props.onModeChange} />
          </div>
        )}

        <div className="nav-actions">
          {story && <StoryNavControls {...story} active={active} />}
          <a
            className={`${route.className} nav-cta`}
            href={route.href}
            aria-label={t(route.full)}
          >
            <span className="nav-cta-full">{t(route.full)}</span>
            <span className="nav-cta-short" aria-hidden="true">
              {t(route.short)}
            </span>
          </a>
          <div className="nav-languages" aria-label={t("Language")}>
            {LANGUAGES.map((code) => (
              <a
                key={code}
                className="nav-language"
                href={withLanguage(pathname, code)}
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
