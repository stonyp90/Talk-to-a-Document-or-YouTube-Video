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
import { SiteFooter } from "./SiteFooter";
import { TopNav } from "./TopNav";
import { Markdown } from "./Markdown";
import { VoiceActions, type VoiceActionId } from "./VoiceActions";
import { MotionActions } from "./MotionActions";
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
    return saved === "text" || saved === "motion" ? saved : "voice";
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
    defaultPhrases(language)[action][0] ?? "";
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
  const [videoQuery, setVideoQuery] = useState("");
  const [videoChoices, setVideoChoices] = useState<VideoResult[]>([]);
  const [searchingVideos, setSearchingVideos] = useState(false);
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
    if (!url || !source || entryMode !== "text") return;
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
  }, [source, entryMode]);

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
      sourceIdRef.current = envelope.sourceId;
      setContext(envelope.context);
      dispatch({ type: "CLEAR_ERROR" });
    } catch (caught) {
      noteSignedOut(caught);
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
          "Voice session setup timed out. Check your connection and retry Start Voice Chat.",
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
    setVideoQuery(query);
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
          t("Nothing captioned found for “{query}”. Try other words.", {
            query,
          }),
        );
        return;
      }
      setTab("youtube");
      setUrl(best.url);
      setVideoChoices(rest);
      setVoiceActionNotice(t("Opening “{title}”.", { title: best.title }));
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
    if (!source || !trimmed) return;
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
        ? t(
            "Voice to action: the way in. Say a command, or use the controls as usual.",
          )
        : mode === "motion"
          ? t(
              "Motion to action: start the camera, then swipe to choose a question and wave to ask it.",
            )
          : t(
              "Keyboard to action: the old way in, still complete. Everything works by typing and clicking.",
            ),
    );
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
        setVoiceActionNotice(t("Say your question first, then say “send it”."));
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

  /**
   * One panel for the whole workspace. It serves both halves of the task —
   * before a source it opens one, after a source it carries the question — and
   * it sits above both cards so that finding a source never unmounts it and
   * takes the microphone away in the middle of a sentence. Hiding it once a
   * source arrived was the reason speaking stopped working exactly when it
   * started to matter.
   */
  /**
   * Driving with a hand. It sits where the spoken panel sits, uses the same
   * action bus, and asks whichever question the reader has landed on, so a
   * conversation can be held without a word or a keystroke.
   */
  const motionActions =
    entryMode === "motion" ? (
      <MotionActions
        prompts={suggestions}
        canAsk={Boolean(source)}
        onAsk={(spoken) => {
          setQuestion("");
          void askQuestion(spoken);
        }}
        onAction={handleVoiceAction}
      />
    ) : null;

  const voiceActions =
    entryMode === "voice" ? (
      <VoiceActions
        onAction={handleVoiceAction}
        onDictate={(spoken) => {
          setQuestion("");
          void askQuestion(spoken);
        }}
        onDraft={setQuestion}
        canStartVoice={Boolean(source)}
        // Reading a source does not use the microphone, so listening continues
        // through it; only a live voice session has to own the device alone.
        voiceBusy={state.status === "connected"}
        compact={Boolean(source)}
      />
    ) : null;

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
        {t("Skip to workspace")}
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
                  : entryMode === "motion"
                    ? t(
                        "Add a PDF or a captioned YouTube video, then drive it with your hand. Swipe to choose a question, wave to ask it, and type whenever you prefer.",
                      )
                    : t(
                        "Add a PDF or a captioned YouTube video, then ask about it by typing. This is the old way in, and it still does everything. Voice is one tap away.",
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

          {/*
            The workspace spends money on every source and every answer, so it
            opens for a signed-in reader only. The gate is the same one the API
            applies; standing it over the workspace as a modal means a reader
            sees what they are signing in for, and cannot reach any of it —
            not by tabbing, not by Escape — before they have.
          */}
          <SignInGate
            open={account === null}
            onSignedIn={(email) => setAccount(email)}
            storyHref={`/${language}`}
          />

          {account !== null && voiceActions}
          {account !== null && motionActions}

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
                    : t("We’ll read it for you. Then you can ask about it.")}
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
                        <span className="upload-icon">
                          <Icon name="video" />
                        </span>
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
                            "Say the artist or the title, or paste a link. Watch pages, Shorts, share links and embeds all work.",
                          )}
                        </p>
                        {searchingVideos && (
                          <p className="hint" role="status">
                            <span className="spinner" aria-hidden="true" />{" "}
                            {t("Searching for “{query}”…", {
                              query: videoQuery,
                            })}
                          </p>
                        )}
                        {videoChoices.length > 0 && (
                          <div className="video-choices">
                            <span className="video-choices-label">
                              {t("Not the one? Also found")}
                            </span>
                            {videoChoices.map((choice) => (
                              <button
                                type="button"
                                className="video-choice"
                                key={choice.videoId}
                                disabled={busy}
                                onClick={() => {
                                  setUrl(choice.url);
                                  setVideoChoices((current) =>
                                    current.filter(
                                      (item) => item.videoId !== choice.videoId,
                                    ),
                                  );
                                  void startIngest({ url: choice.url });
                                }}
                              >
                                <strong>{choice.title}</strong>
                                {choice.channel && (
                                  <span>{choice.channel}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
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
                Talking to Ursly teaches it nothing about how you sound, and
                saying otherwise here would make the consent below meaningless.
                So the badge says which voice is answering, and points at the
                one control that changes it.
              */}
              {sessionLive && state.status === "connected" && (
                <a className="voice-learning" href="#voice-lending">
                  <span className="voice-learning-dot" aria-hidden="true" />
                  <span>
                    <strong>{t("Answering in Ursly’s preset voice")}</strong>
                    <small>
                      {t(
                        "Talking here teaches Ursly nothing about your voice. Lending it yours is a separate, deliberate step.",
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
                    <Icon name="voice" /> {t("Start Voice Chat")}
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

              {entryMode === "voice" && <VoiceLending />}

              <div className="chat-anchor">
                <div
                  className="chat"
                  ref={chatLog}
                  tabIndex={0}
                  onScroll={(event) => {
                    const log = event.currentTarget;
                    const following =
                      log.scrollHeight - log.scrollTop - log.clientHeight <
                      FOLLOW_THRESHOLD_PX;
                    followMessages.current = following;
                    setAtLatest(following);
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
                          name={
                            entryMode === "text"
                              ? "document"
                              : entryMode === "motion"
                                ? "motion"
                                : "voice"
                          }
                        />
                      </div>
                      <h3>
                        {source
                          ? t("What are you curious about?")
                          : entryMode === "voice"
                            ? t("Your voice is the shortcut.")
                            : entryMode === "motion"
                              ? t("Your hand is the shortcut.")
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
                            : entryMode === "motion"
                              ? t(
                                  "Add a source, then start the camera and swipe to choose a question. Typing always works too.",
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
                    state.messages.map((message, index) => {
                      const streaming = message.id === streamingId;
                      const answered =
                        message.role === "assistant" && Boolean(message.text);
                      const last = index === state.messages.length - 1;
                      return (
                        <div
                          key={message.id}
                          className={`message ${message.role}`}
                          data-streaming={streaming || undefined}
                        >
                          <span className="message-author">
                            {message.role === "user"
                              ? t("You")
                              : message.role === "assistant"
                                ? "Ursly"
                                : t("Session update")}
                          </span>
                          {message.role === "assistant" && message.text ? (
                            <span className="message-text rendered">
                              <Markdown text={message.text} />
                            </span>
                          ) : (
                            <span className="message-text">
                              {message.text || (streaming ? "" : "…")}
                            </span>
                          )}
                          {answered && !streaming && (
                            <div className="message-actions">
                              <button
                                type="button"
                                className="message-action"
                                onClick={() =>
                                  void copyMessage(message.id, message.text)
                                }
                              >
                                {copiedId === message.id
                                  ? t("Copied")
                                  : t("Copy")}
                              </button>
                              {last && lastAsked && !sessionLive && (
                                <button
                                  type="button"
                                  className="message-action"
                                  disabled={pendingAnswers > 0}
                                  onClick={regenerate}
                                >
                                  {t("Try again")}
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
                {!atLatest && state.messages.length > 0 && (
                  <button
                    type="button"
                    className="chat-jump"
                    onClick={() => {
                      followMessages.current = true;
                      setAtLatest(true);
                      if (chatLog.current)
                        chatLog.current.scrollTop =
                          chatLog.current.scrollHeight;
                    }}
                  >
                    {t("Jump to latest")} <span aria-hidden="true">↓</span>
                  </button>
                )}
              </div>

              {source && entryMode === "text" && channelStatus !== "idle" && (
                <p className={`channel-state ${channelStatus}`} role="status">
                  <span className="channel-dot" aria-hidden="true" />
                  {channelStatus === "live"
                    ? t("Live channel open — answers arrive as they are written")
                    : channelStatus === "connecting"
                      ? t("Opening the live channel…")
                      : channelStatus === "reconnecting"
                        ? t("Reopening the live channel…")
                        : t("The live channel is closed; answers still arrive.")}
                </p>
              )}

              {pendingAnswers > 0 && !streamingId && (
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
                <textarea
                  id="question"
                  aria-label={t("Ask a question")}
                  ref={questionInput}
                  rows={1}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={(event) => {
                    // Enter sends, because this is a conversation. A newline is
                    // still one modifier away for anyone pasting a long prompt.
                    if (event.key !== "Enter" || event.shiftKey) return;
                    if (event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }}
                  placeholder={
                    source
                      ? t("Ask a question…")
                      : t("Type what you want to understand…")
                  }
                  disabled={busy}
                />
                <div className="composer-buttons">
                  {streamingId ? (
                    <button
                      className="secondary"
                      type="button"
                      onClick={stopAnswer}
                    >
                      {t("Stop")}
                    </button>
                  ) : (
                    <button
                      className="secondary"
                      type="submit"
                      disabled={
                        !source || !question.trim() || pendingAnswers > 0
                      }
                    >
                      {t("Send")} <Icon name="arrow" />
                    </button>
                  )}
                </div>
              </form>
              <p className="hint composer-hint">
                {t("Enter sends · Shift + Enter starts a new line")}
              </p>
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

          {/*
            Who is signed in, and the way back out. A reader who cannot sign out
            cannot hand the machine to anyone else.
          */}
          {account && (
            <p className="footer-account">
              {t("Signed in as {email}", { email: account })}
              <button
                type="button"
                className="footer-signout"
                onClick={() => {
                  setAccount(null);
                  void signOut().catch(() => {
                    // The cookie is gone either way; a failed call must not
                    // leave the reader looking signed in when they are not.
                  });
                }}
              >
                {t("Sign out")}
              </button>
            </p>
          )}
          <SiteFooter page="app" />
        </div>
      </main>
    </>
  );
}
