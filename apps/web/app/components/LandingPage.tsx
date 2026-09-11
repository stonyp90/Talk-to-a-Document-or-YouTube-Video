"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { Applications } from "./Applications";
import { HowItWorks } from "./HowItWorks";
import { Icon } from "./Icon";
import { IntroGate, hasSeenIntro } from "./IntroGate";
import { PlatformSection } from "./PlatformSection";
import { Process } from "./Process";
import { SiteFooter } from "./SiteFooter";
import { TopNav } from "./TopNav";
import { useLanguage } from "../i18n/LanguageProvider";

function subscribeToStorage(notify: () => void): () => void {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
}

/**
 * The front door: what Ursly is, the 24-second introduction, and the story
 * behind it — the platform, how we build, from information to understanding,
 * and the mobile applications. The application itself lives at `/<lang>/app`
 * and is one tap away from here; this page deliberately holds none of its
 * state, so nothing about a conversation can be reached or broken from the
 * story.
 */
export default function LandingPage() {
  const { t, language } = useLanguage();
  const appHref = `/${language}/app`;
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
              <button type="button" className="secondary" onClick={openIntro}>
                <Icon name="play" /> {t("Watch the intro")} · 24 s
              </button>
            </div>
          </section>

          <PlatformSection onReplayIntro={openIntro} />
          <Process locale={language} appHref={appHref} />
          <HowItWorks />
          <Applications />
          <SiteFooter page="landing" />
        </div>
      </main>
    </>
  );
}
