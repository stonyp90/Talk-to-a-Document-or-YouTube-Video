"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  INTRO_DURATION_SECONDS,
  INTRO_SCENES,
  INTRO_TITLE_KEY,
  introVideoPaths,
} from "../content/intro-video";

export const INTRO_STORAGE_KEY = "ursly-intro-v1";

export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(INTRO_STORAGE_KEY) === "seen";
  } catch {
    return false;
  }
}

function rememberIntro() {
  try {
    localStorage.setItem(INTRO_STORAGE_KEY, "seen");
  } catch {
    /* Without storage the intro simply plays again next time. */
  }
}

function prefersReducedMotion(): boolean {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The introduction, shown once on a first visit and on request from the menu.
 * Its length, its title and its transcript all come from the content file, so
 * the film can gain or lose a scene without anyone editing this component.
 * A native dialog keeps focus inside and the page inert behind it. The video
 * is silent and muted, so it may start on its own; anyone who would rather not
 * watch has a skip control from the first frame, and people who ask their
 * system for less motion get a poster, a play button and the text.
 */
export function IntroGate({
  open,
  onClose,
  onClosed,
}: {
  open: boolean;
  /** The visitor skipped, the video ended, or Escape was pressed. */
  onClose: () => void;
  /** The dialog has actually closed; safe to move focus. */
  onClosed?: () => void;
}) {
  const { language, t } = useLanguage();
  const sources = introVideoPaths(language);
  // The same sentences the film puts on screen, for anyone who cannot watch
  // it. Each half is translated on its own because that is how the dictionary
  // keys them: asking for the joined line would be asking for a sentence no
  // translator has ever seen, and a French reader would quietly get English.
  const transcript = INTRO_SCENES.map(
    (scene) => `${t(scene.headline)} ${t(scene.lede)}`,
  );
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);

  // The hand-off runs from the dialog's own close event: closing a modal
  // dialog restores focus to whatever had it before, so anything focused
  // earlier would be undone.
  const onClosedRef = useRef(onClosed);
  useEffect(() => {
    onClosedRef.current = onClosed;
  }, [onClosed]);

  // Open and close the native dialog in step with the prop.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      setReduced(prefersReducedMotion());
      setAutoplayBlocked(false);
      setFailed(false);
      setProgress(0);
      // A test DOM may lack the dialog API; the attribute still shows it.
      if (typeof element.showModal === "function") element.showModal();
      else element.setAttribute("open", "");
    } else if (!open && element.open) {
      if (typeof element.close === "function") element.close();
      else {
        element.removeAttribute("open");
        onClosedRef.current?.();
      }
    }
  }, [open]);

  // Start the silent video; when the browser refuses, offer a play button.
  useEffect(() => {
    const player = video.current;
    if (!open || !player) return;
    player.muted = true;
    player.defaultMuted = true;
    player.setAttribute("muted", "");
    if (reduced) {
      player.pause();
      return;
    }
    const attempt = player.play();
    if (attempt) attempt.catch(() => setAutoplayBlocked(true));
    const pauseWhenHidden = () => {
      if (document.hidden) player.pause();
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      player.pause();
    };
  }, [open, reduced]);

  function finish() {
    rememberIntro();
    onClose();
  }

  const seconds = Math.max(
    0,
    Math.ceil(INTRO_DURATION_SECONDS * (1 - progress)),
  );

  return (
    <dialog
      ref={dialog}
      className="intro-gate"
      aria-labelledby="intro-title"
      aria-describedby="intro-lede"
      onCancel={(event) => {
        event.preventDefault();
        finish();
      }}
      onClose={() => {
        if (open) finish();
        onClosedRef.current?.();
      }}
    >
      <div className="intro-gate-inner">
        <header className="intro-gate-bar">
          {/* The same wordmark, at the same size, as the menu the visitor
              lands on when the film ends: one brand, one scale, nothing
              restyled between the introduction and the page it introduces. */}
          <span className="brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="brand-mark"
              src="/brand/ursly-mark.svg"
              width="32"
              height="32"
              alt=""
            />
            ursly<span className="brand-dot">.</span>
          </span>
          <button
            type="button"
            className="intro-skip"
            autoFocus
            onClick={finish}
          >
            {t("Skip intro")} <Icon name="close" />
          </button>
        </header>

        <div className="intro-gate-copy">
          <span className="eyebrow">{t("Welcome")}</span>
          <h2 id="intro-title">
            {t(INTRO_TITLE_KEY, { seconds: INTRO_DURATION_SECONDS })}
          </h2>
          <p id="intro-lede">
            {t(
              "A source, a question, and a conversation that stays grounded in what you brought.",
            )}
          </p>
        </div>

        <div className="intro-stage" data-reduced={reduced}>
          {/* The video exists only while the dialog is open, so a returning
              visitor downloads nothing. */}
          {!failed && open ? (
            <video
              ref={video}
              className="intro-player"
              autoPlay={!reduced}
              muted
              playsInline
              preload="auto"
              controls={reduced || autoplayBlocked}
              poster={sources.poster}
              onTimeUpdate={(event) => {
                const player = event.currentTarget;
                if (player.duration)
                  setProgress(player.currentTime / player.duration);
              }}
              onPlaying={() => setAutoplayBlocked(false)}
              onEnded={finish}
              onError={() => setFailed(true)}
            >
              <source src={sources.webm} type="video/webm" />
              <source src={sources.mp4} type="video/mp4" />
              <track
                kind="captions"
                srcLang={language}
                src={sources.captions}
                label={language === "fr" ? "Français" : "English"}
              />
            </video>
          ) : failed ? (
            <div className="intro-fallback" role="status">
              <strong>{t("The intro is unavailable right now.")}</strong>
              <ol className="intro-transcript-list">
                {transcript.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {(reduced || autoplayBlocked) && !failed && open && (
            <button
              type="button"
              className="primary intro-play"
              onClick={() => {
                setAutoplayBlocked(false);
                setReduced(false);
                void video.current?.play();
              }}
            >
              <Icon name="play" /> {t("Play the intro")}
            </button>
          )}
        </div>

        <div className="intro-gate-footer">
          <div
            className="intro-progress"
            role="progressbar"
            aria-label={t("Intro progress")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <span style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="intro-timing">
            {reduced || autoplayBlocked || failed
              ? t("Skip whenever you like. Ursly is right behind this.")
              : t("Continues in {seconds} s", { seconds })}
          </p>
          <details className="intro-transcript" open={reduced}>
            <summary>{t("Read the intro instead")}</summary>
            <ol className="intro-transcript-list">
              {transcript.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ol>
          </details>
        </div>
      </div>
    </dialog>
  );
}
