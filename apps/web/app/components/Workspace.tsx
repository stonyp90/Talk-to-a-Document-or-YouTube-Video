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
import { SignInGate } from "./SignInGate";
import { WorkspaceDialog } from "./WorkspaceDialog";
import styles from "./Workspace.module.css";
import { AppPreferences, TopNav } from "./TopNav";
import { Markdown } from "./Markdown";
import type { VoiceActionId } from "./VoiceActions";
import { type SenseActivity } from "./SenseControls";
import { DeviceConnect } from "./DeviceConnect";
import { defaultPhrases } from "@/packages/core/src/domain/voiceCommands";
import { VoiceLending } from "./VoiceLending";
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
  ChatSocket,
  chatSocketUrl,
  type ChatSocketEvent,
} from "@/apps/web/src/lib/chatSocket";
import {
  ApiError,
  requestJson,
  uploadWithProgress,
  type ContextUsage,
  type Health,
  type RealtimeCredential,
  type SourceEnvelope,
} from "@/apps/web/src/lib/api";
import { streamAnswer } from "@/apps/web/src/lib/streamAnswer";
import { readSession, signOut } from "@/apps/web/src/lib/account";
import { YouTubePlayer } from "./YouTubePlayer";
import ImmersiveFileBrowser from "./ImmersiveFileBrowser";
import { createMemoryFileSystem } from "@/packages/adapters/src/fileSystem";
import type { FileNode } from "@/packages/core/src/domain/fileSystem";
import { AssistantName } from "./AssistantName";
import { useVoiceSpeed } from "@/apps/web/src/lib/useVoiceSpeed";
import {
  DEFAULT_ASSISTANT_NAME,
  type CallerMood,
} from "@/packages/core/src/domain/voiceControls";
import { InteractionFeedback } from "./InteractionFeedback";
import { ConversationStream } from "./ConversationStream";
import { LivingLogo } from "./LivingLogo";
import { LogoOnboarding } from "./LogoOnboarding";
import { FeedbackOverlay } from "./FeedbackOverlay";
import { QuickToggleBar } from "./QuickToggleBar";

type SourceTab = "pdf" | "youtube";

const INGEST_DEADLINE_MS = 60000;
const SESSION_DEADLINE_MS = 25000;
const ANSWER_DEADLINE_MS = 25000;

const LIVE_STATUSES = ["preparing", "connecting", "connected", "reconnecting"];
const SEARCH_DEADLINE_MS = 15000;
/** A found video the reader can open, or swap for one of the alternatives. */
type VideoResult = {
  videoId: string;
  title: string;
  channel?: string;
  url: string;
};
/** A streamed answer is allowed to take longer, because it is already arriving. */
const STREAM_DEADLINE_MS = 120000;
/** Below this distance from the end, the log keeps following the latest words. */
const FOLLOW_THRESHOLD_PX = 64;

/**
 * Extracts a YouTube video ID from a URL. Returns undefined if the URL is not
 * a valid YouTube link or the ID cannot be parsed.
 */
function extractVideoId(rawUrl: string): string | undefined {
  if (!rawUrl) return undefined;
  const trimmed = rawUrl.trim();
  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    const host = url.hostname.toLowerCase().replace(/^www\./, "");
    if (host === "youtu.be") {
      const segments = url.pathname.split("/").filter(Boolean);
      return segments[0] || undefined;
    }
    if (host.includes("youtube.com")) {
      return url.searchParams.get("v") || undefined;
    }
  } catch {
    // Not a valid URL
  }
  return undefined;
}

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
    if (caught.code === "UNAUTHENTICATED")
      return "Your session has ended. Sign in again to pick up where you left off.";
    if (caught.code === "USAGE_LIMIT")
      return "You have used this account's allowance for now. It reopens shortly.";
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
    const saved = localStorage.getItem(MODE_STORAGE_KEY);
    return saved === "text" ? "text" : "human";
  } catch {
    return "human";
  }
}

/**
 * The application itself, at `/<lang>/app`: one immersive space where a source
 * is added and questions are asked. The source picker floats as an overlay;
 * the conversation unfolds in the same space. Voice, motion and keyboard are
 * always available — the entry mode controls which is visually primary.
 */
