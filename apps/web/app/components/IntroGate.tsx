"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { TopNav } from "./TopNav";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  INTRO_DURATION_SECONDS,
  INTRO_SCENES,
  INTRO_SCENE_SECONDS,
  INTRO_TITLE_KEY,
  introVideoPaths,
} from "../content/intro-video";

/**
 * Which scene the film is on, `seconds` in. Every scene runs the same length,
 * so the answer is a division rather than a table of boundaries, and a player
 * that reports a time past the end still names the last scene.
 */
export function sceneAt(seconds: number): number {
  const index = Math.floor(Math.max(0, seconds) / INTRO_SCENE_SECONDS);
  return Math.min(INTRO_SCENES.length - 1, index);
}

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
  const [elapsed, setElapsed] = useState(0);

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
      setElapsed(0);
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

  const seconds = Math.max(0, Math.ceil(INTRO_DURATION_SECONDS - elapsed));
  /** The scene on screen, which is the chapter the rail marks as current. */
  const chapter = sceneAt(elapsed);

  /** Jump to the start of a chapter, and keep playing from there. */
  function goTo(index: number) {
    const player = video.current;
    const wanted = Math.min(Math.max(0, index), INTRO_SCENES.length - 1);
    const at = wanted * INTRO_SCENE_SECONDS;
    setElapsed(at);
    if (!player) return;
    player.currentTime = at;
    // Seeking is a deliberate act, so it is also a request to watch: a reader
    // who has paused and then picked a chapter meant to see that chapter.
    // Not every browser returns a promise from play(), and a test DOM returns
    // nothing at all; calling .catch on that would end the seek in an error.
    if (player.paused && !reduced) void player.play()?.catch(() => {});
  }

  return (
    <dialog
      ref={dialog}
      className="intro-gate"
      aria-labelledby="intro-title"
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
        {/* One wordmark on screen, and it is the film's. The bar used to set
            a second one directly above the product's own, at the same size,
            so a first visit met the name twice before meeting the argument. */}
        {/* The site's own bar, from the site's own component, carrying only
            the way out. Nothing about the chrome should tell a visitor that
            the film and the page are two different surfaces. */}
        <TopNav
          page="intro"
          trailing={
            <button
              type="button"
              className="intro-skip"
              autoFocus
              onClick={finish}
            >
              {t("Skip intro")} <Icon name="close" />
            </button>
          }
        />
        {/* The dialog needs a name; it does not need a second Ursly on the
            screen to say it. */}
        <h2 id="intro-title" className="visually-hidden">
          {t(INTRO_TITLE_KEY)}
        </h2>

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
              onTimeUpdate={(event) =>
                setElapsed(event.currentTarget.currentTime)
              }
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

        {/* The film's argument, at a size a phone can read. It is the same
            sentence the frame carries, so it is hidden from assistive
            technology: the transcript below states the whole film once. */}
        {!failed && open ? (
          <p
            className="intro-scene"
            aria-hidden="true"
            data-testid="intro-scene"
          >
            <strong key={INTRO_SCENES[chapter].id}>
              {t(INTRO_SCENES[chapter].headline)}
            </strong>
            <span key={`${INTRO_SCENES[chapter].id}-lede`}>
              {t(INTRO_SCENES[chapter].lede)}
            </span>
          </p>
        ) : null}

        <div className="intro-gate-footer">
          {/* The film's own progress row, made of the thing it measures. Each
              chapter fills as it plays and can be jumped to, so a reader who
              missed a line can go back to it rather than watching the whole
              film again or giving up on it. */}
          <div className="intro-chapters-row">
            <button
              type="button"
              className="intro-step"
              onClick={() => goTo(chapter - 1)}
              disabled={chapter === 0}
              aria-label={t("Previous chapter")}
            >
              <Icon name="arrow" />
            </button>
            <ol className="intro-chapters" aria-label={t("Chapters")}>
              {INTRO_SCENES.map((scene, index) => {
                const filled = Math.min(
                  1,
                  Math.max(0, elapsed / INTRO_SCENE_SECONDS - index),
                );
                return (
                  <li key={scene.id} className="intro-chapter">
                    <button
                      type="button"
                      aria-current={index === chapter ? "step" : undefined}
                      onClick={() => goTo(index)}
                    >
                      <span className="intro-chapter-tick" aria-hidden="true">
                        <span style={{ transform: `scaleX(${filled})` }} />
                      </span>
                      {/* The film numbers its scenes and names none of them;
                          six headlines side by side would be six truncations.
                          The one being watched is named under the rail. */}
                      <span className="intro-chapter-index" aria-hidden="true">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="visually-hidden">
                        {t(scene.headline)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <button
              type="button"
              className="intro-step"
              onClick={() => goTo(chapter + 1)}
              disabled={chapter === INTRO_SCENES.length - 1}
              aria-label={t("Next chapter")}
            >
              <Icon name="arrow" />
            </button>
          </div>
          <p className="intro-timing">
            {/* Which scene is on screen, in its own words, so the rail above
                is read as an index of the film rather than a row of ticks. */}
            <b className="intro-now">{t(INTRO_SCENES[chapter].headline)}</b>{" "}
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
