"use client";

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type Ref,
} from "react";
import { Icon } from "./Icon";
import { SenseFeedback } from "./SenseFeedback";
import styles from "./SenseControls.module.css";
import type {
  SenseChannelActivity,
  SenseChannelControl,
} from "./senseControlTypes";
import { MOTION_LEGEND } from "../content/motion-legend";
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
  /** Compact controls for the shared immersive action dock. */
  presentation?: "panel" | "dock" | "merged";
  controlRef?: Ref<SenseChannelControl>;
  feedbackTarget?: HTMLElement | null;
  onActivityChange?: (activity: SenseChannelActivity) => void;
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
  /** Whether the file browser overlay is currently open. */
  fileBrowserOpen?: boolean;
  /** Actions available while the file browser is open. */
  onFileAction?: (
    action: "navigateUp" | "next" | "prev" | "openSelected",
  ) => void;
  /** Reports the current gaze/face position in normalised coordinates. */
  onGazeUpdate?: (position: { x: number; y: number } | null) => void;
};

export { MOTION_LEGEND } from "../content/motion-legend";

export function MotionActions({
  prompts,
  presentation = "panel",
  controlRef,
  feedbackTarget,
  onActivityChange,
  onAsk,
  onAction,
  canAsk,
  createCamera,
  fileBrowserOpen = false,
  onFileAction,
  onGazeUpdate,
}: MotionActionsProps) {
  const { t } = useLanguage();
  const dock = presentation !== "panel";
  const merged = presentation === "merged";
  const hydrated = useHydrated();
  const video = useRef<HTMLVideoElement>(null);
  const camera = useRef<{ start(): Promise<void>; stop(): void } | null>(null);
  const handle = useRef<(event: MotionCameraEvent) => void>(() => {});
  const cameraSession = useRef(0);
  const [watching, setWatching] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [energy, setEnergy] = useState(0);
  const [at, setAt] = useState<{ x: number; y: number } | undefined>();
  const [chosen, setChosen] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
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
      // When the file browser is open, gestures drive file navigation instead
      // of the normal question-selection flow.
      if (fileBrowserOpen && onFileAction) {
        switch (gesture) {
          case "right":
            onFileAction("next");
            setLastActionTrigger({
              gesture: "SWIPE RIGHT",
              action: "Next file",
            });
            return;
          case "left":
            onFileAction("prev");
            setLastActionTrigger({
              gesture: "SWIPE LEFT",
              action: "Previous file",
            });
            return;
          case "hold":
            onFileAction("openSelected");
            setLastActionTrigger({
              gesture: "HAND WAVE",
              action: "Open selected file",
            });
            return;
          case "up":
            onFileAction("navigateUp");
            setLastActionTrigger({
              gesture: "SWIPE UP",
              action: "Navigate up",
            });
            return;
        }
      }

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
          gesture: gesture === "right" ? "SWIPE RIGHT" : "SWIPE LEFT",
          action:
            targetPrompt ||
            (gesture === "right" ? "Next Question" : "Previous Question"),
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
          gesture: "HAND WAVE",
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
          gesture: "SWIPE UP",
          action: t("Summarizing the key ideas."),
        });
        onAction("summarize");
        return;
      }
      announce(t("Stopped."));
      setLastActionTrigger({
        gesture: "SWIPE DOWN",
        action: t("Stopped."),
      });
      onAction("stop");
    },
    [
      announce,
      canAsk,
      onAction,
      onAsk,
      prompts,
      t,
      fileBrowserOpen,
      onFileAction,
    ],
  );

  // Read through a ref, so a new question or a language change never restarts
  // the camera under a reader who is in the middle of using it. The ref is
  // filled after the render rather than during it: the handler is only ever
  // called from a camera frame or a click, both of which come later.
  const onCameraEvent = (event: MotionCameraEvent) => {
    if (event.type === "reading") {
      setEnergy(event.energy);
      setAt(event.at);
      onGazeUpdate?.(event.at ?? null);
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
      setStarting(false);
      setFullscreen(false);
      setWatching(false);
      setEnergy(0);
      setAt(undefined);
      onGazeUpdate?.(null);
      return;
    }
    setStarting(false);
    setWatching(false);
    setFullscreen(false);
    setError(
      t(
        merged && event.code === "DENIED"
          ? "Camera access was denied. Allow it in your browser, then restart the experience."
          : event.message,
      ),
    );
  };

  useEffect(() => {
    handle.current = onCameraEvent;
  });

  useEffect(
    () => () => {
      cameraSession.current += 1;
      camera.current?.stop();
      camera.current = null;
    },
    [],
  );

  async function start() {
    if (!video.current || watching || starting) return;
    setError("");
    setNotice("");
    setStarting(true);
    const session = ++cameraSession.current;
    const onEvent = (event: MotionCameraEvent) => {
      if (cameraSession.current === session) handle.current(event);
    };
    const created = createCamera
      ? createCamera({ video: video.current, onEvent })
      : new MotionCamera({ video: video.current, onEvent });
    camera.current = created;
    try {
      await created.start();
    } catch {
      if (cameraSession.current !== session) return;
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
    cameraSession.current += 1;
    camera.current?.stop();
    camera.current = null;
    setStarting(false);
    setWatching(false);
    setFullscreen(false);
    setEnergy(0);
    setAt(undefined);
    onGazeUpdate?.(null);
    announce(t("Camera off."));
  }

  function requestStart() {
    if (supported) void start();
    else
      setError(
        t(
          "This browser will not share a camera here. Motion needs a secure connection; voice and typing still work.",
        ),
      );
  }

  useImperativeHandle(controlRef, () => ({ start: requestStart, stop }));

  useEffect(() => {
    onActivityChange?.({ active: watching, connecting: starting });
  }, [watching, starting, onActivityChange]);

  if (dock) {
    const active = watching || starting;
    return (
      <section className={styles.motion} aria-label={t("Motion")}>
        {!merged && (
          <button
            type="button"
            className={styles.control}
            aria-label={active ? t("Stop motion") : t("Start motion")}
            aria-pressed={active}
            onClick={() => (active ? stop() : requestStart())}
          >
            <Icon name="motion" />
            <span>{active ? t("Stop motion") : t("Motion")}</span>
          </button>
        )}
        <div
          className={styles.motionPreview}
          data-fullscreen={fullscreen || undefined}
          data-merged={merged || undefined}
          aria-label={t("Motion preview")}
          hidden={!active}
        >
          <div className={styles.previewToolbar}>
            <span role="status">
              {starting ? t("Starting the camera…") : t("Camera on")}
            </span>
            {!merged && (
              <button
                type="button"
                className={styles.previewButton}
                onClick={() => setFullscreen((value) => !value)}
                aria-label={
                  fullscreen ? t("Exit full screen") : t("Full screen")
                }
              >
                <Icon name={fullscreen ? "close" : "external"} />
              </button>
            )}
          </div>
          <div className={styles.cameraFrame}>
            <video
              ref={video}
              className={styles.cameraVideo}
              muted
              playsInline
              aria-hidden="true"
            />
            {watching && at && (
              <span
                className={styles.motionPoint}
                aria-hidden="true"
                style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }}
              />
            )}
            <span
              className={styles.energy}
              aria-hidden="true"
              style={{ transform: `scaleX(${Math.min(1, energy * 4)})` }}
            />
          </div>
          <div className={styles.previewGuide}>
            <strong>{prompt}</strong>
            {!merged && (
              <>
                <ul className={styles.gestureGuide}>
                  {MOTION_LEGEND.map((entry) => (
                    <li key={entry.gesture}>
                      <span>{t(entry.label)}</span>
                      <span>{t(entry.meaning)}</span>
                    </li>
                  ))}
                </ul>
                <p className={styles.status} role="status">
                  {notice}
                </p>
              </>
            )}
          </div>
        </div>
        {error && (
          <SenseFeedback target={merged ? feedbackTarget : undefined}>
            <p
              className={styles.error}
              data-merged={merged || undefined}
              role="alert"
            >
              {error}
            </p>
          </SenseFeedback>
        )}
      </section>
    );
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

      <div
        className="motion-stage"
        data-watching={watching || undefined}
        data-expanded={fullscreen || undefined}
      >
        <video
          ref={video}
          className="motion-preview"
          muted
          playsInline
          aria-hidden="true"
        />

        <span className="motion-status" aria-live="polite">
          <span
            className="motion-status-dot"
            data-active={watching || undefined}
          />
          {watching ? t("Camera on") : t("Camera off")}
        </span>

        {watching && (
          <>
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
          </>
        )}

        {!watching && (
          <p className="motion-idle">
            {t("The camera is off. Nothing is recorded or sent.")}
          </p>
        )}

        <div className="motion-choice" aria-live="off">
          <span className="motion-choice-label">{t("Chosen question")}</span>
          <strong className="motion-choice-prompt">{prompt}</strong>
        </div>

        <ul className="motion-legend">
          {MOTION_LEGEND.map((entry) => (
            <li
              key={entry.gesture}
              className={`motion-legend-${entry.gesture}`}
            >
              <span aria-hidden="true" className="motion-legend-arrow" />
              <span className="motion-legend-label">{t(entry.label)}</span>
              <span className="motion-legend-meaning">{t(entry.meaning)}</span>
            </li>
          ))}
        </ul>

        <p className="motion-notice" role="status">
          {lastActionTrigger && (
            <span className="motion-notice-gesture">
              {lastActionTrigger.gesture}
            </span>
          )}
          {notice}
        </p>
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
          {fullscreen ? t("Exit Full Screen") : t("Full Screen")}
        </button>
      </div>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
