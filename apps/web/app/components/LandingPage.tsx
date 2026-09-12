"use client";

import {
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
} from "react";
import { Applications } from "./Applications";
import { HowItWorks } from "./HowItWorks";
import { Icon } from "./Icon";
import { IntroGate, hasSeenIntro } from "./IntroGate";
import { PlatformSection } from "./PlatformSection";
import { Process } from "./Process";
import { SiteFooter } from "./SiteFooter";
import { TopNav } from "./TopNav";
import { useHydrated } from "./useHydrated";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  STORY_SECTIONS,
  appHref as appHrefFor,
  type StorySectionId,
} from "../content/story";

function subscribeToStorage(notify: () => void): () => void {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
}

/** What every section of the story needs, and nothing more. */
type StoryContext = {
  language: string;
  appHref: string;
  onReplayIntro: () => void;
};

/**
 * Each section, by the identifier the order is written in. Keeping the two
 * apart means the order can change without touching a single component, and
 * a section can never be rendered twice or forgotten.
 */
const STORY_VIEWS: Record<StorySectionId, ComponentType<StoryContext>> = {
  "how-we-build": ({ language, appHref }) => (
    <Process locale={language} appHref={appHref} />
  ),
  platform: ({ appHref, onReplayIntro }) => (
    <PlatformSection appHref={appHref} onReplayIntro={onReplayIntro} />
  ),
  "how-it-works": ({ appHref }) => <HowItWorks appHref={appHref} />,
  applications: () => <Applications />,
};

/**
 * The front door: what Ursly is, the 24-second introduction, and the story
 * behind it — how we build first, then the platform, the guide and the mobile
 * applications. The application itself lives at `/<lang>/app`; this page
 * deliberately holds none of its state, so nothing about a conversation can
 * be reached or broken from the story, and every section ends with the way
 * into it.
 */
export default function LandingPage() {
  const { t, language } = useLanguage();
  const appHref = appHrefFor(language);
  const hydrated = useHydrated();
  // The server never shows the intro; a first visit opens it after hydration.
  const firstVisit = useSyncExternalStore(
    subscribeToStorage,
    () => !hasSeenIntro(),
    () => false,
  );
  const [introOverride, setIntroOverride] = useState<boolean | null>(null);
  const introOpen = introOverride ?? firstVisit;
  const introOrigin = useRef<"first" | "replay">("first");
  const replayButton = useRef<HTMLButtonElement>(null);
  const heroCta = useRef<HTMLAnchorElement>(null);

  function openIntro() {
    introOrigin.current = "replay";
    setIntroOverride(true);
  }

  function closeIntro() {
    setIntroOverride(false);
  }

  // Land where the next step is: the way into the app on a first visit, the
  // menu button that opened the replay otherwise. Runs once the dialog has
  // closed, after the browser has restored focus to whatever had it before.
  function focusAfterIntro() {
    if (introOrigin.current === "replay") {
      replayButton.current?.focus();
      return;
    }
    (heroCta.current ?? document.getElementById("main"))?.focus();
  }

  const story: StoryContext = { language, appHref, onReplayIntro: openIntro };

  return (
    <>
      <a className="skip-link" href="#main">
        {t("Skip to content")}
      </a>
      <TopNav
        page="landing"
        onReplayIntro={openIntro}
        replayButton={replayButton}
      />
      <IntroGate
        open={introOpen}
        onClose={closeIntro}
        onClosed={focusAfterIntro}
      />

      <main className="shell" id="main" tabIndex={-1}>
        <div className="container">
          <section className="hero landing-hero" aria-labelledby="hero-heading">
            <span className="eyebrow">{t("Voice first")}</span>
            <h1 id="hero-heading">
              {t("Less scrolling.")} <span>{t("More understanding.")}</span>
            </h1>
            <p className="lede">
              {t(
                "Bring a PDF or a captioned YouTube video, ask by voice or keyboard, and get answers that stay anchored to your source.",
              )}
            </p>
            <div className="hero-actions">
              <a ref={heroCta} className="primary" href={appHref}>
                <Icon name="arrow" /> {t("Open the app")}
              </a>
              <button
                type="button"
                className="secondary"
                onClick={openIntro}
                disabled={!hydrated}
              >
                <Icon name="play" /> {t("Watch the intro")} · 24 s
              </button>
            </div>
            <p className="hero-note">
              {t(
                "The story first: how this was built, what it is, and how to use it. The app is one tap away from anywhere on this page.",
              )}
            </p>
          </section>

          {STORY_SECTIONS.map((section) => {
            const Section = STORY_VIEWS[section.id];
            return <Section key={section.id} {...story} />;
          })}

          <section className="invitation" aria-labelledby="invitation-heading">
            <div className="invitation-copy">
              <span className="eyebrow">{t("Your turn")}</span>
              <h2 id="invitation-heading">
                {t("That is the story. Now bring a document.")}
              </h2>
              <p>
                {t(
                  "A PDF or a captioned YouTube video, a question out loud, and an answer that stays anchored to what you brought.",
                )}
              </p>
            </div>
            <a className="primary invitation-action" href={appHref}>
              <Icon name="arrow" /> {t("Open the app")}
            </a>
          </section>

          <SiteFooter page="landing" appHref={appHref} />
        </div>
      </main>
    </>
  );
}
