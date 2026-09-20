"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon, type IconName } from "./Icon";
import { VoiceOrb } from "./VoiceOrb";
import { useLanguage } from "../i18n/LanguageProvider";
import { introVideoPaths } from "../content/intro-video";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

type TileKind = "document" | "video" | "link";

interface StageTile {
  id: string;
  label: string;
  kind: TileKind;
}

const DEMO_TILES: StageTile[] = [
  { id: "contract", label: "Contract.pdf", kind: "document" },
  { id: "intro", label: "Product demo", kind: "video" },
  { id: "brief", label: "Project brief", kind: "document" },
  { id: "review", label: "Legal review", kind: "document" },
  { id: "walkthrough", label: "Walkthrough", kind: "video" },
];

const TILE_ICON: Record<TileKind, IconName> = {
  document: "document",
  video: "video",
  link: "arrow",
};

const DEMO_QUESTIONS: Record<string, { q: string; a: string; action: string }> =
  {
    contract: {
      q: "What is the termination clause?",
      a: "30 days written notice required by either party. Early termination incurs a penalty of two months fees.",
      action: "Extracting clause",
    },
    intro: {
      q: "Summarize the key features",
      a: "Voice-first interface, real-time document analysis, gesture control, gaze tracking, multilingual support.",
      action: "Generating summary",
    },
    brief: {
      q: "What are the deliverables?",
      a: "Three phases: discovery sprint, prototype build, production launch. Each with defined milestones.",
      action: "Mapping timeline",
    },
    review: {
      q: "Flag any risks",
      a: "Section 4.2 has ambiguous liability terms. Section 7 lacks a dispute resolution mechanism.",
      action: "Scanning for risks",
    },
    walkthrough: {
      q: "Where does the auth flow start?",
      a: "OAuth callback at /api/auth/callback, then session token stored in httpOnly cookie.",
      action: "Tracing flow",
    },
  };

type DemoPhase =
  | "idle"
  | "tiles-in"
  | "activate"
  | "question"
  | "reading"
  | "answering"
  | "action"
  | "transition";

interface DemoState {
  phase: DemoPhase;
  tileIndex: number;
  streamedText: string;
  waveformActive: boolean;
}

