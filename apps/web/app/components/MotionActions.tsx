"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { useLanguage } from "../i18n/LanguageProvider";
import { useHydrated } from "./useHydrated";
import type { VoiceActionId } from "./VoiceActions";
import {
  MotionCamera,
  cameraSupported,
  type MotionCameraEvent,
} from "@/apps/web/src/lib/motionCamera";
import type { MotionGestureId } from "@/packages/core/src/domain/motionGestures";

/**
 * Driving the application with a hand.
 *
 * Speaking is the first way in and typing is always there, but neither works
 * for someone who cannot do either at this moment: hands full, a room where
 * talking is rude, a keyboard out of reach. A camera and five movements are
 * enough to hold a conversation, as long as the movements mean something
 * obvious and the reader is told what was seen.
 *
 * Nothing is recorded. Each frame is drawn into a canvas of three hundred cells,
 * compared with the one before it, and discarded; the picture never leaves the
 * page and no video is ever sent anywhere.
 */

export type MotionActionsProps = {
  /** The questions a reader can pick between without saying a word. */
  prompts: readonly string[];
  /** Sends the chosen question. */
  onAsk: (prompt: string) => void;
  /** The same action bus the spoken commands use. */
  onAction: (action: VoiceActionId) => void;
  /** Whether there is a source to ask about yet. */
  canAsk: boolean;
  /** Injected so the panel can be driven in a test without a camera. */
  createCamera?: (options: {
    video: HTMLVideoElement;
    onEvent: (event: MotionCameraEvent) => void;
  }) => { start(): Promise<void>; stop(): void };
};

/** What each movement does, in the order the legend lists them. */
export const MOTION_LEGEND: ReadonlyArray<{
  gesture: MotionGestureId;
  label: string;
  meaning: string;
}> = [
  {
    gesture: "right",
    label: "Swipe right",
    meaning: "Next question",
  },
  { gesture: "left", label: "Swipe left", meaning: "Previous question" },
  { gesture: "hold", label: "Wave in place", meaning: "Ask it" },
  { gesture: "up", label: "Swipe up", meaning: "Summarize the source" },
  { gesture: "down", label: "Swipe down", meaning: "Stop" },
];

