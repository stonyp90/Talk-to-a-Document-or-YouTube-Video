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
import { Icon } from "./Icon";
import type { EntryMode } from "./ModeSwitcher";
import { SiteFooter } from "./SiteFooter";
import { TopNav } from "./TopNav";
import { VoiceActions, type VoiceActionId } from "./VoiceActions";
import { spokenExamples } from "@/apps/web/src/lib/voiceCommands";
import { useLanguage } from "../i18n/LanguageProvider";
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

const INGEST_DEADLINE_MS = 60000;
const SESSION_DEADLINE_MS = 25000;
const ANSWER_DEADLINE_MS = 25000;

const LIVE_STATUSES = ["preparing", "connecting", "connected", "reconnecting"];

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

function subscribeToStorage(notify: () => void): () => void {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
}

const MODE_STORAGE_KEY = "ursly-mode-v1";

function readSavedMode(): EntryMode {
  try {
    return localStorage.getItem(MODE_STORAGE_KEY) === "text" ? "text" : "voice";
  } catch {
    return "voice";
  }
}

/**
 * The application itself, at `/<lang>/app`: add a source, then ask about it.
 * It holds every piece of conversation state and nothing about the story —
 * the pitch, the introduction and the platform sections live on the landing
 * page, one tap away through the menu.
 */