export default function Workspace() {
  const { t, language } = useLanguage();
  /** The wording this language listens for, so a notice never quotes another. */
  const spokenPhrase = (action: VoiceActionId) =>
    defaultPhrases(language)[action][0] ?? "";
  // The chosen input preference is remembered per browser. The server snapshot is human,
  // so hydration has nothing to reconcile; a choice made here wins over it.
  const savedMode = useSyncExternalStore(
    subscribeToStorage,
    readSavedMode,
    () => "human" as EntryMode,
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
  const [senseActivity, setSenseActivity] = useState<SenseActivity>({
    listening: false,
    motion: false,
    connecting: false,
  });
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);
  const [sourceFocus, setSourceFocus] = useState<SourceTab | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [voiceActionNotice, setVoiceActionNotice] = useState("");
  /** The live channel's own state, separate from the spoken session's. */
  const [channelStatus, setChannelStatus] = useState<
    "idle" | "connecting" | "live" | "reconnecting" | "offline"
  >("idle");
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [atLatest, setAtLatest] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  /** The last question asked, so "Try again" can ask it once more. */
  const [lastAsked, setLastAsked] = useState("");
  // Undefined until the session call comes back, so the gate is not flashed
  // at a reader who is already signed in. The workspace itself stays on the
  // page throughout: the gate stands over it rather than replacing it.
  const [account, setAccount] = useState<string | null | undefined>(undefined);
  const [videoChoices, setVideoChoices] = useState<VideoResult[]>([]);
  const [searchingVideos, setSearchingVideos] = useState(false);
  const [videoId, setVideoId] = useState<string | undefined>(undefined);
  const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [fileSystem] = useState(createMemoryFileSystem);
  const [gazePosition, setGazePosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [assistantName, setAssistantName] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_ASSISTANT_NAME;
    return (
      localStorage.getItem("ursly-assistant-name") ?? DEFAULT_ASSISTANT_NAME
    );
  });
  const { speed: voiceSpeed, setSpeed: setVoiceSpeed } = useVoiceSpeed();
  const [mood, setMood] = useState<CallerMood>("calm");
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(null);
  const [replayOnboarding, setReplayOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [onboardingSeen, setOnboardingSeen] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("ursly-onboarding-seen") === "true";
  });
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

  const questionInput = useRef<HTMLTextAreaElement>(null);
  const chatLog = useRef<HTMLDivElement>(null);
  const followMessages = useRef(true);
  const realtime = useRef<RealtimeClient | null>(null);
  const mounted = useRef(true);
  const sourceVersion = useRef(0);
  const voiceVersion = useRef(0);
  const sessionRequest = useRef<AbortController | null>(null);
  const textRequests = useRef(new Set<AbortController>());
  const answerRequest = useRef<AbortController | null>(null);
  // What the realtime session has said so far, so a finished turn can be handed
  // to the server. The reducer holds the same text for display; this copy exists
  // because the event handler has to act the moment a turn completes.
  const spokenTurns = useRef(
    new Map<string, { role: "user" | "assistant"; text: string }>(),
  );
  const uploadRequest = useRef<AbortController | null>(null);
  const voiceActive = useRef(false);
  const sourceIdRef = useRef<string | undefined>(undefined);
  const sourceRef = useRef<IngestedSource | undefined>(undefined);
  const chat = useRef<ChatSocket | null>(null);
  const onChannelEvent = useRef<(event: ChatSocketEvent) => void>(() => {});
  /** Answers the reader stopped, whose remaining fragments are ignored. */
  const stoppedAnswers = useRef(new Set<string>());
  const fileInput = useRef<HTMLInputElement>(null);
  const voicePickerInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (followMessages.current && chatLog.current)
      chatLog.current.scrollTop = chatLog.current.scrollHeight;
  }, [state.messages]);

  useEffect(() => {
    localStorage.setItem("ursly-assistant-name", assistantName);
  }, [assistantName]);

  // A reader can choose a PDF before this page's script has run, and the
  // change event is lost because React was not listening yet: the picker
  // holds a file the page does not know about, and the way forward stays
  // disabled. Adopt whatever is already there the moment we can see it.
  useEffect(() => {
    const chosen = fileInput.current?.files?.[0];
    if (chosen) setFile((current) => current ?? chosen);
  }, []);

  useEffect(() => {
    let current = true;
    void readSession()
      .then((session) => {
        if (current) setAccount(session?.email ?? null);
      })
      .catch(() => {
        // The gate answers for itself on the next request; a reader is not
        // locked out of the page because one status call did not land.
        if (current) setAccount(null);
      });
    return () => {
      current = false;
    };
  }, []);

  // The box is as tall as what has been written, up to the height the stylesheet
  // allows, so a long question is visible instead of scrolling inside one line.
  // An empty box is left to the stylesheet: measuring one before the first paint
  // reads a height it will never have again, and the first keystroke shrinks it.
  useEffect(() => {
    const box = questionInput.current;
    if (!box) return;
    if (!question) {
      box.style.height = "";
      return;
    }
    box.style.height = "auto";
    box.style.height = `${box.scrollHeight}px`;
  }, [question]);

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
      chat.current?.close();
      chat.current = null;
      voiceActive.current = false;
    };
  }, []);

  useEffect(() => {
    if (source) questionInput.current?.focus();
  }, [source]);

  // Read through a ref, so a language change or a new message never tears down
  // a connection the reader is in the middle of using. The answer is keyed by
  // the ask, exactly as the request/response path keys it, so the thread, the
  // caret, the copy control and Stop behave the same on either transport.
  const handleChannelEvent = (event: ChatSocketEvent) => {
    const settle = (askId: string) => {
      stoppedAnswers.current.delete(askId);
      setStreamingId((id) => (id === askId ? null : id));
      setPendingAnswers((count) => Math.max(0, count - 1));
    };
    switch (event.type) {
      case "connecting":
        return setChannelStatus("connecting");
      case "reconnecting":
        return setChannelStatus("reconnecting");
      case "closed":
        return setChannelStatus("offline");
      case "ready":
        sourceIdRef.current = event.sourceId;
        setContext(event.context);
        return setChannelStatus("live");
      case "started":
        setStreamingId(event.askId);
        return dispatch({
          type: "MESSAGE_STARTED",
          message: {
            id: event.askId,
            role: "assistant",
            text: "",
            status: "partial",
          },
        });
      case "delta":
        if (stoppedAnswers.current.has(event.askId)) return;
        return dispatch({
          type: "MESSAGE_DELTA",
          id: event.askId,
          text: event.text,
        });
      case "completed":
        sourceIdRef.current = event.sourceId;
        if (!stoppedAnswers.current.has(event.askId))
          dispatch({
            type: "MESSAGE_COMPLETED",
            id: event.askId,
            text: event.text,
          });
        return settle(event.askId);
      case "failed":
        if (!event.askId) return setError(t(event.message));
        dispatch({ type: "MESSAGE_COMPLETED", id: event.askId });
        settle(event.askId);
        return setError(t(event.message));
    }
  };

  useEffect(() => {
    onChannelEvent.current = handleChannelEvent;
  });

  /**
   * One socket per source, held open for the whole discussion, so a question
   * is a short frame rather than a request that re-establishes everything.
   * Voice carries its own connection, so the channel belongs to the typed
   * conversation and closes when the reader leaves it or changes source.
   */
  useEffect(() => {
    sourceRef.current = source;
    const url = chatSocketUrl();
    if (!url || !source) return;
    const socket = new ChatSocket({
      url,
      reference: () => ({
        sourceId: sourceIdRef.current,
        source: sourceRef.current,
      }),
      onEvent: (event) => onChannelEvent.current(event),
    });
    chat.current = socket;
    socket.start();
    return () => {
      socket.close();
      if (chat.current === socket) chat.current = null;
      setChannelStatus("idle");
    };
  }, [source]);

  // The tab title carries the live voice state, visible from any other tab. The
  // page's own title is read once and kept: deriving it from whatever the title
  // currently says would eat a word of the real title on every pass.
  const pageTitle = useRef("");
  useEffect(() => {
    if (!pageTitle.current) pageTitle.current = document.title;
    const base = pageTitle.current;
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

  useEffect(() => {
    const last = state.messages[state.messages.length - 1];
    if (
      last &&
      last.role === "assistant" &&
      last.text &&
      last.status !== "partial" &&
      !streamingId &&
      pendingAnswers === 0
    ) {
      setFeedbackMessageId((current) =>
        current === last.id ? current : last.id,
      );
    }
  }, [state.messages, streamingId, pendingAnswers]);

  useEffect(() => {
    if (onboardingSeen && !replayOnboarding) return;
    if (state.messages.length > 0) return;
    const steps = 4;
    let cancelled = false;
    let currentStep = 0;
    function tick() {
      if (cancelled) return;
      if (currentStep > steps) {
        localStorage.setItem("ursly-onboarding-seen", "true");
        setOnboardingSeen(true);
        setReplayOnboarding(false);
        return;
      }
      setOnboardingStep(currentStep);
      const delay =
        currentStep === 0 ? 1800 : currentStep >= steps ? 4000 : 3200;
      currentStep++;
      setTimeout(tick, delay);
    }
    tick();
    return () => {
      cancelled = true;
    };
  }, [onboardingSeen, replayOnboarding, state.messages.length]);

  const onboardingToasts = useMemo(() => {
    if (onboardingStep === 0) return null;
    const messages = [
      t("The logo breath with you."),
      t("Color is emotion. Size is depth."),
      t("Pulse means it is listening."),
      t("Tap the logo to add a source."),
    ];
    const visible = messages.slice(0, Math.min(onboardingStep, messages.length));
    const fading = onboardingStep > messages.length;
    return visible.map((msg, i) => ({ msg, fading }));
  }, [onboardingStep, t]);

  const invalidateVoice = useCallback(() => {
    voiceVersion.current++;
    spokenTurns.current.clear();
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

  function ingest(event: FormEvent) {
    event.preventDefault();
    void startIngest();
  }

  /**
   * Reads a source. The caller may name the video, because a link found by
   * voice search is never in the field the reader would have typed it into.
   */
  async function startIngest(chosen?: { url?: string }) {
    const wanted = chosen?.url ?? url;
    const kind: SourceTab = chosen?.url ? "youtube" : tab;
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
    setContext(undefined);
    sourceIdRef.current = undefined;
    followMessages.current = true;
    setProviderMode("");
    setQuestion("");
    dispatch({ type: "RESET" });

    // Extract the video ID for the immersive player when the source is YouTube.
    if (kind === "youtube") {
      setVideoId(extractVideoId(wanted));
    } else {
      setVideoId(undefined);
    }

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

          if (kind === "pdf" && file && health.directUpload) {
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
          if (kind === "pdf" && file) form.append("file", file);
          if (kind === "youtube") form.append("url", wanted);
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
      setSourceFocus(null);
      sourceIdRef.current = envelope.sourceId;
      setContext(envelope.context);
      dispatch({ type: "CLEAR_ERROR" });
    } catch (caught) {
      noteSignedOut(caught);
      if (current())
        setError(
          t(
            readable(caught, "We couldn't read this source. Please try again."),
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
          "Voice session setup timed out. Check your connection and retry Start Voice Chat.",
        ),
        () =>
          withSession(
            (body) =>
              requestJson<RealtimeCredential>("/api/realtime/session", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal,
              }),
            { speed: voiceSpeed, assistantName },
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
          // The caller asked for these out loud; the settings follow.
          if (event.control?.kind === "voice-speed")
            setVoiceSpeed(event.control.speed);
          if (event.control?.kind === "assistant-name")
            setAssistantName(event.control.name);
          if (event.control?.kind === "mood") setMood(event.control.mood);
          if (event.type === "ended" || event.type === "error")
            setMood("calm");
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
              message: event.error ?? t("Realtime error"),
            });
          }
          if (event.type === "message-started" && event.message) {
            if (event.message.role !== "system")
              spokenTurns.current.set(event.message.id, {
                role: event.message.role,
                text: event.message.text,
              });
            dispatch({ type: "MESSAGE_STARTED", message: event.message });
          }
          if (event.type === "message-delta" && event.id) {
            const turn = spokenTurns.current.get(event.id);
            if (turn) turn.text += event.text ?? "";
            dispatch({
              type: "MESSAGE_DELTA",
              id: event.id,
              text: event.text ?? "",
            });
          }
          if (event.type === "message-completed" && event.id) {
            const turn = spokenTurns.current.get(event.id);
            if (turn) {
              spokenTurns.current.delete(event.id);
              const text = (event.text ?? turn.text).trim();
              if (text) recordSpokenTurns([{ role: turn.role, text }]);
            }
            dispatch({
              type: "MESSAGE_COMPLETED",
              id: event.id,
              text: event.text,
            });
          }
        },
        session.mode,
        session.clientSecret,
      );
      await realtime.current.connect();
    } catch (caught) {
      noteSignedOut(caught);
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

  /**
   * Keeps one thread of memory. A spoken exchange happens entirely inside the
   * browser's realtime session, so the server would otherwise never learn what
   * was said, and a typed follow-up would answer as if the talk never happened.
   */
  const recordSpokenTurns = useCallback(
    (turns: Array<{ role: "user" | "assistant"; text: string }>) => {
      const id = sourceIdRef.current;
      if (!id || turns.length === 0) return;
      void requestJson("/api/conversation/turns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: id, turns }),
        retries: 1,
      }).catch(() => {
        /* A lost turn costs context, never the conversation in front of you. */
      });
    },
    [],
  );

  /**
   * Finds a video from what was said. Nobody is going to read an address out
   * loud, so "YouTube, Miles Davis Kind of Blue" has to end with that video
   * open — the top captioned result is taken, and the alternatives stay on
   * screen because the first answer is not always the intended one.
   */
  async function findVideo(query: string) {
    const controller = new AbortController();
    setSearchingVideos(true);
    setVideoChoices([]);
    setError("");
    try {
      const found = await withDeadline(
        controller,
        SEARCH_DEADLINE_MS,
        t("The video search timed out. Try again, or paste a link."),
        () =>
          requestJson<{ results: VideoResult[] }>("/api/videos/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query }),
            signal: controller.signal,
          }),
      );
      if (!mounted.current) return;
      const [best, ...rest] = found.results;
      if (!best) {
        setVideoChoices([]);
        setVoiceActionNotice(
          t(
            "Nothing captioned found for \u201c{query}\u201d. Try other words.",
            {
              query,
            },
          ),
        );
        return;
      }
      setTab("youtube");
      setUrl(best.url);
      setVideoChoices(rest);
      setVoiceActionNotice(
        t("Opening \u201c{title}\u201d.", { title: best.title }),
      );
      setSourcePickerOpen(true);
      await startIngest({ url: best.url });
    } catch (caught) {
      noteSignedOut(caught);
      if (!mounted.current) return;
      setError(
        t(readable(caught, "The video search failed. Paste a link instead.")),
      );
    } finally {
      if (mounted.current) setSearchingVideos(false);
    }
  }

  /**
   * A session can end while someone is mid-question. Putting the sign-in back
   * on screen is the only honest response; leaving the workspace up would let
   * them keep typing into something that will refuse every request.
   */
  function noteSignedOut(caught: unknown): void {
    if (caught instanceof ApiError && caught.code === "UNAUTHENTICATED")
      setAccount(null);
  }

  function stopAnswer() {
    answerRequest.current?.abort();
    answerRequest.current = null;
    // A question asked over the channel has no request to abort: the answer is
    // closed here and its remaining fragments are dropped as they arrive.
    setStreamingId((id) => {
      if (id) {
        stoppedAnswers.current.add(id);
        dispatch({ type: "MESSAGE_COMPLETED", id });
        setPendingAnswers((count) => Math.max(0, count - 1));
      }
      return null;
    });
  }

  async function askQuestion(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    if (!source) {
      setError(t("Add a PDF or YouTube video first, then ask your question."));
      setQuestion(trimmed);
      return;
    }
    setError("");
    dispatch({ type: "CLEAR_ERROR" });
    followMessages.current = true;

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
    answerRequest.current?.abort();
    answerRequest.current = controller;
    textRequests.current.add(controller);
    setLastAsked(trimmed);
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

    const answerId = crypto.randomUUID();

    // The open channel is the fast path: the question is a short frame on a
    // connection that already exists, and the answer streams back on it.
    // Everything below is for a reader whose channel is closed or unconfigured.
    if (chat.current?.ask(answerId, trimmed)) {
      textRequests.current.delete(controller);
      answerRequest.current = null;
      return;
    }

    let opened = false;
    const openAnswer = () => {
      if (opened) return;
      opened = true;
      setStreamingId(answerId);
      dispatch({
        type: "MESSAGE_STARTED",
        message: {
          id: answerId,
          role: "assistant",
          text: "",
          status: "partial",
        },
      });
    };

    try {
      const reply = await withDeadline(
        controller,
        STREAM_DEADLINE_MS,
        t(
          "The answer timed out. Check your connection and retry your question.",
        ),
        () =>
          withSession(
            async (body) => {
              try {
                return await streamAnswer(
                  "/api/text-chat/stream",
                  body,
                  (delta) => {
                    if (!current()) return;
                    openAnswer();
                    dispatch({
                      type: "MESSAGE_DELTA",
                      id: answerId,
                      text: delta,
                    });
                  },
                  controller.signal,
                );
              } catch (caught) {
                // A runtime or proxy that cannot stream is not a failed answer.
                if (
                  caught instanceof ApiError &&
                  caught.code === "STREAM_UNSUPPORTED"
                )
                  return requestJson<{ answer: string; sourceId: string }>(
                    "/api/text-chat",
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(body),
                      signal: controller.signal,
                    },
                  );
                throw caught;
              }
            },
            { question: trimmed },
          ),
      );
      if (!current()) return;
      sourceIdRef.current = reply.sourceId ?? sourceIdRef.current;
      openAnswer();
      dispatch({
        type: "MESSAGE_COMPLETED",
        id: answerId,
        text: reply.answer,
      });
    } catch (caught) {
      if (!current()) return;
      // A stop is the reader's decision: keep the words that did arrive.
      if (caught instanceof DOMException && caught.name === "AbortError") {
        if (opened) dispatch({ type: "MESSAGE_COMPLETED", id: answerId });
        return;
      }
      if (opened) dispatch({ type: "MESSAGE_COMPLETED", id: answerId });
      noteSignedOut(caught);
      setError(t(readable(caught, "The answer could not be produced.")));
      setQuestion((draft) => draft || trimmed);
    } finally {
      textRequests.current.delete(controller);
      if (answerRequest.current === controller) answerRequest.current = null;
      if (current()) {
        setStreamingId((id) => (id === answerId ? null : id));
        setPendingAnswers((count) => Math.max(0, count - 1));
      }
    }
  }

  function sendText(event: FormEvent) {
    event.preventDefault();
    const asked = question;
    setQuestion("");
    void askQuestion(asked);
  }

  function regenerate() {
    if (!lastAsked) return;
    void askQuestion(lastAsked);
  }

  async function copyMessage(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      window.setTimeout(
        () => setCopiedId((current) => (current === id ? null : current)),
        1600,
      );
    } catch {
      setError(
        t("Copying is blocked in this browser. Select the text instead."),
      );
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0]);
    setError("");
  }

  function focusSourceControl(control: "youtube" | "upload") {
    setError("");
    setTab(control === "youtube" ? "youtube" : "pdf");
    setSourceFocus(control === "youtube" ? "youtube" : "pdf");
    setSourcePickerOpen(true);
  }

  function switchEntryMode(mode: EntryMode) {
    setChosenMode(mode);
    try {
      localStorage.setItem(MODE_STORAGE_KEY, mode);
    } catch {
      /* The choice still holds for this visit. */
    }
    setError("");
  }

  function openUploadPicker() {
    focusSourceControl("upload");
    setVoiceActionNotice(
      t("Upload is ready — choose a PDF in the file picker to finish."),
    );
    voicePickerInput.current?.click();
  }

  function handleVoiceAction(action: VoiceActionId, argument?: string) {
    if (action === "youtube") {
      const query = argument?.trim();
      if (query) {
        void findVideo(query);
        return;
      }
      focusSourceControl("youtube");
      setVoiceActionNotice(
        t("YouTube is ready — say the artist or title, or paste a link."),
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
          t(
            "Add a PDF or YouTube source first, then say \u201c{phrase}\u201d again.",
            {
              phrase: spokenPhrase("voice"),
            },
          ),
        );
        return;
      }
      void startVoice();
      return;
    }
    if (action === "summarize") {
      if (!source) {
        setVoiceActionNotice(
          t(
            "Add a PDF or YouTube source first, then say \u201c{phrase}\u201d again.",
            {
              phrase: spokenPhrase("summarize"),
            },
          ),
        );
        return;
      }
      // Saying "summarize this" and then being handed a filled-in text box is
      // not an answer. The point of speaking is not having to press anything.
      setQuestion("");
      setVoiceActionNotice(t("Summarizing the key ideas."));
      void askQuestion(t("Summarize the key ideas"));
      return;
    }
    if (action === "ask") {
      const pending = question.trim();
      if (!pending) {
        setVoiceActionNotice(
          t("Say your question first, then say \u201csend it\u201d."),
        );
        return;
      }
      setQuestion("");
      void askQuestion(pending);
      return;
    }
    if (action === "stop") {
      if (streamingId) stopAnswer();
      else if (sessionLive) stopVoice();
      setVoiceActionNotice(t("Stopped."));
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
    if (action === "open") {
      setFileBrowserOpen(true);
      setVoiceActionNotice("Opening file browser");
      return;
    }
    if (action === "select") {
      setVoiceActionNotice("Select a file with gaze or gesture");
      return;
    }
    if (action === "search") {
      setVoiceActionNotice("Search coming soon");
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

  const visualActivity =
    busy || pendingAnswers > 0 || senseActivity.connecting
      ? "thinking"
      : sessionLive && activity === "speaking"
        ? "speaking"
        : senseActivity.listening || sessionLive
          ? "listening"
          : senseActivity.motion
            ? "motion"
            : "idle";

  return (
    <div className={styles.experience}>
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
        {t("Skip to workspace")}
      </a>

      <main
        className={styles.workspace}
        id="workspace"
        tabIndex={-1}
        aria-label="Ursly"
        data-entry-mode={entryMode}
        data-activity={visualActivity}
        data-mood={mood}
        data-sensing={
          senseActivity.listening || senseActivity.motion || sessionLive
        }
        onPointerMove={(event) => {
          if (event.pointerType !== "mouse") return;
          const bounds = event.currentTarget.getBoundingClientRect();
          event.currentTarget.style.setProperty(
            "--sense-offset-x",
            `${((event.clientX - bounds.left) / bounds.width - 0.5) * 12}px`,
          );
          event.currentTarget.style.setProperty(
            "--sense-offset-y",
            `${((event.clientY - bounds.top) / bounds.height - 0.5) * 12}px`,
          );
        }}
        onPointerLeave={(event) => {
          event.currentTarget.style.setProperty("--sense-offset-x", "0px");
          event.currentTarget.style.setProperty("--sense-offset-y", "0px");
        }}
      >
        <div className={styles.ambient} aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className={styles.particles} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
        </div>
        {videoId && (
          <YouTubePlayer videoId={videoId} className={styles.video} />
        )}

        {source && (
          <div className={styles.statusBar}>
            <button
              type="button"
              className={styles.sourceChip}
              onClick={() => setSourcePickerOpen(true)}
              aria-label={t("Change source")}
              title={source.sourceName}
            >
              <Icon name={source.kind === "youtube" ? "video" : "document"} />
              <span>{source.sourceName}</span>
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        )}

        {!online && (
          <p className={styles.notice} role="alert">
            {t(
              "You are offline. Ursly will reconnect when your network returns.",
            )}
          </p>
        )}
        {voiceActionNotice && (
          <div className={styles.notice} role="status" aria-live="polite">
            {voiceActionNotice}
            <button
              type="button"
              aria-label={t("Dismiss notification")}
              onClick={() => setVoiceActionNotice("")}
            >
              <Icon name="close" />
            </button>
          </div>
        )}

        <SignInGate
          open={account === null}
          onSignedIn={(email) => setAccount(email)}
          storyHref={`/${language}`}
        />

        <div className={styles.stage}>
          {state.messages.length === 0 && (
            <div className={styles.origin}>
              <div
                className={styles.livingLogoWrap}
                data-activity={visualActivity}
              >
                <LivingLogo
                  activity={visualActivity}
                  mood={mood}
                  conversationDepth={state.messages.length}
                  onClick={() => setSourcePickerOpen(true)}
                />
              </div>
              <div className={styles.wordmark}>
                {"ursly".split("").map((letter, i) => (
                  <span
                    key={i}
                    className={styles.wordmarkLetter}
                    style={{ animationDelay: `${0.3 + i * 0.08}s` }}
                  >
                    {letter}
                  </span>
                ))}
                <span
                  className={styles.wordmarkDot}
                  style={{ animationDelay: "0.7s" }}
                >
                  .
                </span>
              </div>
              {source && (
                <div className={styles.suggestions}>
                  {suggestions.map((prompt) => (
                    <button
                      type="button"
                      key={prompt}
                      onClick={() => {
                        setQuestion("");
                        void askQuestion(prompt);
                      }}
                    >
                      {prompt}
                      <Icon name="arrow" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div
            className={styles.conversation}
            data-empty={state.messages.length === 0}
          >
            <ConversationStream
              messages={state.messages}
              streamingId={streamingId}
              assistantName={assistantName}
              onFeedback={(messageId) => {
                if (sourceIdRef.current) setFeedbackMessageId(messageId);
              }}
            />
            {feedbackMessageId && sourceIdRef.current && account !== null && (
              <InteractionFeedback
                key={feedbackMessageId}
                sourceId={sourceIdRef.current}
                onDismiss={() => setFeedbackMessageId(null)}
              />
            )}
          </div>
        </div>

        <div className={styles.feedback} aria-live="polite">
          {(busy || searchingVideos) && (
            <p role="status">
              <span className="spinner" aria-hidden="true" />
              {searchingVideos
                ? t("Finding a video…")
                : t("Reading your source…")}
            </p>
          )}
          {pendingAnswers > 0 && !streamingId && (
            <p role="status">
              <span className="spinner" aria-hidden="true" />
              {t("Finding an answer in your source…")}
            </p>
          )}
          {!settingsOpen && !sourcePickerOpen && (error || state.error) && (
            <p className="error" role="alert">
              {error || state.error}
            </p>
          )}
          {!settingsOpen && sessionLive && (
            <p role="status">
              {state.status === "connected"
                ? activityText[activity]
                : statusText[state.status]}
            </p>
          )}
          {source && channelStatus === "reconnecting" && (
            <p role="status">{t("Reopening the live channel…")}</p>
          )}
          {providerMode === "mock" && (
            <p className={styles.demoNote} role="status">
              {t("Demo simulation: answers are simulated.")}
            </p>
          )}
        </div>
        <FeedbackOverlay />

        <div className={styles.interaction}>
          {source && (
            <form className={styles.composer} onSubmit={sendText}>
              <textarea
                ref={questionInput}
                className="field"
                aria-label={t("Ask a question")}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={t("Ask a question")}
                rows={1}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    if (question.trim()) sendText(event);
                  }
                }}
              />
              {streamingId ? (
                <button
                  type="button"
                  className="primary danger"
                  onClick={stopAnswer}
                >
                  {t("Stop")}
                </button>
              ) : (
                <button
                  type="submit"
                  className="primary"
                  disabled={!question.trim()}
                  aria-label={t("Send")}
                >
                  <Icon name="arrow" />
                </button>
              )}
            </form>
          )}
          <div
            className={styles.dock}
            role="group"
            aria-label={t("Controls")}
          >
            <button
              type="button"
              className={styles.menuButton}
              aria-label={t("Workspace settings")}
              title={t("Workspace settings")}
              aria-haspopup="dialog"
              aria-expanded={settingsOpen}
              onClick={() => setSettingsOpen(true)}
            >
              menu
            </button>
          </div>
        </div>

        {sourcePickerOpen && (
          <WorkspaceDialog
            title={t("Add a source")}
            closeLabel={t("Close source picker")}
            initialFocusId={
              sourceFocus === "youtube"
                ? "youtube-url"
                : sourceFocus === "pdf"
                  ? "source-pdf-file"
                  : undefined
            }
            onClose={() => {
              setSourcePickerOpen(false);
              setSourceFocus(null);
            }}
          >
            <form className="source-grid" onSubmit={ingest}>
              <div className="tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  className={`tab${tab === "pdf" ? " active" : ""}`}
                  aria-selected={tab === "pdf"}
                  onClick={() => setTab("pdf")}
                >
                  <Icon name="document" /> {t("PDF file")}
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`tab${tab === "youtube" ? " active" : ""}`}
                  aria-selected={tab === "youtube"}
                  onClick={() => setTab("youtube")}
                >
                  <Icon name="video" /> {t("YouTube video")}
                </button>
              </div>
              {tab === "pdf" ? (
                <label
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setDragging(false);
                    const dropped = event.dataTransfer.files[0];
                    if (dropped) {
                      setFile(dropped);
                      setError("");
                    }
                  }}
                  className="dropzone"
                  data-dragging={dragging || undefined}
                  data-filled={Boolean(file) || undefined}
                >
                  <span className="upload-icon" aria-hidden="true">
                    <Icon name="download" />
                  </span>
                  <strong>
                    {file ? file.name : t("Drop a PDF here or click to browse")}
                  </strong>
                  <input
                    ref={fileInput}
                    id="source-pdf-file"
                    type="file"
                    accept="application/pdf,.pdf"
                    aria-label={t("PDF file")}
                    onChange={onFile}
                  />
                </label>
              ) : (
                <input
                  id="youtube-url"
                  className="field"
                  type="url"
                  placeholder="https://youtu.be/…"
                  aria-label={t("YouTube URL")}
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                />
              )}
              {uploadProgress !== undefined && (
                <progress
                  aria-label={t("Uploading PDF")}
                  value={uploadProgress}
                  max={1}
                />
              )}
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              <div className="actions">
                <button
                  className="primary"
                  type="submit"
                  disabled={!canIngest || busy}
                >
                  {busy ? (
                    <>
                      <span className="spinner" aria-hidden="true" />{" "}
                      {t("Extracting")}
                    </>
                  ) : (
                    t("Continue")
                  )}
                </button>
              </div>
            </form>
            {videoChoices.length > 0 && (
              <details className={styles.alternatives}>
                <summary>{t("Other videos")}</summary>
                {videoChoices.map((video) => (
                  <button
                    type="button"
                    key={video.videoId}
                    onClick={() => {
                      setUrl(video.url);
                      void startIngest({ url: video.url });
                    }}
                  >
                    {video.title}
                  </button>
                ))}
              </details>
            )}
          </WorkspaceDialog>
        )}
        <WorkspaceDialog
          open={settingsOpen}
          title={t("Settings")}
          closeLabel={t("Close settings")}
          onClose={() => setSettingsOpen(false)}
        >
          <div className={styles.settingsSection}>
            <h3 className={styles.sectionLabel}>
              <Icon name="brain" />
              {t("Identity")}
            </h3>
            <AssistantName
              key={assistantName}
              value={assistantName}
              onChange={setAssistantName}
            />
          </div>

          <div className={styles.settingsSection}>
            <h3 className={styles.sectionLabel}>
              <Icon name="eye" />
              {t("Preferences")}
            </h3>
            <AppPreferences />
          </div>

          {source && (
            <div className={styles.settingsSection}>
              <h3 className={styles.sectionLabel}>
                <Icon name="voice" />
                {t("Voice & Audio")}
              </h3>
              <div
                className={styles.audioSettings}
                aria-label={t("Conversation audio")}
              >
                <button
                  type="button"
                  className={styles.liveVoice}
                  data-live={sessionLive ? "true" : undefined}
                  disabled={!sessionLive && !micSupported}
                  onClick={() =>
                    sessionLive ? stopVoice() : void startVoice()
                  }
                >
                  <Icon name="voice" />
                  {sessionLive ? t("Stop Voice Chat") : t("Start Voice Chat")}
                </button>
                {sessionLive && state.status === "connected" && (
                  <button
                    type="button"
                    className={styles.liveVoice}
                    onClick={toggleMute}
                    aria-pressed={state.muted}
                  >
                    {state.muted ? t("Unmute") : t("Mute")}
                  </button>
                )}
              </div>
              {settingsOpen && (error || state.error || sessionLive) && (
                <div className={styles.feedback} aria-live="polite">
                  {(error || state.error) && (
                    <p className="error" role="alert">
                      {error || state.error}
                    </p>
                  )}
                  {sessionLive && (
                    <p role="status">
                      {state.status === "connected"
                        ? activityText[activity]
                        : statusText[state.status]}
                    </p>
                  )}
                </div>
              )}
              <VoiceLending embedded active={settingsOpen} />
            </div>
          )}

          <div className={styles.settingsSection}>
            <h3 className={styles.sectionLabel}>
              <Icon name="external" />
              {t("Devices")}
            </h3>
            <DeviceConnect />
          </div>

          <div className={styles.settingsSection}>
            <h3 className={styles.sectionLabel}>
              <Icon name="play" />
              {t("Session")}
            </h3>
            <button
              type="button"
              className={styles.replayIntro}
              onClick={() => {
                setSettingsOpen(false);
                setOnboardingStep(0);
                setReplayOnboarding(true);
              }}
            >
              <Icon name="play" />
              {t("Replay intro")}
            </button>
            {context?.truncated && (
              <p className="hint">
                {t("Only part of this source fits in the conversation context.")}
              </p>
            )}
            <a className={styles.backToStory} href={`/${language}`}>
              {t("Back to the story")}
            </a>
          </div>

          {account && (
            <div className={styles.account}>
              <div className={styles.accountAvatar}>
                {account.charAt(0).toUpperCase()}
              </div>
              <div className={styles.accountInfo}>
                <div className={styles.accountEmail}>{account}</div>
                <div className={styles.accountLabel}>{t("Signed in")}</div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  setAccount(null);
                  void signOut().catch(() => {});
                }}
              >
                {t("Sign out")}
              </button>
            </div>
          )}
        </WorkspaceDialog>
        {onboardingToasts && (
          <div className={styles.onboardingToasts} aria-live="polite">
            {onboardingToasts.map((item, i) => (
              <div
                key={i}
                className={`${styles.onboardingToast}${item.fading ? ` ${styles.fadeOut}` : ""}`}
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                {item.msg}
              </div>
            ))}
          </div>
        )}
      </main>
      <QuickToggleBar
        voiceActive={sessionLive}
        cameraActive={cameraActive}
        onToggleVoice={() => {
          sessionLive ? stopVoice() : void startVoice();
        }}
        onToggleCamera={() => setCameraActive((prev) => !prev)}
      />
      <ImmersiveFileBrowser
        open={fileBrowserOpen}
        fs={fileSystem}
        rootId="root"
        onClose={() => setFileBrowserOpen(false)}
        onFileSelect={(node: FileNode) => {
          if (node.kind === "file" && node.sourceId)
            setVoiceActionNotice(`Selected: ${node.name}`);
          setFileBrowserOpen(false);
        }}
        gaze={gazePosition}
      />
      <LogoOnboarding
        replay={replayOnboarding}
        onReplayDone={() => setReplayOnboarding(false)}
      />
    </div>
  );
}