export function MotionActions({
  prompts,
  onAsk,
  onAction,
  canAsk,
  createCamera,
}: MotionActionsProps) {
  const { t } = useLanguage();
  const hydrated = useHydrated();
  const video = useRef<HTMLVideoElement>(null);
  const camera = useRef<{ start(): Promise<void>; stop(): void } | null>(null);
  const handle = useRef<(event: MotionCameraEvent) => void>(() => {});
  const [watching, setWatching] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [energy, setEnergy] = useState(0);
  const [at, setAt] = useState<{ x: number; y: number } | undefined>();
  const [chosen, setChosen] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showOverlays, setShowOverlays] = useState(true);
  const [lastActionTrigger, setLastActionTrigger] = useState<{
    gesture: string;
    action: string;
  } | null>(null);

  // Gestures arrive faster than React re-renders: a swipe and the wave that
  // follows it can both be handled before the chosen question has been drawn.
  // The ref is what the handler reads, so the question asked is the one the
  // reader last landed on rather than the one that was on screen.
  const chosenRef = useRef(0);
  const supported = hydrated && (createCamera ? true : cameraSupported());
  const prompt = prompts[chosen % Math.max(1, prompts.length)] ?? "";

  const announce = useCallback((message: string) => setNotice(message), []);

  /** What each movement does. The panel owns the choosing; the rest is the bus. */
  const perform = useCallback(
    (gesture: MotionGestureId) => {
      if (gesture === "right" || gesture === "left") {
        const length = Math.max(1, prompts.length);
        const next =
          (chosenRef.current + (gesture === "right" ? 1 : -1) + length) %
          length;
        chosenRef.current = next;
        setChosen(next);
        const targetPrompt = prompts[next] ?? "";
        announce(targetPrompt);
        setLastActionTrigger({
          gesture: gesture === "right" ? "SWIPE RIGHT ↦" : "SWIPE LEFT ↤",
          action: targetPrompt || (gesture === "right" ? "Next Question" : "Previous Question"),
        });
        return;
      }
      if (gesture === "hold") {
        const asking = prompts[chosenRef.current] ?? "";
        if (!canAsk || !asking) {
          announce(t("Add a source first, then wave to ask."));
          return;
        }
        announce(t("Asking: {question}", { question: asking }));
        setLastActionTrigger({
          gesture: "HAND WAVE ✋",
          action: t("Asking: {question}", { question: asking }),
        });
        onAsk(asking);
        return;
      }
      if (gesture === "up") {
        if (!canAsk) {
          announce(t("Add a source first, then wave to ask."));
          return;
        }
        announce(t("Summarizing the key ideas."));
        setLastActionTrigger({
          gesture: "SWIPE UP ↥",
          action: t("Summarizing the key ideas."),
        });
        onAction("summarize");
        return;
      }
      announce(t("Stopped."));
      setLastActionTrigger({
        gesture: "SWIPE DOWN ↧",
        action: t("Stopped."),
      });
      onAction("stop");
    },
    [announce, canAsk, onAction, onAsk, prompts, t],
  );

  // Read through a ref, so a new question or a language change never restarts
  // the camera under a reader who is in the middle of using it. The ref is
  // filled after the render rather than during it: the handler is only ever
  // called from a camera frame or a click, both of which come later.
  const onCameraEvent = (event: MotionCameraEvent) => {
    if (event.type === "reading") {
      setEnergy(event.energy);
      setAt(event.at);
      return;
    }
    if (event.type === "gesture") return perform(event.gesture);
    if (event.type === "ready") {
      setStarting(false);
      setWatching(true);
      setError("");
      announce(t("Camera on. Swipe to choose, wave to ask."));
      return;
    }
    if (event.type === "ended") {
      setWatching(false);
      setEnergy(0);
      setAt(undefined);
      return;
    }
    setStarting(false);
    setWatching(false);
    setError(t(event.message));
  };

  useEffect(() => {
    handle.current = onCameraEvent;
  });

  useEffect(
    () => () => {
      camera.current?.stop();
      camera.current = null;
    },
    [],
  );

  async function start() {
    if (!video.current || watching || starting) return;
    setError("");
    setStarting(true);
    const onEvent = (event: MotionCameraEvent) => handle.current(event);
    const created = createCamera
      ? createCamera({ video: video.current, onEvent })
      : new MotionCamera({ video: video.current, onEvent });
    camera.current = created;
    try {
      await created.start();
    } catch {
      // Camera adapters are allowed to reject as well as report an event.
      // Keep the panel usable instead of leaving the start button disabled.
      camera.current = null;
      setStarting(false);
      setWatching(false);
      setError(
        t("The camera could not be started. Check it is not already in use."),
      );
    }
  }

  function stop() {
    camera.current?.stop();
    camera.current = null;
    announce(t("Camera off."));
  }

  if (!supported)
    return (
      <section className="motion-panel" aria-label={t("Motion to action")}>
        <p className="hint">
          {t(
            "This browser will not share a camera here. Motion needs a secure connection; voice and typing still work.",
          )}
        </p>
      </section>
    );

  return (
    <section
      className={`motion-panel${fullscreen ? " motion-panel-fullscreen" : ""}`}
      aria-label={t("Motion to action")}
    >
      {fullscreen && (
        <button
          type="button"
          className="motion-fullscreen-close"
          onClick={() => setFullscreen(false)}
          aria-label={t("Exit full screen")}
        >
          <Icon name="close" />
        </button>
      )}
      {/* Video Conference Room Header */}
      <div className="motion-conference-header">
        <div className="motion-conf-title-col">
          <span className="motion-conf-badge">
            <span className="motion-conf-dot" data-active={watching || undefined} />
            {watching ? t("LIVE VISION ROOM") : t("VISION ROOM (IDLE)")}
          </span>
          <h4 className="motion-conf-title">{t("Motion & Video Conference Hub")}</h4>
        </div>
        <div className="motion-conf-meta">
          <span className="motion-conf-pill">
            {watching ? `${Math.round(energy * 100)}% ${t("motion energy")}` : t("Standby")}
          </span>
          <span className="motion-conf-pill">
            {watching ? t("Gesture detection") : t("Privacy Protected")}
          </span>
        </div>
      </div>

      <div
        className="motion-stage"
        data-watching={watching || undefined}
        data-expanded={fullscreen || undefined}
      >
        {/* Mirrored, so a reader sees themselves the way a mirror shows them
            and a movement to their right is a movement to the right here. */}
        <video
          ref={video}
          className="motion-preview"
          muted
          playsInline
          aria-hidden="true"
        />

        {watching && showOverlays && (
          <>
            {/* Eye Tracking Overlays */}
            <div className="motion-face-box" aria-hidden="true">
              <div className="motion-eye-marker left">
                <span className="motion-reticle-cross" />
                <span className="motion-pupil-dot" />
                <span className="motion-reticle-tag">EYE:L</span>
              </div>
              <div className="motion-eye-marker right">
                <span className="motion-reticle-cross" />
                <span className="motion-pupil-dot" />
                <span className="motion-reticle-tag">EYE:R</span>
              </div>
              <span className="motion-gaze-vector" />
            </div>

            {/* Hand Tracking Overlays */}
            <span
              className="motion-marker"
              aria-hidden="true"
              style={
                at
                  ? {
                      left: `${at.x * 100}%`,
                      top: `${at.y * 100}%`,
                      opacity: 1,
                    }
                  : { opacity: 0 }
              }
            >
              <span className="motion-palm-aura" />
              <span className="motion-finger-dot f1" />
              <span className="motion-finger-dot f2" />
              <span className="motion-finger-dot f3" />
              <span className="motion-finger-dot f4" />
              <span className="motion-finger-dot f5" />
              <span className="motion-marker-label">HAND:ACTIVE</span>
            </span>

            <span
              className="motion-energy"
              aria-hidden="true"
              style={{ transform: `scaleX(${Math.min(1, energy * 4)})` }}
            />

            {/* Live Movement Action Trigger HUD */}
            {lastActionTrigger && (
              <div className="motion-hud-action-card" role="status" aria-live="polite">
                <span className="motion-hud-gesture-badge">
                  {lastActionTrigger.gesture}
                </span>
                <span className="motion-hud-action-name">
                  {lastActionTrigger.action}
                </span>
              </div>
            )}
          </>
        )}

        {!watching && (
          <p className="motion-idle">
            {t("The camera is off. Nothing is recorded or sent.")}
          </p>
        )}
      </div>

      <div className="motion-controls">
        <button
          type="button"
          className={watching ? "secondary" : "primary"}
          onClick={() => (watching ? stop() : void start())}
          disabled={starting}
        >
          <Icon name="motion" />{" "}
          {starting
            ? t("Starting the camera…")
            : watching
              ? t("Stop motion")
              : t("Start motion")}
        </button>

        <button
          type="button"
          className="ghost motion-toolbar-btn"
          onClick={() => setFullscreen((prev) => !prev)}
          title={fullscreen ? t("Exit full screen") : t("Full screen")}
        >
          {fullscreen ? " " + t("Exit Full Screen") : "⤢ " + t("Full Screen")}
        </button>

        {watching && (
          <button
            type="button"
            className="ghost motion-toolbar-btn"
            onClick={() => setShowOverlays((prev) => !prev)}
            title={showOverlays ? t("Hide overlays") : t("Show overlays")}
          >
            {showOverlays ? "👁️ " + t("HUD: On") : "👁️‍🗨️ " + t("HUD: Off")}
          </button>
        )}
      </div>

      <div className="motion-choice" aria-live="off">
        <span className="motion-choice-label">{t("Chosen question")}</span>
        <strong className="motion-choice-prompt">{prompt}</strong>
      </div>

      <ul className="motion-legend">
        {MOTION_LEGEND.map((entry) => (
          <li key={entry.gesture} className={`motion-legend-${entry.gesture}`}>
            <span aria-hidden="true" className="motion-legend-arrow" />
            <span className="motion-legend-label">{t(entry.label)}</span>
            <span className="motion-legend-meaning">{t(entry.meaning)}</span>
          </li>
        ))}
      </ul>

      <p className="motion-notice" role="status">
        {notice}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
