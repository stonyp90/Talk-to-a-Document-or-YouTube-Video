"use client";

import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Onboarding } from "./components/Onboarding";
import { Applications } from "./components/Applications";
import { Icon } from "./components/Icon";
import { VoiceActions, type VoiceActionId } from "./components/VoiceActions";
import {
  conversationReducer,
  initialConversationState,
} from "@/packages/core/src/domain/conversation";
import type { IngestedSource } from "@/packages/core/src/domain/ingestion";
import {
  RealtimeClient,
  type VoiceActivity,
} from "@/apps/web/src/lib/realtimeClient";
import {
  ApiError,
  requestJson,
  uploadWithProgress,
  type ContextUsage,
  type Health,
  type RealtimeCredential,
  type SourceEnvelope,
} from "@/apps/web/src/lib/api";

type SourceTab = "pdf" | "youtube";
type EntryMode = "voice" | "text" | "motion";

const INGEST_DEADLINE_MS = 60000;
const SESSION_DEADLINE_MS = 25000;
const ANSWER_DEADLINE_MS = 25000;

const statusText: Record<string, string> = {
  idle: "Ready",
  preparing: "Preparing",
  connecting: "Connecting",
  connected: "Connected",
  reconnecting: "Reconnecting",
  ended: "Ended",
  error: "Needs attention",
};

const LIVE_STATUSES = ["preparing", "connecting", "connected", "reconnecting"];

const activityText: Record<VoiceActivity, string> = {
  idle: "Listening for your question",
  listening: "Hearing you",
  speaking: "Answering — speak to interrupt",
};

async function withDeadline<T>(
  controller: AbortController,
  milliseconds: number,
  message: string,
  operation: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let onAbort: () => void = () => {};
  const cancellation = new Promise<never>((_, reject) => {
    onAbort = () => reject(new DOMException("Request cancelled", "AbortError"));
    controller.signal.addEventListener("abort", onAbort, { once: true });
    if (controller.signal.aborted) onAbort();
    timer = setTimeout(() => {
      reject(new Error(message));
      controller.abort();
    }, milliseconds);
  });
  try {
    return await Promise.race([operation(), cancellation]);
  } finally {
    clearTimeout(timer);
    controller.signal.removeEventListener("abort", onAbort);
  }
}

/** Turns any failure into something a reader can act on. */
function readable(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError) {
    if (caught.code === "CLOUD_BLOCKED")
      return "YouTube is not sharing captions for this video right now. Try another captioned video, or use a PDF instead.";
    if (caught.code === "RATE_LIMITED")
      return "That is a lot of requests at once. Wait a moment and try again.";
    return caught.message;
  }
  if (caught instanceof Error) return caught.message;
  return fallback;
}

/**
 * Whether this browser will ever hand over a microphone here. Voice needs a
 * secure context, so a reader on plain HTTP should be told before they press a
 * button rather than after. The server render assumes support and hydration
 * corrects it.
 */
const NO_CHANGE = () => () => {};

function readMicrophoneSupport(): boolean {
  return (
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    (window.isSecureContext || location.hostname === "localhost")
  );
}

