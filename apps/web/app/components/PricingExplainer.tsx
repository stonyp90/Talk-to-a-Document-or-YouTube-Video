"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PricingCopy } from "../content/pricing";
import styles from "./PricingExplainer.module.css";

const PLAYBACK_MS = 8400;

/** The two exchanges remain readable before, during, and after playback. */
export function PricingExplainer({ copy }: { copy: PricingCopy }) {
  const words = copy.animation;
  const root = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [take, setTake] = useState(0);

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    setPlaying(false);
  }, []);

  const play = useCallback(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    clearTimeout(timer.current);
    setTake((current) => current + 1);
    setPlaying(true);
    timer.current = setTimeout(() => setPlaying(false), PLAYBACK_MS);
  }, []);

  useEffect(() => {
    const element = root.current;
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!element || !window.IntersectionObserver) {
      return () => clearTimeout(timer.current);
    }
    let started = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started && !preference?.matches) {
          started = true;
          play();
        } else if (!entry.isIntersecting) {
          stop();
        }
      },
      { threshold: 0.35 },
    );
    observer.observe(element);
    const onPreference = () => {
      if (preference?.matches) stop();
    };
    preference?.addEventListener("change", onPreference);
    return () => {
      observer.disconnect();
      preference?.removeEventListener("change", onPreference);
      clearTimeout(timer.current);
    };
  }, [play, stop]);

  return (
    <div
      className={styles.explainer}
      ref={root}
      role="group"
      aria-label={words.label}
      data-playing={playing}
    >
      <div className={styles.paths} key={take}>
        <div className={styles.lane} data-contribution="training">
          <div className={styles.choice}>
            <h3>{words.freeHeading}</h3>
            <span className={styles.badge}>{copy.plans[0].name}</span>
          </div>
          <div className={styles.diagram} aria-hidden="true">
            <div className={styles.node}>
              <span className={styles.symbol}>
                <svg viewBox="0 0 48 48">
                  <path d="M11 9h26a5 5 0 0 1 5 5v16a5 5 0 0 1-5 5H21l-10 6v-6a5 5 0 0 1-5-5V14a5 5 0 0 1 5-5Z" />
                  <path d="M15 19h18M15 26h12" />
                </svg>
              </span>
              <span>{words.conversations}</span>
            </div>
            <div className={styles.connection}>
              <span className={styles.traveller} />
              <span className={styles.traveller} />
              <span className={styles.traveller} />
            </div>
            <div className={styles.node}>
              <span className={`${styles.symbol} ${styles.destination}`}>
                <svg viewBox="0 0 48 48">
                  <path d="m13 14 22 0M13 14l11 23 11-23M13 14l11 10 11-10M24 24v13" />
                  <circle cx="13" cy="14" r="5" />
                  <circle cx="35" cy="14" r="5" />
                  <circle cx="24" cy="37" r="5" />
                  <circle cx="24" cy="24" r="4" />
                </svg>
              </span>
              <span>{words.models}</span>
            </div>
          </div>
          <p className={styles.result}>{words.freeResult}</p>
        </div>

        <div className={styles.lane} data-contribution="payment">
          <div className={styles.choice}>
            <h3>{words.paidHeading}</h3>
            <span className={styles.badge}>{copy.plans[1].name}</span>
          </div>
          <div className={styles.diagram} aria-hidden="true">
            <div className={styles.node}>
              <span className={styles.symbol}>
                <svg viewBox="0 0 48 48">
                  <rect x="5" y="11" width="38" height="27" rx="5" />
                  <path d="M5 20h38M12 30h8M25 30h4" />
                </svg>
              </span>
              <span>{words.payment}</span>
            </div>
            <div className={styles.connection}>
              <span className={styles.traveller} />
              <span className={styles.traveller} />
              <span className={styles.traveller} />
            </div>
            <div className={styles.node}>
              <span className={`${styles.symbol} ${styles.destination}`}>
                <svg viewBox="0 0 48 48">
                  <path d="M10 19v10M17 12v24M24 7v34M31 12v24M38 19v10" />
                </svg>
              </span>
              <span>{words.app}</span>
            </div>
          </div>
          <p className={styles.result}>
            <svg className={styles.lock} viewBox="0 0 24 24" aria-hidden="true">
              <rect x="5" y="10" width="14" height="11" rx="3" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
            </svg>
            {words.paidResult}
          </p>
        </div>
      </div>
      <div className={styles.footer}>
        <p>
          <strong>{words.sameFeatures}</strong>
          <span>{words.voiceConsent}</span>
        </p>
        <button
          className={styles.replay}
          onClick={playing ? stop : play}
          type="button"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {playing ? (
              <path d="M9 5v14M15 5v14" />
            ) : (
              <path d="M4 10a8 8 0 1 1 1 7M4 4v6h6" />
            )}
          </svg>
          {playing ? words.pause : words.replay}
        </button>
      </div>
    </div>
  );
}
