"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type RefObject,
} from "react";
import { usePathname } from "next/navigation";
import { BrandIcon } from "./BrandIcon";
import { Brand } from "./Brand";
import { Icon } from "./Icon";
import { ModeSwitcher, type EntryMode } from "./ModeSwitcher";
import { useHydrated } from "./useHydrated";
import { useLanguage } from "../i18n/LanguageProvider";
import { LANGUAGES, withLanguage, type Language } from "../i18n/languages";
import { MENU_SECTIONS, appHref } from "../content/story";
import { appDownloads, releaseNotesUrl } from "../content/downloads";

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
  window.addEventListener("resize", notify, { passive: true });
  return () => {
    window.removeEventListener("scroll", notify);
    window.removeEventListener("resize", notify);
  };
}

/** How much of the page is behind the reader, from 0 at the top to 1 at the end. */
function readProgress(): number {
  const travel = document.documentElement.scrollHeight - window.innerHeight;
  if (travel <= 0) return 0;
  return Math.min(1, Math.max(0, window.scrollY / travel));
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

/**
 * The introduction wears the same bar the site wears, from the same component:
 * the same panel, the same glass, the same lockup at the same size. It carries
 * none of the site's controls, because inside the film there is nowhere for
 * them to go — only the one way out of it. Making this a variant rather than a
 * second bar that resembles the first is the whole point: two bars drift, and
 * a visitor who sees them drift is being told they are on two different
 * products.
 */
type IntroChrome = { page: "intro"; trailing: ReactNode };

type TopNavProps =
  | StoryControls
  | IntroChrome
  | {
      page: "app";
      mode: EntryMode;
      onModeChange: (mode: EntryMode) => void;
    };

/**
 * The index of the story, in the middle of the bar. It holds the same slot
 * the control modes hold in the application: whatever the page is really
 * about sits at the centre of the instrument, never off to one side.
 */
function StorySectionRail({ active }: { active?: string }) {
  const { t } = useLanguage();
  return (
    <div className="nav-sections">
      {SECTIONS.map((section, position) => (
        <a
          key={section.id}
          className="nav-link nav-section-link"
          data-section={section.id}
          href={`#${section.id}`}
          aria-label={t(section.label)}
          aria-current={active === section.id ? "location" : undefined}
        >
          {/* The bar reads as an index of the story rather than a row of
              links, so each anchor wears its number. Decoration only: the
              accessible name stays the section's real name. */}
          <span className="nav-index" aria-hidden="true">
            {String(position + 1).padStart(2, "0")}
          </span>
          {/* The full label where the bar is wide, the short one where it is
              not. */}
          <span className="nav-section-full">{t(section.label)}</span>
          <span className="nav-section-short" aria-hidden="true">
            {t(section.short)}
          </span>
        </a>
      ))}
    </div>
  );
}

/**
 * Replaying the introduction: landing-page furniture, in its own component so
 * the button's ref arrives as a plain parameter rather than being read off a
 * narrowed props object during render.
 */
function IntroReplayButton({
  onReplayIntro,
  replayButton,
}: Omit<StoryControls, "page">) {
  const { t } = useLanguage();
  const hydrated = useHydrated();
  return (
    <button
      ref={replayButton}
      type="button"
      className="nav-link nav-intro"
      onClick={onReplayIntro}
      disabled={!hydrated}
      aria-label={t("Watch the intro")}
      title={t("Watch the intro")}
    >
      <Icon name="play" />
      <span className="nav-intro-label">{t("Watch the intro")}</span>
    </button>
  );
}

/**
 * The fixed top menu: brand, the control modes on the app page, the story
 * anchors and the intro replay on the landing page, the route between the
 * two, and the language. It never scrolls away, so the way in or out is one
 * tap from anywhere on either page.
 */
/**
 * "Get the app", beside the way into the web application and deliberately not
 * the same thing: that one opens Ursly in the browser, this one descends to
 * the applications section, where the builds you install actually live.
 *
 * So the control is a plain anchor first. Pressing it always lands the reader
 * on the downloads, with no state to guess at and nothing that depends on
 * JavaScript having run. Reaching it — hovering, or arriving by keyboard —
 * additionally offers the two builds directly, for the reader who already
 * knows which file they came for and would rather not scroll at all.
 */
function AppDownloadsMenu({ prefix }: { prefix: string }) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const holder = useRef<HTMLDivElement>(null);

  // It closes the way every menu does: a press outside it, or Escape.
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: Event) => {
      if (!holder.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", dismiss);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div
      className="nav-downloads"
      ref={holder}
      onPointerEnter={() => setOpen(true)}
      onPointerLeave={() => setOpen(false)}
      // Focus and blur bubble in React, so the shortcuts open for a reader
      // arriving on the anchor by keyboard and close when they tab past the
      // last one, without the holder having to know which child has focus.
      onFocus={() => setOpen(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          setOpen(false);
      }}
    >
      <a
        className="nav-link nav-download"
        href={`${prefix}#applications`}
        data-open={open}
        // The label is hidden on a narrow screen, which would leave the
        // control with nothing but an icon to announce itself by.
        aria-label={t("Get the app")}
        title={t("Get the app")}
        onClick={() => setOpen(false)}
      >
        <Icon name="download" />
        <span className="nav-download-label">{t("Get the app")}</span>
      </a>
      {open && (
        <div className="nav-download-menu">
          {appDownloads.map((build) => (
            <a
              key={build.id}
              className="nav-download-item"
              href={build.url}
              onClick={() => setOpen(false)}
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
            href={`${prefix}#applications`}
            onClick={() => setOpen(false)}
          >
            {t("All builds and instructions")}
          </a>
          <a
            className="nav-download-more"
            href={releaseNotesUrl}
            onClick={() => setOpen(false)}
          >
            {t("Release notes")} <Icon name="external" />
          </a>
        </div>
      )}
    </div>
  );
}

export function TopNav(props: TopNavProps) {
  const { page } = props;
  const story = props.page === "landing" ? props : undefined;
  const { language, t } = useLanguage();
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const active = useActiveSection(
    page === "landing" ? SECTION_IDS : NO_SECTIONS,
  );

  useEffect(() => {
    const update = () => {
      setScrolled(window.scrollY > 4);
      setProgress(readProgress());
    };
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

  // The film's bar: the same panel, and only the way out of it. Declared after
  // every hook above, so the two variants run the same ones in the same order.
  if (props.page === "intro")
    return (
      <nav className="nav" aria-label={t("Primary")} data-page="intro">
        <div className="nav-inner">
          <Brand />
          <span aria-hidden="true" />
          <div className="nav-actions">{props.trailing}</div>
        </div>
      </nav>
    );

  return (
    <>
      {/* Where the bar floats, the page still scrolls past it on every side.
          This fades that strip into the paper so nothing reads through. */}
      <span className="nav-scrim" aria-hidden="true" />
      <nav
        className="nav"
        aria-label={t("Primary")}
        data-scrolled={scrolled}
        data-page={page}
        style={{ "--nav-progress": String(progress) } as CSSProperties}
      >
        <div className="nav-inner">
          <Brand href={`/${language}`} label={t("Ursly home")} />

          {props.page === "app" ? (
            <div className="nav-modes">
              <ModeSwitcher mode={props.mode} onChange={props.onModeChange} />
            </div>
          ) : (
            <StorySectionRail active={active} />
          )}

          <div className="nav-actions">
            {/* The applications section lives on the landing page, so from the
                application the jump is a page away rather than a scroll. */}
            <AppDownloadsMenu prefix={page === "app" ? `/${language}` : ""} />
            {story && (
              <IntroReplayButton
                onReplayIntro={story.onReplayIntro}
                replayButton={story.replayButton}
              />
            )}
            <a
              className={`${route.className} nav-cta`}
              href={route.href}
              aria-label={t(route.full)}
            >
              {/* A speaking mark rather than an arrow: the way in is a voice,
                  and the rings are drawn, not written. */}
              <span className="nav-orb" aria-hidden="true">
                <span className="nav-orb-core" />
              </span>
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
        {/* How far the story has been read, drawn along the edge of the bar. */}
        <span className="nav-progress" aria-hidden="true" />
      </nav>
    </>
  );
}
