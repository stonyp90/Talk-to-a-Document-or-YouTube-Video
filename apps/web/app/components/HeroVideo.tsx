"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { useLanguage } from "../i18n/LanguageProvider";
import { introVideoPaths } from "../content/intro-video";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * The landing page's hero: the intro film, inline, filling the viewport.
 *
 * One video, one glance. The film already tells the whole story — a source
 * going in, a question out loud, an answer anchored to what was brought.
 * The overlay carries only the tagline and the way in, because the video
 * is the interface and the text is there to anchor it, not to explain it.
 */
export function HeroVideo({ appHref }: { appHref: string }) {
  const { language, t } = useLanguage();
  const sources = introVideoPaths(language);
  const video = useRef<HTMLVideoElement>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [reduced] = useState(prefersReducedMotion);

  useEffect(() => {
    const player = video.current;
    if (!player || reduced) return;
    player.muted = true;
    player.defaultMuted = true;
    player.setAttribute("muted", "");
    const attempt = player.play();
    if (attempt) attempt.catch(() => setAutoplayBlocked(true));
    return () => {
      player.pause();
    };
  }, [reduced]);

  return (
    <section className="hero-video" aria-labelledby="hero-video-heading">
      <h2 id="hero-video-heading" className="visually-hidden">
        {t("Talk to a document or a video.")}
      </h2>

      <div className="hero-video-stage">
        {!reduced ? (
          <video
            ref={video}
            className="hero-video-player"
            autoPlay
            muted
            playsInline
            loop
            preload="auto"
            poster={sources.poster}
            onPlaying={() => setAutoplayBlocked(false)}
          >
            <source src={sources.webm} type="video/webm" />
            <source src={sources.mp4} type="video/mp4" />
          </video>
        ) : (
          <img
            className="hero-video-poster"
            src={sources.poster}
            alt={t("Talk to a document or a video.")}
          />
        )}

        {(autoplayBlocked || reduced) && (
          <button
            type="button"
            className="hero-video-play"
            onClick={() => {
              setAutoplayBlocked(false);
              void video.current?.play();
            }}
          >
            <Icon name="play" /> {t("Play")}
          </button>
        )}
      </div>

      <div className="hero-video-overlay">
        <a className="primary hero-video-cta" href={appHref}>
          <Icon name="arrow" /> {t("Open the app")}
        </a>
      </div>
    </section>
  );
}
