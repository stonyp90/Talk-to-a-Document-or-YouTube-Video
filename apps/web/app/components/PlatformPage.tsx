"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { Applications } from "./Applications";
import { HowItWorks } from "./HowItWorks";
import { IntroGate } from "./IntroGate";
import type { EntryMode } from "./ModeSwitcher";
import { PlatformSection } from "./PlatformSection";
import { Process } from "./Process";
import { TopNav } from "./TopNav";
import { useLanguage } from "../i18n/LanguageProvider";

const MODE_STORAGE_KEY = "ursly-mode-v1";

function readSavedMode(): EntryMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "text" ? "text" : "voice";
  } catch {
    return "voice";
  }
}

function subscribeToStorage(notify: () => void): () => void {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
}

/**
 * The story, on its own page. The workspace route carries the tool alone, so a
 * visitor who came to add a source is never scrolled past the pitch first.
 */
export default function PlatformPage() {
  const { t, language } = useLanguage();
  const savedMode = useSyncExternalStore(
    subscribeToStorage,
    readSavedMode,
    () => "voice" as EntryMode,
  );
  const [chosenMode, setChosenMode] = useState<EntryMode | null>(null);
  const mode: EntryMode = chosenMode ?? savedMode;
  const [introOpen, setIntroOpen] = useState(false);
  const replayButton = useRef<HTMLButtonElement>(null);

  const switchMode = useCallback((next: EntryMode) => {
    setChosenMode(next);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, next);
    } catch {
      // A blocked store only costs the preference, never the page.
    }
  }, []);

  const closeIntro = useCallback(() => setIntroOpen(false), []);
  const focusAfterIntro = useCallback(() => replayButton.current?.focus(), []);

  return (
    <>
      <TopNav
        mode={mode}
        onModeChange={switchMode}
        onReplayIntro={() => setIntroOpen(true)}
        replayButton={replayButton}
      />
      <IntroGate
        open={introOpen}
        onClose={closeIntro}
        onClosed={focusAfterIntro}
      />
      <main className="shell">
        <div className="container">
          <PlatformSection onReplayIntro={() => setIntroOpen(true)} />
          <Process locale={language} />
          <HowItWorks />
          <Applications />
          <footer className="footer">
            <span>{t("Ursly · Made for your next “aha”.")}</span>
            <span className="footer-links">
              <a href={`/${language}`}>{t("Add a source")} →</a>
            </span>
          </footer>
        </div>
      </main>
    </>
  );
}
