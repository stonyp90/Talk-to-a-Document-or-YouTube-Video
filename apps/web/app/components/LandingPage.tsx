"use client";

import {
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentType,
  type RefObject,
} from "react";
import { Applications } from "./Applications";
import { Arrival } from "./Arrival";
import { HowItWorks } from "./HowItWorks";
import { Icon } from "./Icon";
import { IntroGate, hasSeenIntro } from "./IntroGate";
import { PlatformSection } from "./PlatformSection";
import { useLoopWalk, type Loop } from "./useLoopWalk";
import { SiteFooter } from "./SiteFooter";
import { TopNav } from "./TopNav";
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
  /** The one walk around the build loop, drawn on the first screen. */
  loop: Loop;
  /** Where focus lands when the introduction hands the page over. */
  heroCta: RefObject<HTMLAnchorElement | null>;
};

/**
 * Each section, by the identifier the order is written in. Keeping the two
 * apart means the order can change without touching a single component, and
 * a section can never be rendered twice or forgotten.
 */
const STORY_VIEWS: Record<StorySectionId, ComponentType<StoryContext>> = {
  // The first screen and the first section are one thing: the film ends on
  // the loop and the page opens on it, whole, rather than promising it here
  // and explaining it a screen further down.
  "how-we-build": ({ language, appHref, loop, onReplayIntro, heroCta }) => (
    <Arrival
      language={language}
      appHref={appHref}
      loop={loop}
      onReplayIntro={onReplayIntro}
      heroCta={heroCta}
    />
  ),
  platform: ({ appHref, onReplayIntro }) => (
    <PlatformSection appHref={appHref} onReplayIntro={onReplayIntro} />
  ),
  "how-it-works": ({ appHref }) => <HowItWorks appHref={appHref} />,
  applications: () => <Applications />,
};

/**
 * The front door: what Ursly is, the introduction that opens it, and the story
 * behind it — how we build first, then the platform, the guide and the mobile
 * applications. The application itself lives at `/<lang>/app`; this page
 * deliberately holds none of its state, so nothing about a conversation can
 * be reached or broken from the story, and every section ends with the way
 * into it.
 */
export default function LandingPage() {
  const { t, language } = useLanguage();
  const appHref = appHrefFor(language);
  const loop = useLoopWalk();
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

  const story: StoryContext = {
    language,
    appHref,
    onReplayIntro: openIntro,
    loop,
    heroCta,
  };

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