export function ImmersiveStage({ appHref }: { appHref: string }) {
  const { language, t } = useLanguage();
  const sources = introVideoPaths(language);
  const video = useRef<HTMLVideoElement>(null);
  const stageRef = useRef<HTMLElement>(null);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const [reduced] = useState(prefersReducedMotion);
  const [micActive, setMicActive] = useState(false);
  const [stream, setStream] = useState<MediaStream | undefined>();
  const [demo, setDemo] = useState<DemoState>({
    phase: "tiles-in",
    tileIndex: 0,
    streamedText: "",
    waveformActive: false,
  });
  const demoTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const streamInterval = useRef<ReturnType<typeof setInterval> | undefined>(
    undefined,
  );
  const userInterrupted = useRef(false);

  const [userSelectedTile, setUserSelectedTile] = useState<string | null>(null);

  const currentTile = DEMO_TILES[demo.tileIndex % DEMO_TILES.length];
  const currentDemo = DEMO_QUESTIONS[currentTile.id];

  /* ── Video autoplay ── */
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

  /* ── Demo script orchestrator ── */
  const clearDemoTimers = useCallback(() => {
    if (demoTimer.current) clearTimeout(demoTimer.current);
    if (streamInterval.current) clearInterval(streamInterval.current);
  }, []);

  const streamText = useCallback((text: string, onComplete: () => void) => {
    let i = 0;
    setDemo((d) => ({ ...d, streamedText: "" }));
    streamInterval.current = setInterval(() => {
      i++;
      if (i >= text.length) {
        if (streamInterval.current) clearInterval(streamInterval.current);
        setDemo((d) => ({ ...d, streamedText: text }));
        onComplete();
      } else {
        setDemo((d) => ({ ...d, streamedText: text.slice(0, i) }));
      }
    }, 28);
  }, []);

  const runPhase = useCallback(
    (phase: DemoPhase, duration: number, next: () => void) => {
      setDemo((d) => ({ ...d, phase }));
      demoTimer.current = setTimeout(next, duration);
    },
    [],
  );

  const runDemoCycle = useCallback(() => {
    if (reduced) return;
    clearDemoTimers();
    userInterrupted.current = false;

    const tile = DEMO_TILES[demo.tileIndex % DEMO_TILES.length];
    const demoData = DEMO_QUESTIONS[tile.id];

    // Phase: activate tile
    runPhase("activate", 2000, () => {
      if (userInterrupted.current) return;
      // Phase: show question + waveform
      setDemo((d) => ({ ...d, phase: "question", waveformActive: true }));
      demoTimer.current = setTimeout(() => {
        if (userInterrupted.current) return;
        // Phase: reading
        setDemo((d) => ({ ...d, phase: "reading" }));
        demoTimer.current = setTimeout(() => {
          if (userInterrupted.current) return;
          // Phase: streaming answer
          setDemo((d) => ({
            ...d,
            phase: "answering",
            waveformActive: false,
          }));
          streamText(demoData.a, () => {
            if (userInterrupted.current) return;
            // Phase: action label
            setDemo((d) => ({ ...d, phase: "action" }));
            demoTimer.current = setTimeout(() => {
              if (userInterrupted.current) return;
              // Phase: transition to next tile
              setDemo((d) => ({ ...d, phase: "transition" }));
              demoTimer.current = setTimeout(() => {
                if (userInterrupted.current) return;
                setDemo((d) => ({
                  ...d,
                  phase: "activate",
                  tileIndex: (d.tileIndex + 1) % DEMO_TILES.length,
                  streamedText: "",
                }));
                runDemoCycle();
              }, 1500);
            }, 2500);
          });
        }, 2000);
      }, 3000);
    });
  }, [demo.tileIndex, reduced, clearDemoTimers, runPhase, streamText]);

  useEffect(() => {
    if (reduced) return;
    // Initial tiles-in pause, then start demo
    demoTimer.current = setTimeout(() => {
      runDemoCycle();
    }, 2000);
    return () => clearDemoTimers();
  }, [reduced, runDemoCycle, clearDemoTimers]);

  /* ── User interaction interrupts demo ── */
  const handleUserInteraction = useCallback(() => {
    userInterrupted.current = true;
    clearDemoTimers();
    if (streamInterval.current) clearInterval(streamInterval.current);
    setDemo((d) => ({
      ...d,
      phase: "idle",
      waveformActive: false,
    }));
  }, [clearDemoTimers]);

  const toggleMic = useCallback(async () => {
    handleUserInteraction();
    if (micActive) {
      stream?.getTracks().forEach((track) => track.stop());
      setStream(undefined);
      setMicActive(false);
      return;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      setStream(s);
      setMicActive(true);
    } catch {
      // Microphone denied — stay in visual-only mode.
    }
  }, [micActive, stream, handleUserInteraction]);

  const arcPosition = (index: number, total: number) => {
    const spread = 0.7;
    const t = total <= 1 ? 0.5 : index / (total - 1);
    const angle = (t - 0.5) * Math.PI * spread;
    const x = 50 + Math.sin(angle) * 38;
    const y = 28 + (1 - Math.cos(angle)) * 12;
    const rotate = angle * (180 / Math.PI) * 0.15;
    return { x, y, rotate };
  };

  const isDemoActive = demo.phase !== "idle" && demo.phase !== "tiles-in";
  const activeTileId =
    userSelectedTile ?? (isDemoActive ? currentTile.id : null);

  return (
    <section
      ref={stageRef}
      className="immersive-stage"
      aria-labelledby="stage-heading"
      data-demo-phase={demo.phase}
    >
      <h2 id="stage-heading" className="visually-hidden">
        {t("Talk to a document or a video.")}
      </h2>

      {/* Layer 0: Gradient background */}
      <div className="stage-video-layer">
        <div className="stage-gradient" aria-hidden="true" />
        <div className="stage-video-vignette" aria-hidden="true" />
      </div>

      {/* Layer 1: Glass file tiles on arc */}
      <div className="stage-tiles" aria-label={t("Your files")}>
        {DEMO_TILES.map((tile, i) => {
          const pos = arcPosition(i, DEMO_TILES.length);
          const isActive = activeTileId === tile.id;
          return (
            <button
              key={tile.id}
              type="button"
              className={`stage-tile${isActive ? " stage-tile--active" : ""}`}
              style={
                {
                  "--tile-x": `${pos.x}%`,
                  "--tile-y": `${pos.y}%`,
                  "--tile-rotate": `${pos.rotate}deg`,
                  "--tile-float-delay": `${i * 0.4}s`,
                } as React.CSSProperties
              }
              onClick={() => {
                handleUserInteraction();
                setUserSelectedTile(
                  userSelectedTile === tile.id ? null : tile.id,
                );
              }}
              aria-pressed={isActive}
              aria-label={`${tile.label} — ${tile.kind}`}
            >
              <span className="stage-tile-icon" aria-hidden="true">
                <Icon name={TILE_ICON[tile.kind]} />
              </span>
              <span className="stage-tile-label">{tile.label}</span>
              {isActive && demo.phase === "reading" && (
                <span className="stage-tile-scan" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>

      {/* Demo overlay: color-driven visual conversation */}
      {!reduced && isDemoActive && (
        <div className="stage-demo-overlay" aria-live="polite">
          {demo.phase === "question" && (
            <div className="stage-demo-question">
              <div className="stage-demo-speaker-row">
                <span className="stage-demo-speaker stage-demo-speaker--user">
                  <span className="stage-speaker-dot" />
                  <span>You</span>
                </span>
              </div>
              <span className="stage-demo-waveform" aria-hidden="true">
                {Array.from({ length: 24 }).map((_, i) => (
                  <span
                    key={i}
                    className="stage-wave-bar"
                    style={{ "--bar-index": i } as React.CSSProperties}
                  />
                ))}
              </span>
              <span className="stage-demo-text stage-demo-text--question">
                {currentDemo.q}
              </span>
            </div>
          )}
          {(demo.phase === "answering" || demo.phase === "action") && (
            <div className="stage-demo-answer">
              <div className="stage-demo-speaker-row">
                <span className="stage-demo-speaker stage-demo-speaker--assistant">
                  <span className="stage-speaker-dot" />
                  <span>Sense to Action</span>
                </span>
              </div>
              <div className="stage-demo-color-band" aria-hidden="true">
                <span className="stage-color-pulse stage-color-pulse--1" />
                <span className="stage-color-pulse stage-color-pulse--2" />
                <span className="stage-color-pulse stage-color-pulse--3" />
              </div>
              <span className="stage-demo-text stage-demo-text--answer">
                {demo.streamedText}
                {demo.phase === "answering" && (
                  <span className="stage-demo-caret" aria-hidden="true" />
                )}
              </span>
            </div>
          )}
          {demo.phase === "action" && (
            <div className="stage-demo-action">
              <span className="stage-demo-action-icon" aria-hidden="true">
                <Icon name="brain" />
              </span>
              <span>{currentDemo.action}</span>
            </div>
          )}
        </div>
      )}

      {/* Layer 2: Edge controls — left side */}
      <div className="stage-controls stage-controls--left">
        <button
          type="button"
          className={`stage-btn${micActive ? " stage-btn--active" : ""}`}
          onClick={toggleMic}
          aria-label={micActive ? t("Mute microphone") : t("Enable voice")}
          aria-pressed={micActive}
        >
          <Icon name="voice" />
          {micActive && <span className="stage-btn-pulse" aria-hidden="true" />}
        </button>
        <button
          type="button"
          className="stage-btn"
          aria-label={t("Gesture control")}
        >
          <Icon name="motion" />
        </button>
        <button
          type="button"
          className="stage-btn"
          aria-label={t("Gaze tracking")}
        >
          <Icon name="eye" />
        </button>
      </div>

      {/* Layer 2: Edge controls — right side */}
      <div className="stage-controls stage-controls--right">
        <a className="stage-btn" href={appHref} aria-label={t("Open the app")}>
          <Icon name="arrow" />
        </a>
      </div>

      {/* Layer 2: Confidentiality indicator — top right */}
      <div
        className="stage-confidential"
        aria-label={t("End-to-end encrypted")}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          width="16"
          height="16"
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      </div>

      {/* Layer 3: Voice orb — bottom center */}
      <div className="stage-orb-dock">
        <VoiceOrb active={micActive} stream={stream} />
      </div>

      {/* Ambient particles */}
      {!reduced && (
        <div className="stage-particles" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, i) => (
            <span
              key={i}
              className="stage-particle"
              style={
                {
                  "--particle-index": i,
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      )}

      {/* Autoplay blocked fallback */}
      {autoplayBlocked && (
        <button
          type="button"
          className="stage-play-btn"
          onClick={() => {
            setAutoplayBlocked(false);
            void video.current?.play();
          }}
        >
          <Icon name="play" /> {t("Play")}
        </button>
      )}
    </section>
  );
}