function subscribeToConnectivity(notify: () => void): () => void {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

export default function HomePage() {
  const [entryMode, setEntryMode] = useState<EntryMode>("voice");
  const [tab, setTab] = useState<SourceTab>("pdf");
  const [file, setFile] = useState<File | undefined>();
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<IngestedSource>();
  const [context, setContext] = useState<ContextUsage>();
  const [busy, setBusy] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>();
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [pendingAnswers, setPendingAnswers] = useState(0);
  const [providerMode, setProviderMode] = useState<string>("");
  const [activity, setActivity] = useState<VoiceActivity>("idle");
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const micSupported = useSyncExternalStore(
    NO_CHANGE,
    readMicrophoneSupport,
    () => true,
  );
  const online = useSyncExternalStore(
    subscribeToConnectivity,
    () => navigator.onLine,
    () => true,
  );
  const [state, dispatch] = useReducer(
    conversationReducer,
    initialConversationState,
  );

  const questionInput = useRef<HTMLInputElement>(null);
  const chatLog = useRef<HTMLDivElement>(null);
  const followMessages = useRef(true);
  const realtime = useRef<RealtimeClient | null>(null);
  const mounted = useRef(true);
  const sourceVersion = useRef(0);
  const voiceVersion = useRef(0);
  const sessionRequest = useRef<AbortController | null>(null);
  const textRequests = useRef(new Set<AbortController>());
  const uploadRequest = useRef<AbortController | null>(null);
  const voiceActive = useRef(false);
  const sourceIdRef = useRef<string | undefined>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const voicePickerInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (followMessages.current && chatLog.current)
      chatLog.current.scrollTop = chatLog.current.scrollHeight;
  }, [state.messages]);

  useEffect(() => {
    mounted.current = true;
    const sourceEpoch = sourceVersion;
    const voiceEpoch = voiceVersion;
    const requests = textRequests.current;
    return () => {
      mounted.current = false;
      sourceEpoch.current++;
      voiceEpoch.current++;
      sessionRequest.current?.abort();
      uploadRequest.current?.abort();
      requests.forEach((request) => request.abort());
      requests.clear();
      realtime.current?.stop();
      realtime.current = null;
      voiceActive.current = false;
    };
  }, []);

  useEffect(() => {
    if (source) questionInput.current?.focus();
  }, [source]);

  const invalidateVoice = useCallback(() => {
    voiceVersion.current++;
    sessionRequest.current?.abort();
    sessionRequest.current = null;
    voiceActive.current = false;
    realtime.current?.stop();
    realtime.current = null;
    setActivity("idle");
  }, []);

  const canIngest = useMemo(
    () => (tab === "pdf" ? Boolean(file) : Boolean(url.trim())),
    [file, tab, url],
  );
  const sessionLive = LIVE_STATUSES.includes(state.status);
  const actionFirstStart = !source && !sourcePickerOpen && !busy;
  const voiceFirstStart = entryMode === "voice" && actionFirstStart;
  const motionFirstStart = entryMode === "motion" && actionFirstStart;

  /**
   * Calls an endpoint with the opaque session id, and resends the whole source
   * only if the server has forgotten it. That keeps ordinary requests small
   * while surviving a stateless or scaled-out runtime.
   */
  async function withSession<T>(
    call: (body: Record<string, unknown>) => Promise<T>,
    extra: Record<string, unknown> = {},
  ): Promise<T> {
    if (sourceIdRef.current) {
      try {
        return await call({ sourceId: sourceIdRef.current, ...extra });
      } catch (caught) {
        if (!(caught instanceof ApiError) || caught.code !== "SOURCE_EXPIRED")
          throw caught;
      }
    }
    return call({ source, ...extra });
  }

  async function ingest(event: FormEvent) {
    event.preventDefault();
    const version = ++sourceVersion.current;
    const current = () => mounted.current && sourceVersion.current === version;
    invalidateVoice();
    uploadRequest.current?.abort();
    const controller = new AbortController();
    uploadRequest.current = controller;
    textRequests.current.forEach((request) => request.abort());
    textRequests.current.clear();
    setPendingAnswers(0);
    setBusy(true);
    setUploadProgress(undefined);
    setError("");
    setSource(undefined);
    setSourcePickerOpen(true);
    setContext(undefined);
    sourceIdRef.current = undefined;
    followMessages.current = true;
    setProviderMode("");
    setQuestion("");
    dispatch({ type: "RESET" });

    try {
      const envelope = await withDeadline(
        controller,
        INGEST_DEADLINE_MS,
        "Reading your source timed out. Check your connection and retry.",
        async () => {
          const health = await requestJson<Health>("/api/health", {
            signal: controller.signal,
          });
          if (current()) setProviderMode(health.mode ?? "");

          if (tab === "pdf" && file && health.directUpload) {
            const prepared = await requestJson<{
              url: string;
              fields: Record<string, string>;
              key: string;
            }>("/api/uploads", {
              signal: controller.signal,
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: file.name,
                type: file.type,
                size: file.size,
              }),
            });
            if (current()) setUploadProgress(0);
            await uploadWithProgress(
              prepared.url,
              prepared.fields,
              file,
              (fraction) => current() && setUploadProgress(fraction),
              controller.signal,
            );
            if (current()) setUploadProgress(undefined);
            return requestJson<SourceEnvelope>("/api/uploads/extract", {
              signal: controller.signal,
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: prepared.key, name: file.name }),
            });
          }

          const form = new FormData();
          if (tab === "pdf" && file) form.append("file", file);
          if (tab === "youtube") form.append("url", url);
          return requestJson<SourceEnvelope>("/api/ingest", {
            method: "POST",
            body: form,
            signal: controller.signal,
          });
        },
      );
      if (!current()) return;
      setSource(envelope.source);
      setSourcePickerOpen(false);
      sourceIdRef.current = envelope.sourceId;
      setContext(envelope.context);
      dispatch({ type: "CLEAR_ERROR" });
    } catch (caught) {
      if (current())
        setError(
          readable(caught, "We couldn’t read this source. Please try again."),
        );
    } finally {
      if (uploadRequest.current === controller) uploadRequest.current = null;
      if (current()) {
        setBusy(false);
        setUploadProgress(undefined);
      }
    }
  }

  async function startVoice() {
    if (!source || voiceActive.current) return;
    invalidateVoice();
    voiceActive.current = true;
    const version = voiceVersion.current;
    const sourceAtStart = sourceVersion.current;
    const current = () =>
      mounted.current &&
      version === voiceVersion.current &&
      sourceAtStart === sourceVersion.current;
    const controller = new AbortController();
    sessionRequest.current = controller;
    dispatch({ type: "PREPARING" });
    setError("");

    try {
      const session = await withDeadline(
        controller,
        SESSION_DEADLINE_MS,
        "Voice session setup timed out. Check your connection and retry Start Voice Chat.",
        () =>
          withSession((body) =>
            requestJson<RealtimeCredential>("/api/realtime/session", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              signal: controller.signal,
            }),
          ),
      );
      if (!current()) return;
      sourceIdRef.current = session.sourceId ?? sourceIdRef.current;
      setProviderMode(session.mode);
      dispatch({ type: "CONNECTING" });

      realtime.current = new RealtimeClient(
        source,
        (event) => {
          if (!current()) return;
          if (event.type === "connected") dispatch({ type: "CONNECTED" });
          if (event.type === "reconnecting") dispatch({ type: "RECONNECTING" });
          if (event.type === "activity") setActivity(event.activity ?? "idle");
          if (event.type === "ended") {
            voiceActive.current = false;
            setActivity("idle");
            dispatch({ type: "ENDED" });
          }
          if (event.type === "error") {
            voiceActive.current = false;
            setActivity("idle");
            dispatch({
              type: "ERROR",
              message: event.error ?? "Realtime error",
            });
          }
          if (event.type === "message-started" && event.message)
            dispatch({ type: "MESSAGE_STARTED", message: event.message });
          if (event.type === "message-delta" && event.id)
            dispatch({
              type: "MESSAGE_DELTA",
              id: event.id,
              text: event.text ?? "",
            });
          if (event.type === "message-completed" && event.id)
            dispatch({
              type: "MESSAGE_COMPLETED",
              id: event.id,
              text: event.text,
            });
        },
        session.mode,
        session.clientSecret,
      );
      await realtime.current.connect();
    } catch (caught) {
      if (!current()) return;
      invalidateVoice();
      const message = readable(
        caught,
        "Microphone access is unavailable. You can type your question instead.",
      );
      dispatch({ type: "ERROR", message });
      setError(message);
    } finally {
      if (sessionRequest.current === controller) sessionRequest.current = null;
    }
  }

  function stopVoice() {
    invalidateVoice();
    dispatch({ type: "ENDED" });
  }

  function toggleMute() {
    const muted = !state.muted;
    realtime.current?.setMuted(muted);
    dispatch({ type: "MUTE_CHANGED", muted });
  }

  async function sendText(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!source || !trimmed) return;
    setError("");
    dispatch({ type: "CLEAR_ERROR" });
    setQuestion("");

    // A live voice session already carries typed turns, so they stay in one thread.
    if (state.status === "connected" && realtime.current) {
      try {
        realtime.current.sendText(trimmed);
      } catch (caught) {
        invalidateVoice();
        const message = readable(
          caught,
          "That message did not reach the voice session. Please retry.",
        );
        dispatch({ type: "ERROR", message });
        setError(message);
        setQuestion(trimmed);
      }
      return;
    }

    const version = sourceVersion.current;
    const current = () => mounted.current && sourceVersion.current === version;
    const controller = new AbortController();
    textRequests.current.add(controller);
    setPendingAnswers((count) => count + 1);
    dispatch({
      type: "MESSAGE_STARTED",
      message: {
        id: crypto.randomUUID(),
        role: "user",
        text: trimmed,
        status: "complete",
      },
    });

    try {
      const reply = await withDeadline(
        controller,
        ANSWER_DEADLINE_MS,
        "The answer timed out. Check your connection and retry your question.",
        () =>
          withSession(
            (body) =>
              requestJson<{ answer: string; sourceId: string }>(
                "/api/text-chat",
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(body),
                  signal: controller.signal,
                },
              ),
            { question: trimmed },
          ),
      );
      if (!current()) return;
      sourceIdRef.current = reply.sourceId ?? sourceIdRef.current;
      dispatch({
        type: "MESSAGE_STARTED",
        message: {
          id: crypto.randomUUID(),
          role: "assistant",
          text: reply.answer,
          status: "complete",
        },
      });
    } catch (caught) {
      if (current()) {
        setError(readable(caught, "The answer could not be produced."));
        setQuestion((draft) => draft || trimmed);
      }
    } finally {
      textRequests.current.delete(controller);
      if (current()) setPendingAnswers((count) => Math.max(0, count - 1));
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0]);
    setError("");
  }

  function focusSourceControl(control: "youtube" | "upload") {
    setError("");
    setTab(control === "youtube" ? "youtube" : "pdf");
    setSourcePickerOpen(true);
    window.requestAnimationFrame(() => {
      if (control === "youtube")
        document.getElementById("youtube-url")?.focus();
      else fileInput.current?.focus();
    });
  }

  function switchEntryMode(mode: EntryMode) {
    setEntryMode(mode);
    setError("");
    // Text owns the classic source form. Voice and motion keep the stage open
    // so switching modes never silently starts an action or requests a sensor.
    setSourcePickerOpen(mode === "text" || Boolean(source));
  }

  function openUploadPicker() {
    focusSourceControl("upload");
    setVoiceActionNotice(
      "Upload is ready — choose a PDF in the file picker to finish.",
    );
    voicePickerInput.current?.click();
  }

  const [voiceActionNotice, setVoiceActionNotice] = useState("");

  useEffect(() => {
    if (!voiceActionNotice) return;
    const timeout = window.setTimeout(() => setVoiceActionNotice(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [voiceActionNotice]);

  function handleVoiceAction(action: VoiceActionId) {
    if (action === "youtube") {
      focusSourceControl("youtube");
      setVoiceActionNotice(
        "YouTube is ready — dictate or paste a video link next.",
      );
      return;
    }
    if (action === "upload") {
      openUploadPicker();
      return;
    }
    if (action === "voice") {
      if (!source) {
        setVoiceActionNotice(
          "Add a PDF or YouTube source first, then say “let’s talk” again.",
        );
        return;
      }
      void startVoice();
      return;
    }
    if (action === "summarize") {
      if (!source) {
        setVoiceActionNotice(
          "Add a PDF or YouTube source first, then say “summarize this” again.",
        );
        return;
      }
      const prompt = "Summarize the key ideas";
      setQuestion(prompt);
      setVoiceActionNotice(
        "Your summary request is ready in the question box.",
      );
      window.requestAnimationFrame(() => questionInput.current?.focus());
      return;
    }
    if (action === "back") {
      if (sessionLive) stopVoice();
      setSourcePickerOpen(true);
      focusSourceControl(tab === "youtube" ? "youtube" : "upload");
      setVoiceActionNotice("Going back — the source controls are ready.");
      return;
    }
    if (action === "next") {
      if (!source) {
        focusSourceControl(tab === "youtube" ? "youtube" : "upload");
        setVoiceActionNotice(
          "Next step: choose a PDF or paste a YouTube link.",
        );
        return;
      }
      setVoiceActionNotice("Next step: ask your question.");
      window.requestAnimationFrame(() => questionInput.current?.focus());
      return;
    }

    invalidateVoice();
    uploadRequest.current?.abort();
    textRequests.current.forEach((request) => request.abort());
    textRequests.current.clear();
    setPendingAnswers(0);
    setBusy(false);
    setUploadProgress(undefined);
    setError("");
    dispatch({ type: "ENDED" });
    setVoiceActionNotice("Cancelled — the current action has been stopped.");
  }

  return (
    <>
      <input
        ref={voicePickerInput}
        className="voice-picker-input"
        type="file"
        accept="application/pdf,.pdf"
        aria-hidden="true"
        tabIndex={-1}
        onChange={onFile}
      />
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <main className="shell">
        <div className="container app-frame">
          <header className="topbar">
            <a className="brand" href="/" aria-label="Ursly home">
              {/* A vector stays crisp at every screen density. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="brand-mark"
                src="/brand/ursly-mark.svg"
                width="36"
                height="36"
                alt=""
              />
              ursly<span className="brand-dot">.</span>
            </a>
            <span className="topbar-note">Talk to a document or a video.</span>
            <div className="topbar-actions">
              <button
                type="button"
                className="outline-button notification-button"
                aria-label="Notifications"
                title="Notifications"
                onClick={() => setVoiceActionNotice("You’re all caught up.")}
              >
                <Icon name="bell" />
              </button>
              <a className="workspace-label" href="#how-it-works">
                How it works <span aria-hidden="true">↓</span>
              </a>
            </div>
          </header>

          {!online && (
            <p className="banner banner-offline" role="alert">
              You are offline. Ursly will reconnect when your network returns.
            </p>
          )}

          <div className="hero hero-compact">
            <h1>
              Less scrolling. <span>More understanding.</span>
            </h1>
            <p className="lede">
              Add a PDF or a captioned YouTube video, then talk to it. Speak
              your question and hear the answer, or type instead.
            </p>
          </div>

          <div
            className="entry-mode-switch"
            role="tablist"
            aria-label="Choose how to begin"
          >
            <span className="entry-mode-label">Begin with</span>
            <button
              type="button"
              role="tab"
              aria-selected={entryMode === "voice"}
              className={`entry-mode-trigger${
                entryMode === "voice" ? " active" : ""
              }`}
              onClick={() => switchEntryMode("voice")}
            >
              <Icon name="voice" /> Voice action
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={entryMode === "text"}
              className={`entry-mode-trigger${
                entryMode === "text" ? " active" : ""
              }`}
              onClick={() => switchEntryMode("text")}
            >
              <Icon name="document" /> Text action
            </button>
            <span className="entry-mode-tooltip-wrap" role="presentation">
              <button
                type="button"
                role="tab"
                aria-selected={entryMode === "motion"}
                aria-describedby="motion-beta-tip"
                title="Motion beta uses a deliberate device movement to reveal the next control."
                className={`entry-mode-trigger${
                  entryMode === "motion" ? " active" : ""
                }`}
                onClick={() => switchEntryMode("motion")}
              >
                <Icon name="motion" /> Motion beta
              </button>
              <span
                id="motion-beta-tip"
                className="entry-mode-tooltip"
                role="tooltip"
              >
                Preview the movement-first interaction. Motion beta is
                hover-only for now: no pointer clicks trigger actions, and it
                never uses your camera.
              </span>
            </span>
          </div>

          {entryMode === "voice" && (
            <VoiceActions
              onAction={handleVoiceAction}
              canStartVoice={Boolean(source)}
              voiceBusy={sessionLive || busy}
            />
          )}

          {entryMode === "motion" && (
            <section
              className="motion-actions-card"
              aria-labelledby="motion-actions-heading"
            >
              <div className="motion-actions-copy">
                <span className="eyebrow">Beta preview · motion actions</span>
                <h2 id="motion-actions-heading" tabIndex={-1}>
                  Move once. Imagine the next layer.
                </h2>
                <p>
                  This is a preview-only beta: pointer clicks never trigger
                  actions and no motion permission is requested. Hover over the
                  mode to see the interaction we are exploring.
                </p>
              </div>
              <div
                className="motion-actions-status"
                data-enabled="false"
                role="status"
                aria-live="polite"
              >
                <span className="motion-actions-pulse" aria-hidden="true" />
                Preview only · no click-triggered actions
              </div>
              <div className="motion-sensor-flow" aria-hidden="true">
                <span>
                  <Icon name="motion" /> Move
                </span>
                <span className="motion-sensor-arrow">→</span>
                <span>
                  <Icon name="arrow" /> Reveal
                </span>
                <span className="motion-sensor-ar">AR / VR layer</span>
              </div>
              <p className="hint">
                Future direction: a deliberate phone movement, gaze or gesture
                could reveal the next safe control in an AR/VR space. Voice
                remains the fallback and every action will still be cancellable.
              </p>
            </section>
          )}

          {voiceActionNotice && (
            <div className="toast" role="status" aria-live="polite">
              {voiceActionNotice}
              <button
                type="button"
                className="toast-dismiss"
                aria-label="Dismiss notification"
                onClick={() => setVoiceActionNotice("")}
              >
                ×
              </button>
            </div>
          )}

          <div className="workspace" id="workspace" tabIndex={-1}>
            <section
              className="card source-card"
              aria-labelledby="source-heading"
            >
              <div className="status-row">
                <h2 id="source-heading">
                  {source
                    ? "Your source"
                    : voiceFirstStart
                      ? "1. Start with your voice"
                      : motionFirstStart
                        ? "1. Move to begin"
                        : "1. Choose a source"}
                </h2>
                <span
                  className="status"
                  data-state={busy ? "preparing" : source ? "ready" : "idle"}
                  aria-live="polite"
                >
                  {busy
                    ? "Extracting"
                    : source
                      ? "Source ready"
                      : voiceFirstStart
                        ? "Voice-first mode"
                        : motionFirstStart
                          ? "Motion beta"
                          : "Step 1 of 2"}
                </span>
              </div>

              {source && (
                <div className="source-ready">
                  <Icon
                    name={source.kind === "youtube" ? "video" : "document"}
                  />
                  <div>
                    <strong>{source.sourceName}</strong>
                    <span>Ready · Your answers will use this source</span>
                  </div>
                </div>
              )}

              {!source && motionFirstStart && (
                <div className="motion-first-source">
                  <span className="eyebrow">Motion-first start</span>
                  <h3>Preview the movement-first workflow.</h3>
                  <p>
                    This beta does not activate sensors or trigger controls yet.
                    Use voice or text to add a source; motion only demonstrates
                    the future AR/VR direction.
                  </p>
                </div>
              )}

              {!source && voiceFirstStart && (
                <div className="voice-first-source">
                  <div className="voice-first-source-copy">
                    <span className="eyebrow">Voice-first start</span>
                    <h3>Say “upload” or “YouTube” to bring something in.</h3>
                    <p>
                      Arm voice actions above, then speak a trigger. Ursly will
                      open the right source control for you.
                    </p>
                  </div>
                  <div className="voice-first-source-example">
                    <span>“Upload”</span>
                    <small>opens the PDF picker</small>
                  </div>
                  <button
                    type="button"
                    className="secondary voice-first-manual"
                    onClick={() => {
                      setError("");
                      setSourcePickerOpen(true);
                    }}
                  >
                    Use upload instead <Icon name="arrow" />
                  </button>
                </div>
              )}

              {(source || sourcePickerOpen) && (
                <details
                  className="source-picker"
                  open={sourcePickerOpen}
                  onToggle={(event) => {
                    if (source) setSourcePickerOpen(event.currentTarget.open);
                  }}
                >
                  <summary>
                    {source
                      ? "Change source"
                      : "Choose a PDF or a video to get started"}
                  </summary>
                  {!source && (
                    <button
                      type="button"
                      className="source-back-actions"
                      onClick={() => {
                        setError("");
                        setSourcePickerOpen(false);
                        window.requestAnimationFrame(() =>
                          document
                            .getElementById(
                              entryMode === "motion"
                                ? "motion-actions-heading"
                                : "voice-actions-heading",
                            )
                            ?.focus(),
                        );
                      }}
                    >
                      <span aria-hidden="true">←</span> Back to {entryMode}{" "}
                      actions
                    </button>
                  )}
                  <p className="section-intro">
                    {source
                      ? "Adding a new source starts a new conversation."
                      : "We’ll read it for you. Then you can ask about it."}
                  </p>
                  <div className="source-controls">
                    <div
                      className="tabs"
                      data-tab={tab}
                      role="tablist"
                      aria-label="Source type"
                    >
                      {(
                        [
                          {
                            id: "pdf",
                            label: "PDF document",
                            icon: "document",
                          },
                          {
                            id: "youtube",
                            label: "YouTube video",
                            icon: "video",
                          },
                        ] as const
                      ).map(({ id, label, icon }) => (
                        <button
                          key={id}
                          className={`tab ${tab === id ? "active" : ""}`}
                          id={`tab-${id}`}
                          disabled={busy}
                          aria-controls="source-panel"
                          tabIndex={tab === id ? 0 : -1}
                          role="tab"
                          aria-selected={tab === id}
                          onKeyDown={(event) => {
                            if (
                              [
                                "ArrowRight",
                                "ArrowLeft",
                                "Home",
                                "End",
                              ].includes(event.key)
                            ) {
                              event.preventDefault();
                              const next = id === "pdf" ? "youtube" : "pdf";
                              setTab(next);
                              document.getElementById(`tab-${next}`)?.focus();
                            }
                          }}
                          onClick={() => {
                            setTab(id);
                            setError("");
                          }}
                        >
                          <Icon name={icon} /> {label}
                        </button>
                      ))}
                    </div>

                    <form
                      onSubmit={ingest}
                      className="source-grid"
                      id="source-panel"
                      role="tabpanel"
                      aria-labelledby={`tab-${tab}`}
                      aria-busy={busy}
                    >
                      {tab === "pdf" ? (
                        <label className="dropzone full" htmlFor="pdf-file">
                          <span className="upload-icon">
                            <Icon name="document" />
                          </span>
                          <strong>
                            {file ? file.name : "Pick a PDF up to 25 MB"}
                          </strong>
                          <div className="hint">
                            {file
                              ? `${(file.size / 1024 / 1024).toFixed(1)} MB · Ready to continue`
                              : "Choose a text-based paper, report, or document."}
                          </div>
                          <input
                            id="pdf-file"
                            aria-label="PDF file"
                            ref={fileInput}
                            type="file"
                            accept="application/pdf,.pdf"
                            onChange={onFile}
                            disabled={busy}
                          />
                        </label>
                      ) : (
                        <div className="field full" key="youtube">
                          <span className="upload-icon">
                            <Icon name="video" />
                          </span>
                          <label htmlFor="youtube-url">YouTube URL</label>
                          <input
                            id="youtube-url"
                            value={url}
                            onChange={(event) => setUrl(event.target.value)}
                            placeholder="https://youtube.com/watch?v=..."
                            inputMode="url"
                            disabled={busy}
                            aria-describedby="youtube-hint"
                          />
                          <p id="youtube-hint" className="hint">
                            Paste a link to a captioned video. Watch pages,
                            Shorts, share links and embeds all work.
                          </p>
                        </div>
                      )}
                      <div className="actions full">
                        <button
                          className="primary"
                          disabled={!canIngest || busy}
                          type="submit"
                        >
                          {busy ? (
                            <span className="spinner" aria-hidden="true" />
                          ) : (
                            <Icon name="arrow" />
                          )}
                          {busy
                            ? "Reading your source…"
                            : "Continue to questions"}
                        </button>
                      </div>
                    </form>
                  </div>
                </details>
              )}

              {uploadProgress !== undefined && (
                <div className="progress" role="status">
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label="Upload progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(uploadProgress * 100)}
                  >
                    <span
                      style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                    />
                  </div>
                  <span className="hint">
                    Uploading · {Math.round(uploadProgress * 100)}%
                  </span>
                </div>
              )}

              {!source && error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {!source && error && tab === "youtube" && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setTab("pdf");
                    setError("");
                    document.getElementById("tab-pdf")?.focus();
                  }}
                >
                  Use a PDF instead
                </button>
              )}
              {busy && uploadProgress === undefined && (
                <p className="hint" role="status">
                  Reading your source. This may take up to a minute. Your
                  questions are next.
                </p>
              )}

              {source && (
                <details className="preview">
                  <summary>
                    View source text · {source.characters.toLocaleString()}{" "}
                    characters
                  </summary>
                  <div className="preview-text">{source.text}</div>
                </details>
              )}
              {context?.truncated && (
                <p className="hint context-note" role="status">
                  This source is longer than one conversation can hold. The
                  assistant reads {context.usedCharacters.toLocaleString()} of{" "}
                  {context.totalCharacters.toLocaleString()} characters, taken
                  from the opening and the ending. The full text stays available
                  above.
                </p>
              )}
              {source && (
                <div className="source-next-step">
                  <span className="source-next-step-number">2</span>
                  <div>
                    <strong>Next: ask a question</strong>
                    <span>
                      Use voice or type below. Answers stay anchored to this
                      source.
                    </span>
                  </div>
                </div>
              )}
            </section>

            <section
              className="card conversation-card"
              data-ready={source ? "true" : "false"}
              aria-labelledby="conversation-heading"
            >
              <div className="status-row">
                <h2 id="conversation-heading" tabIndex={-1}>
                  2. Ask a question
                </h2>
                <span
                  className="status"
                  data-state={state.status}
                  aria-live="polite"
                >
                  {statusText[state.status]}
                </span>
              </div>

              {source && (
                <p className="conversation-source">
                  Exploring <strong>{source.sourceName}</strong>
                </p>
              )}
              {providerMode === "mock" && (
                <p className="hint" role="status">
                  Demo simulation: AI replies are simulated; microphone audio is
                  not sent to AI. Use live mode for real answers and voice.
                </p>
              )}

              <div className="voice-panel" data-live={sessionLive}>
                <div className="voice-controls actions">
                  <button
                    className="primary voice-start"
                    hidden={!source}
                    disabled={!source || sessionLive || !online}
                    onClick={startVoice}
                    type="button"
                  >
                    <Icon name="voice" /> Start Voice Chat
                  </button>
                  <button
                    className="secondary"
                    hidden={state.status !== "connected"}
                    disabled={state.status !== "connected"}
                    onClick={toggleMute}
                    aria-pressed={state.muted}
                    type="button"
                  >
                    {state.muted ? "Unmute microphone" : "Mute microphone"}
                  </button>
                  <button
                    className="danger"
                    hidden={!sessionLive}
                    disabled={!sessionLive}
                    onClick={stopVoice}
                    type="button"
                  >
                    Stop
                  </button>
                </div>
                <p className="hint voice-hint" aria-live="polite">
                  {!micSupported
                    ? "This browser will not share a microphone here, so voice is unavailable. Type your question below instead."
                    : sessionLive
                      ? state.status === "connected"
                        ? state.muted
                          ? "Microphone muted. Unmute to speak, or keep typing."
                          : activityText[activity]
                        : statusText[state.status]
                      : "Allow microphone access when prompted, then speak. You can mute or stop at any time, and typing always works."}
                </p>
              </div>

              <div
                className="chat"
                ref={chatLog}
                tabIndex={0}
                onScroll={(event) => {
                  const log = event.currentTarget;
                  followMessages.current =
                    log.scrollHeight - log.scrollTop - log.clientHeight < 64;
                }}
                role="log"
                aria-label="Conversation"
                aria-live="polite"
              >
                {state.messages.length === 0 ? (
                  <div className="empty-chat">
                    <div
                      className={`voice-orbit mode-orbit mode-orbit-${entryMode}`}
                      data-activity={sessionLive ? activity : "off"}
                      aria-hidden="true"
                    >
                      <Icon
                        name={
                          entryMode === "motion"
                            ? "motion"
                            : entryMode === "text"
                              ? "document"
                              : "voice"
                        }
                      />
                    </div>
                    <h3>
                      {entryMode === "voice" && !source
                        ? "Your voice is the shortcut."
                        : entryMode === "motion" && !source
                          ? "A hands-free layer for later."
                          : source
                            ? "What are you curious about?"
                            : "Good questions start here."}
                    </h3>
                    <p className="hint">
                      {entryMode === "voice" && !source
                        ? "Arm voice actions above and say a command such as “upload” or “YouTube”. Nothing starts without your explicit command."
                        : entryMode === "motion" && !source
                          ? "Hover over Motion beta to explore the concept. This preview never turns a pointer click into an action."
                          : source
                            ? "Start voice chat and speak, type your question below, or choose an idea."
                            : "Add a source, then explore the ideas inside it."}
                    </p>
                    {entryMode === "voice" && !source ? (
                      <div
                        className="command-rail"
                        aria-label="Voice command examples"
                      >
                        <span>
                          <Icon name="document" /> “Upload”
                        </span>
                        <span>
                          <Icon name="video" /> “YouTube”
                        </span>
                        <span>
                          <Icon name="voice" /> “Let's talk”
                        </span>
                      </div>
                    ) : entryMode === "motion" && !source ? (
                      <div
                        className="ar-vr-preview"
                        aria-label="Future AR and VR preview"
                      >
                        <span className="ar-vr-preview-orbit">
                          <Icon name="motion" />
                        </span>
                        <span>
                          <strong>Move</strong>
                          <small>gesture or gaze</small>
                        </span>
                        <span
                          className="ar-vr-preview-arrow"
                          aria-hidden="true"
                        >
                          →
                        </span>
                        <span>
                          <strong>Reveal</strong>
                          <small>the next safe control</small>
                        </span>
                      </div>
                    ) : (
                      <div className="suggestions">
                        {[
                          "Summarize the key ideas",
                          "Explain this simply",
                          "What should I remember?",
                        ].map((prompt) => (
                          <button
                            type="button"
                            className="suggestion"
                            key={prompt}
                            disabled={!source}
                            onClick={() => {
                              setQuestion(prompt);
                              questionInput.current?.focus();
                            }}
                          >
                            {prompt}
                            <span aria-hidden="true">↗</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  state.messages.map((message) => (
                    <div key={message.id} className={`message ${message.role}`}>
                      <span className="message-author">
                        {message.role === "user"
                          ? "You"
                          : message.role === "assistant"
                            ? "Ursly"
                            : "Session update"}
                      </span>
                      <span className="message-text">
                        {message.text || "…"}
                      </span>
                    </div>
                  ))
                )}
              </div>

              {pendingAnswers > 0 && (
                <p className="answer-pending" role="status">
                  <span className="spinner" aria-hidden="true" /> Finding an
                  answer in your source…
                </p>
              )}
              {source && (error || state.error) && (
                <p className="error" role="alert">
                  {error || state.error}
                </p>
              )}

              <label className="question-label" htmlFor="question">
                {state.status === "connected"
                  ? "Or type instead of speaking"
                  : source
                    ? "Your question"
                    : "Your question (ready when your source is added)"}
              </label>
              <form className="composer" onSubmit={sendText}>
                <input
                  id="question"
                  aria-label="Ask a question"
                  ref={questionInput}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={
                    source
                      ? "Ask a question…"
                      : "Type what you want to understand…"
                  }
                  disabled={busy}
                />
                <button
                  className="secondary"
                  type="submit"
                  disabled={!source || !question.trim() || pendingAnswers > 0}
                >
                  Send <Icon name="arrow" />
                </button>
              </form>
              <p className="hint answer-note">
                {source
                  ? "Answers come from your source. Check important details in “View source text”."
                  : "Add a PDF or YouTube source before sending so answers stay grounded."}
              </p>
            </section>
          </div>
        </div>

        <div className="container">
          <Onboarding />
        </div>

        <div className="container">
          <section
            className="how-it-works"
            id="how-it-works"
            aria-labelledby="how-heading"
          >
            <div className="guide-heading">
              <span className="eyebrow">A little guidance</span>
              <h2 id="how-heading">From information to understanding.</h2>
            </div>
            <div className="guide-grid">
              <article>
                <span className="guide-number">01</span>
                <h3>Bring your source</h3>
                <p>
                  Choose a text-based PDF up to 25 MB or a captioned YouTube
                  video, then check the extracted text in the preview.
                </p>
              </article>
              <article>
                <span className="guide-number">02</span>
                <h3>Start talking</h3>
                <p>
                  Select Start Voice Chat, allow the microphone, and ask out
                  loud. Interrupt or mute whenever you want; typing is always
                  available.
                </p>
              </article>
              <article>
                <span className="guide-number">03</span>
                <h3>Go a little deeper</h3>
                <p>
                  Use a suggestion or ask a follow-up in your own words. Keep
                  the source nearby to check important details.
                </p>
              </article>
            </div>
            <details className="help-detail">
              <summary>
                Having trouble with a source or your microphone?
              </summary>
              <p>
                Scanned PDFs need a text layer before upload. YouTube captions
                must be available, and some videos may be blocked by YouTube.
                For voice, allow microphone access in your browser. If voice
                cannot connect, you can still type your questions about an
                extracted source.
              </p>
            </details>
          </section>
          <Applications />
          <footer className="footer">
            <span>Ursly · Made for your next “aha”.</span>
            <a href="#applications">Applications &amp; GitHub ↗</a>
          </footer>
        </div>
      </main>
    </>
  );
}
