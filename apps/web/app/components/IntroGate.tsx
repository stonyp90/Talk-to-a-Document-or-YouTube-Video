"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { useLanguage } from "../i18n/LanguageProvider";

export const INTRO_STORAGE_KEY = "ursly-intro-v1";
const INTRO_SECONDS = 24;

/** The on-screen text of the video, sequenced, for people who cannot watch it. */
const TRANSCRIPT = [
  "Ursly. A source. A conversation.",
  "Bring a document or a video. Ursly reads it for you.",
  "Ask by voice, by keyboard, and soon by movement.",
  "Source, question, understanding.",
];

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
 * The 24-second introduction, shown once on a first visit and on request from
 * the menu. A native dialog keeps focus inside and the page inert behind it.
 * The video is silent and muted, so it may start on its own; anyone who would
 * rather not watch has a skip control from the first frame, and people who ask
 * their system for less motion get a poster, a play button and the text.
 */
export function IntroGate({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { language, t } = useLanguage();
  const dialog = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [reduced, setReduced] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [failed, setFailed] = useState(false);
  const [progress, setProgress] = useState(0);

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
      else element.removeAttribute("open");
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

  const seconds = Math.max(0, Math.ceil(INTRO_SECONDS * (1 - progress)));

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
      }}
    >
      <div className="intro-gate-inner">
        <header className="intro-gate-bar">
          <span className="intro-gate-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/ursly-mark.svg" width="28" height="28" alt="" />
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
          <h2 id="intro-title">{t("Ursly, in 24 seconds.")}</h2>
          <p id="intro-lede">
            {t("A source, a question, and a conversation that stays grounded in what you brought.")}
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
              poster="/brand/social-card.png"
              onTimeUpdate={(event) => {
                const player = event.currentTarget;
                if (player.duration) setProgress(player.currentTime / player.duration);
              }}
              onPlaying={() => setAutoplayBlocked(false)}
              onEnded={finish}
              onError={() => setFailed(true)}
            >
              <source src={`/brand/ursly-intro.${language}.webm`} type="video/webm" />
              <source src={`/brand/ursly-intro.${language}.mp4`} type="video/mp4" />
              <track
                kind="captions"
                srcLang={language}
                src={`/brand/ursly-intro.${language}.vtt`}
                label={language === "fr" ? "Français" : "English"}
              />
            </video>
          ) : failed ? (
            <div className="intro-fallback" role="status">
              <strong>{t("The intro is unavailable right now.")}</strong>
              <ol className="intro-transcript-list">
                {TRANSCRIPT.map((line) => (
                  <li key={line}>{t(line)}</li>
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
              ? t("Skip whenever you like. The app is right behind this.")
              : t("Continues to the app in {seconds} s", { seconds })}
          </p>
          <details className="intro-transcript" open={reduced}>
            <summary>{t("Read the intro instead")}</summary>
            <ol className="intro-transcript-list">
              {TRANSCRIPT.map((line) => (
                <li key={line}>{t(line)}</li>
              ))}
            </ol>
          </details>
        </div>
      </div>
    </dialog>
  );
}