export default function Workspace() {
  const { t, language } = useLanguage();
  /** The wording this language listens for, so a notice never quotes another. */
  const spokenPhrase = (action: VoiceActionId) =>
    spokenExamples(language).find((example) => example.action === action)
      ?.phrase ?? "";
  // The chosen mode is remembered per browser. The server snapshot is voice,
  // so hydration has nothing to reconcile; a choice made here wins over it.
  const savedMode = useSyncExternalStore(
    subscribeToStorage,
    readSavedMode,
    () => "voice" as EntryMode,
  );
  const [chosenMode, setChosenMode] = useState<EntryMode | null>(null);
  const entryMode: EntryMode = chosenMode ?? savedMode;
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
  const [sourcePickerOpen, setSourcePickerOpen] = useState(true);
  const [dragging, setDragging] = useState(false);
  const [voiceActionNotice, setVoiceActionNotice] = useState("");
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

  const statusText: Record<string, string> = {
    idle: t("Ready"),
    preparing: t("Preparing"),
    connecting: t("Connecting"),
    connected: t("Connected"),
    reconnecting: t("Reconnecting"),
    ended: t("Ended"),
    error: t("Needs attention"),
  };
  const activityText: Record<VoiceActivity, string> = {
    idle: t("Listening for your question"),
    listening: t("Hearing you"),
    speaking: t("Answering — speak to interrupt"),
  };

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

  // The tab title carries the live voice state, visible from any other tab.
  useEffect(() => {
    const base = document.title.replace(/^[^—]*— /, "");
    if (state.status !== "connected") {
      document.title = base;
      return;
    }
    const live =
      activity === "speaking"
        ? t("Answering")
        : activity === "listening"
          ? t("Hearing you")
          : t("Listening");
    document.title = `● ${live} — ${base}`;
    return () => {
      document.title = base;
    };
  }, [state.status, activity, t]);

  useEffect(() => {
    if (!voiceActionNotice) return;
    const timeout = window.setTimeout(() => setVoiceActionNotice(""), 4200);
    return () => window.clearTimeout(timeout);
  }, [voiceActionNotice]);

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
        t("Reading your source timed out. Check your connection and retry."),
        async () => {
          const health = await requestJson<Health>("/api/health", {
            signal: controller.signal,
          });
          if (current()) setProviderMode(health.mode ?? "");

          if (tab === "pdf" && file && health.directUpload) {
            try {
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
            } catch (directUploadError) {
              if (controller.signal.aborted) throw directUploadError;
              // A presigned upload can fail independently of the app (CORS,
              // a local object store restart, or a brief network transition).
              // Retry once through the bounded multipart route so the user is
              // never stranded behind a direct-upload-only path.
              if (current()) setUploadProgress(undefined);
              const form = new FormData();
              form.append("file", file);
              return requestJson<SourceEnvelope>("/api/ingest", {
                signal: controller.signal,
                method: "POST",
                body: form,
                retries: 0,
              });
            }
          }

          const form = new FormData();
          if (tab === "pdf" && file) form.append("file", file);
          if (tab === "youtube") form.append("url", url);
          return requestJson<SourceEnvelope>("/api/ingest", {
            method: "POST",
            body: form,
            signal: controller.signal,
            retries: 0,
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
          t(
            readable(caught, "We couldn’t read this source. Please try again."),
          ),
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
        t(
          "Voice session setup timed out. Check your connection and retry Start voice chat.",
        ),
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
      const message = t(
        readable(
          caught,
          "Microphone access is unavailable. You can type your question instead.",
        ),
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
        const message = t(
          readable(
            caught,
            "That message did not reach the voice session. Please retry.",
          ),
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
        t(
          "The answer timed out. Check your connection and retry your question.",
        ),
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
        setError(t(readable(caught, "The answer could not be produced.")));
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
    setChosenMode(mode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      /* The choice still holds for this visit. */
    }
    setError("");
    setVoiceActionNotice(
      mode === "voice"
        ? t("Voice to action: say a command, or use the controls as usual.")
        : t("Keyboard to action: everything works by typing and clicking."),
    );
  }

  function openUploadPicker() {
    focusSourceControl("upload");
    setVoiceActionNotice(
      t("Upload is ready — choose a PDF in the file picker to finish."),
    );
    voicePickerInput.current?.click();
  }

  function handleVoiceAction(action: VoiceActionId) {
    if (action === "youtube") {
      focusSourceControl("youtube");
      setVoiceActionNotice(
        t("YouTube is ready — dictate or paste a video link next."),
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
          t("Add a PDF or YouTube source first, then say “{phrase}” again.", {
            phrase: spokenPhrase("voice"),
          }),
        );
        return;
      }
      void startVoice();
      return;
    }
    if (action === "summarize") {
      if (!source) {
        setVoiceActionNotice(
          t("Add a PDF or YouTube source first, then say “{phrase}” again.", {
            phrase: spokenPhrase("summarize"),
          }),
        );
        return;
      }
      setQuestion(t("Summarize the key ideas"));
      setVoiceActionNotice(
        t("Your summary request is ready in the question box."),
      );
      window.requestAnimationFrame(() => questionInput.current?.focus());
      return;
    }
    if (action === "back") {
      if (sessionLive) stopVoice();
      setSourcePickerOpen(true);
      focusSourceControl(tab === "youtube" ? "youtube" : "upload");
      setVoiceActionNotice(t("Going back — the source controls are ready."));
      return;
    }
    if (action === "next") {
      if (!source) {
        focusSourceControl(tab === "youtube" ? "youtube" : "upload");
        setVoiceActionNotice(
          t("Next step: choose a PDF or paste a YouTube link."),
        );
        return;
      }
      setVoiceActionNotice(t("Next step: ask your question."));
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
    setVoiceActionNotice(t("Cancelled — the current action has been stopped."));
  }

  const suggestions = [
    t("Summarize the key ideas"),
    t("Explain this simply"),
    t("What should I remember?"),
  ];

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
        {t("Skip to the app")}
      </a>
      <TopNav page="app" mode={entryMode} onModeChange={switchEntryMode} />

      <main className="shell">
        <div className="container app-frame">
          {!online && (
            <p className="banner banner-offline" role="alert">
              {t(
                "You are offline. Ursly will reconnect when your network returns.",
              )}
            </p>
          )}

          <div className="workspace-heading">
            <div className="workspace-heading-copy">
              <h1>
                {t("Your source.")} <span>{t("Your questions.")}</span>
              </h1>
              <p className="lede">
                {entryMode === "voice"
                  ? t(
                      "Add a PDF or a captioned YouTube video, then talk to it. Say a command, speak your question, or type whenever you prefer.",
                    )
                  : t(
                      "Add a PDF or a captioned YouTube video, then ask about it by typing. Voice stays one tap away.",
                    )}
              </p>
            </div>
            <ol className="progress-steps" aria-label={t("Progress")}>
              <li
                aria-current={source ? undefined : "step"}
                data-done={Boolean(source)}
              >
                <span>{source ? "✓" : "1"}</span> {t("Add a source")}
              </li>
              <li aria-current={source ? "step" : undefined}>
                <span>2</span> {t("Ask a question")}
              </li>
            </ol>
          </div>

          {voiceActionNotice && (
            <div className="toast" role="status" aria-live="polite">
              {voiceActionNotice}
              <button
                type="button"
                className="toast-dismiss"
                aria-label={t("Dismiss notification")}
                onClick={() => setVoiceActionNotice("")}
              >
                ×
              </button>
            </div>
          )}

          <div
            className="workspace"
            id="workspace"
            tabIndex={-1}
            data-mode={entryMode}
          >
            <section
              className="card source-card"
              aria-labelledby="source-heading"
            >
              <div className="status-row">
                <h2 id="source-heading">
                  {source ? t("Your source") : t("1. Add a source")}
                </h2>
                <span
                  className="status"
                  data-state={busy ? "preparing" : source ? "ready" : "idle"}
                  aria-live="polite"
                >
                  {busy
                    ? t("Extracting")
                    : source
                      ? t("Source ready")
                      : t("Step 1 of 2")}
                </span>
              </div>

              {source && (
                <div className="source-ready">
                  <Icon
                    name={source.kind === "youtube" ? "video" : "document"}
                  />
                  <div>
                    <strong>{source.sourceName}</strong>
                    <span>
                      {t("Ready · Your answers will use this source")}
                    </span>
                  </div>
                </div>
              )}

              {entryMode === "voice" && !source && (
                <VoiceActions
                  onAction={handleVoiceAction}
                  canStartVoice={Boolean(source)}
                  voiceBusy={sessionLive || busy}
                />
              )}

              <details
                className="source-picker"
                data-collapsible={Boolean(source)}
                open={!source || sourcePickerOpen}
                onToggle={(event) => {
                  if (source) setSourcePickerOpen(event.currentTarget.open);
                }}
              >
                <summary>
                  {source
                    ? t("Change source")
                    : t("Choose a PDF or a video to get started")}
                </summary>
                <p className="section-intro">
                  {source
                    ? t("Adding a new source starts a new conversation.")
                    : t("Ursly reads it for you. Then you can ask about it.")}
                </p>
                <div className="source-controls">
                  <div
                    className="tabs"
                    data-tab={tab}
                    role="tablist"
                    aria-label={t("Source type")}
                  >
                    {(
                      [
                        { id: "pdf", label: "PDF document", icon: "document" },
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
                            ["ArrowRight", "ArrowLeft", "Home", "End"].includes(
                              event.key,
                            )
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
                        <Icon name={icon} /> {t(label)}
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
                      <label
                        className="dropzone full"
                        htmlFor="pdf-file"
                        data-dragging={dragging}
                        data-filled={Boolean(file)}
                        onDragOver={(event) => {
                          event.preventDefault();
                          if (!busy) setDragging(true);
                        }}
                        onDragLeave={() => setDragging(false)}
                        onDrop={(event) => {
                          event.preventDefault();
                          setDragging(false);
                          if (busy) return;
                          const dropped = event.dataTransfer.files?.[0];
                          if (dropped) {
                            setFile(dropped);
                            setError("");
                          }
                        }}
                      >
                        <span className="upload-icon">
                          <Icon name={file ? "document" : "download"} />
                        </span>
                        <strong>
                          {file ? file.name : t("Drop a PDF here")}
                        </strong>
                        <div className="hint">
                          {file
                            ? t("{size} MB · Ready to continue", {
                                size: (file.size / 1024 / 1024).toFixed(1),
                              })
                            : t(
                                "or choose one from your device · up to 25 MB, text-based",
                              )}
                        </div>
                        <span
                          className="secondary dropzone-button"
                          aria-hidden="true"
                        >
                          {file ? t("Choose another PDF") : t("Choose a PDF")}
                        </span>
                        <input
                          id="pdf-file"
                          aria-label={t("PDF file")}
                          ref={fileInput}
                          type="file"
                          accept="application/pdf,.pdf"
                          onChange={onFile}
                          disabled={busy}
                        />
                      </label>
                    ) : (
                      <div className="field full" key="youtube">
                        {/* No icon here: the drop target's bordered square
                            reads as a button when it sits beside a plain
                            field, and this field needs only its label. */}
                        <label htmlFor="youtube-url">{t("YouTube URL")}</label>
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
                          {t(
                            "Paste a link to a captioned video. Watch pages, Shorts, share links and embeds all work.",
                          )}
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
                          ? t("Reading your source…")
                          : t("Continue to questions")}
                      </button>
                    </div>
                  </form>
                </div>
              </details>

              {uploadProgress !== undefined && (
                <div className="progress" role="status">
                  <div
                    className="progress-track"
                    role="progressbar"
                    aria-label={t("Upload progress")}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(uploadProgress * 100)}
                  >
                    <span
                      style={{ width: `${Math.round(uploadProgress * 100)}%` }}
                    />
                  </div>
                  <span className="hint">
                    {t("Uploading · {percent}%", {
                      percent: Math.round(uploadProgress * 100),
                    })}
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
                  {t("Use a PDF instead")}
                </button>
              )}
              {busy && uploadProgress === undefined && (
                <p className="hint" role="status">
                  {t(
                    "Reading your source. This may take up to a minute. Your questions are next.",
                  )}
                </p>
              )}

              {source && (
                <details className="preview">
                  <summary>
                    {t("View source text · {count} characters", {
                      count: source.characters.toLocaleString(),
                    })}
                  </summary>
                  <div className="preview-text">{source.text}</div>
                </details>
              )}
              {context?.truncated && (
                <p className="hint context-note" role="status">
                  {t(
                    "This source is longer than one conversation can hold. The assistant reads {used} of {total} characters, taken from the opening and the ending. The full text stays available above.",
                    {
                      used: context.usedCharacters.toLocaleString(),
                      total: context.totalCharacters.toLocaleString(),
                    },
                  )}
                </p>
              )}
              {source && (
                <div className="source-next-step">
                  <span className="source-next-step-number">2</span>
                  <div>
                    <strong>{t("Next: ask a question")}</strong>
                    <span>
                      {t(
                        "Use voice or type below. Answers stay anchored to this source.",
                      )}
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
                  {t("2. Ask a question")}
                </h2>
                <span
                  className="status"
                  data-state={state.status}
                  aria-live="polite"
                >
                  {statusText[state.status]}
                </span>
              </div>

              {/*
                A quiet, honest signal that the voice model is learning from
                this person while they talk: present, never in the way, and
                one tap from the consent story.
              */}
              {sessionLive && state.status === "connected" && (
                <a className="voice-learning" href={`/${language}#platform`}>
                  <span className="voice-learning-dot" aria-hidden="true" />
                  <span>
                    <strong>{t("Adapting to your voice")}</strong>
                    <small>
                      {t(
                        "Learning your accent, pace and words from this session. Nothing is kept without your say.",
                      )}
                    </small>
                  </span>
                </a>
              )}

              {source && (
                <p className="conversation-source">
                  {t("Exploring")} <strong>{source.sourceName}</strong>
                </p>
              )}
              {providerMode === "mock" && (
                <p className="hint" role="status">
                  {t(
                    "Demo simulation: AI replies are simulated; microphone audio is not sent to AI. Use live mode for real answers and voice.",
                  )}
                </p>
              )}

              <div
                className="voice-panel"
                data-live={sessionLive}
                data-empty={!source}
              >
                <div className="voice-controls actions">
                  <button
                    className="primary voice-start"
                    hidden={!source}
                    disabled={!source || sessionLive || !online}
                    onClick={startVoice}
                    type="button"
                  >
                    <Icon name="voice" /> {t("Start voice chat")}
                  </button>
                  <button
                    className="secondary"
                    hidden={state.status !== "connected"}
                    disabled={state.status !== "connected"}
                    onClick={toggleMute}
                    aria-pressed={state.muted}
                    type="button"
                  >
                    {state.muted
                      ? t("Unmute microphone")
                      : t("Mute microphone")}
                  </button>
                  <button
                    className="danger"
                    hidden={!sessionLive}
                    disabled={!sessionLive}
                    onClick={stopVoice}
                    type="button"
                  >
                    {t("Stop")}
                  </button>
                </div>
                <p className="hint voice-hint" aria-live="polite">
                  {!micSupported
                    ? t(
                        "This browser will not share a microphone here, so voice is unavailable. Type your question below instead.",
                      )
                    : sessionLive
                      ? state.status === "connected"
                        ? state.muted
                          ? t(
                              "Microphone muted. Unmute to speak, or keep typing.",
                            )
                          : activityText[activity]
                        : statusText[state.status]
                      : source
                        ? t(
                            "Allow microphone access when prompted, then speak. You can mute or stop at any time, and typing always works.",
                          )
                        : t(
                            "Voice chat opens as soon as your source is ready. Typing always works too.",
                          )}
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
                aria-label={t("Conversation")}
                aria-live="polite"
              >
                {state.messages.length === 0 ? (
                  <div className="empty-chat" data-mode={entryMode}>
                    <div
                      className={`voice-orbit mode-orbit mode-orbit-${entryMode}`}
                      data-activity={sessionLive ? activity : "off"}
                      aria-hidden="true"
                    >
                      <span className="voice-orbit-ring" />
                      <span className="voice-orbit-ring" />
                      <Icon
                        name={entryMode === "text" ? "document" : "voice"}
                      />
                    </div>
                    <h3>
                      {source
                        ? t("What are you curious about?")
                        : entryMode === "voice"
                          ? t("Your voice is the shortcut.")
                          : t("Good questions start here.")}
                    </h3>
                    <p className="hint">
                      {source
                        ? t(
                            "Start voice chat and speak, type your question below, or choose an idea.",
                          )
                        : entryMode === "voice"
                          ? t(
                              "Bring a source in with a word, then ask out loud. Nothing starts without your word, and typing always works.",
                            )
                          : t(
                              "Add a source, then explore the ideas inside it.",
                            )}
                    </p>
                    {source && (
                      <div className="suggestions">
                        {suggestions.map((prompt) => (
                          <button
                            type="button"
                            className="suggestion"
                            key={prompt}
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
                          ? t("You")
                          : message.role === "assistant"
                            ? "Ursly"
                            : t("Session update")}
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
                  <span className="spinner" aria-hidden="true" />{" "}
                  {t("Finding an answer in your source…")}
                </p>
              )}
              {source && (error || state.error) && (
                <p className="error" role="alert">
                  {error || state.error}
                </p>
              )}

              <label className="question-label" htmlFor="question">
                {state.status === "connected"
                  ? t("Or type instead of speaking")
                  : source
                    ? t("Your question")
                    : t("Your question (ready when your source is added)")}
              </label>
              <form className="composer" onSubmit={sendText}>
                <input
                  id="question"
                  aria-label={t("Ask a question")}
                  ref={questionInput}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  placeholder={
                    source
                      ? t("Ask a question…")
                      : t("Type what you want to understand…")
                  }
                  disabled={busy}
                />
                <button
                  className="secondary"
                  type="submit"
                  disabled={!source || !question.trim() || pendingAnswers > 0}
                >
                  {t("Send")} <Icon name="arrow" />
                </button>
              </form>
              <p className="hint answer-note">
                {source
                  ? t(
                      "Answers come from your source. Check important details in “View source text”.",
                    )
                  : t(
                      "Add a PDF or YouTube source before sending so answers stay grounded.",
                    )}
              </p>
            </section>
          </div>

          <SiteFooter page="app" />
        </div>
      </main>
    </>
  );
}
