"use client";

import { Applications } from "./components/Applications";

import {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  conversationReducer,
  initialConversationState,
} from "@/packages/core/src/domain/conversation";
import type { IngestedSource } from "@/packages/core/src/domain/ingestion";
import { RealtimeClient } from "@/apps/web/src/lib/realtimeClient";

function Icon({ name }: { name: "document" | "video" | "arrow" | "voice" }) {
  const paths = {
    document:
      "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8M14 2v6h6M8 13h8M8 17h5",
    video:
      "M8 7l9 5-9 5V7Z M4 3h16a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z",
    arrow: "M5 12h14M13 6l6 6-6 6",
    voice: "M4 10v4M8 6v12M12 3v18M16 6v12M20 10v4",
  };
  return (
    <svg
      className={`icon icon-${name}`}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {name === "voice" ? (
        ["M4 10v4", "M8 6v12", "M12 3v18", "M16 6v12", "M20 10v4"].map(
          (path) => <path key={path} d={path} />,
        )
      ) : (
        <path d={paths[name]} />
      )}
    </svg>
  );
}

type SourceTab = "pdf" | "youtube";

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

const statusText: Record<string, string> = {
  idle: "Ready",
  preparing: "Preparing",
  connecting: "Connecting",
  connected: "Connected",
  reconnecting: "Reconnecting",
  ended: "Ended",
  error: "Needs attention",
};

export default function HomePage() {
  const [tab, setTab] = useState<SourceTab>("pdf");
  const [file, setFile] = useState<File | undefined>();
  const [url, setUrl] = useState("");
  const [source, setSource] = useState<IngestedSource>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [pendingAnswers, setPendingAnswers] = useState(0);
  const questionInput = useRef<HTMLInputElement>(null);
  const [providerMode, setProviderMode] = useState<string>("");
  const [state, dispatch] = useReducer(
    conversationReducer,
    initialConversationState,
  );
  const chatLog = useRef<HTMLDivElement>(null);
  const followMessages = useRef(true);
  useEffect(() => {
    if (followMessages.current && chatLog.current) {
      chatLog.current.scrollTop = chatLog.current.scrollHeight;
    }
  }, [state.messages]);
  const realtime = useRef<RealtimeClient | null>(null);
  const mounted = useRef(true);
  const sourceVersion = useRef(0);
  const voiceVersion = useRef(0);
  const sessionRequest = useRef<AbortController | null>(null);
  const textRequests = useRef(new Set<AbortController>());
  const uploadRequest = useRef<AbortController | null>(null);
  const voiceActive = useRef(false);
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

  function invalidateVoice() {
    voiceVersion.current++;
    sessionRequest.current?.abort();
    sessionRequest.current = null;
    voiceActive.current = false;
    realtime.current?.stop();
    realtime.current = null;
  }

  const canIngest = useMemo(
    () => (tab === "pdf" ? Boolean(file) : Boolean(url.trim())),
    [file, tab, url],
  );

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
    setError("");
    setSource(undefined);
    followMessages.current = true;
    setProviderMode("");
    setQuestion("");
    dispatch({ type: "RESET" });
    const form = new FormData();
    if (tab === "pdf" && file) form.append("file", file);
    if (tab === "youtube") form.append("url", url);
    try {
      const ingested = await withDeadline(
        controller,
        60000,
        "Source upload or extraction timed out. Check your connection and retry.",
        async () => {
          let response: Response;
          const health = await fetch("/api/health", {
            signal: controller.signal,
          }).then((r) => {
            if (!r.ok)
              throw new Error("The server is unavailable. Please retry.");
            return r.json();
          });
          if (current()) setProviderMode(health.mode ?? "");
          if (tab === "pdf" && file && health.directUpload) {
            const prepared = await fetch("/api/uploads", {
              signal: controller.signal,
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: file.name,
                type: file.type,
                size: file.size,
              }),
            });
            const upload = await prepared.json();
            if (!prepared.ok) throw new Error(upload.error);
            const uploadForm = new FormData();
            Object.entries(upload.fields as Record<string, string>).forEach(
              ([key, value]) => uploadForm.append(key, value),
            );
            uploadForm.append("file", file);
            const sent = await fetch(upload.url, {
              signal: controller.signal,
              method: "POST",
              body: uploadForm,
            });
            if (!sent.ok) throw new Error("Upload failed. Please retry.");
            response = await fetch("/api/uploads/extract", {
              signal: controller.signal,
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ key: upload.key, name: file.name }),
            });
          } else
            response = await fetch("/api/ingest", {
              method: "POST",
              body: form,
              signal: controller.signal,
            });
          const payload = (await response.json()) as {
            source?: IngestedSource;
            error?: string;
          };
          if (!response.ok || !payload.source)
            throw new Error(payload.error ?? "Ingestion failed.");
          return payload.source;
        },
      );
      if (!current()) return;
      setSource(ingested);
      dispatch({ type: "CLEAR_ERROR" });
    } catch (caught) {
      if (current())
        setError(
          caught instanceof Error ? caught.message : "Ingestion failed.",
        );
    } finally {
      if (uploadRequest.current === controller) uploadRequest.current = null;
      if (current()) setBusy(false);
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
        25000,
        "Voice session setup timed out. Check your connection and retry Start Voice Chat.",
        async () => {
          const response = await fetch("/api/realtime/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(source),
            signal: controller.signal,
          });
          const session = (await response.json()) as {
            mode?: "mock" | "live";
            clientSecret?: string;
            error?: string;
          };
          if (!response.ok || !session.mode)
            throw new Error(session.error ?? "Could not prepare voice chat.");
          return { ...session, mode: session.mode };
        },
      );
      if (!current()) return;
      setProviderMode(session.mode);
      dispatch({ type: "CONNECTING" });
      realtime.current = new RealtimeClient(
        source,
        (event) => {
          if (!current()) return;
          if (event.type === "connected") dispatch({ type: "CONNECTED" });
          if (event.type === "reconnecting") dispatch({ type: "RECONNECTING" });
          if (event.type === "ended") {
            voiceActive.current = false;
            dispatch({ type: "ENDED" });
          }
          if (event.type === "error") {
            voiceActive.current = false;
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
      const message =
        caught instanceof Error
          ? caught.message
          : "Microphone access is unavailable. You can use text chat instead.";
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
    if (state.status === "connected" && realtime.current) {
      try {
        realtime.current.sendText(trimmed);
      } catch (caught) {
        invalidateVoice();
        const message =
          caught instanceof Error
            ? caught.message
            : "Voice message failed. Please retry using text chat.";
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
      const answer = await withDeadline(
        controller,
        25000,
        "Text chat timed out. Check your connection and retry your question.",
        async () => {
          const response = await fetch("/api/text-chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ source, question: trimmed }),
            signal: controller.signal,
          });
          const payload = (await response.json()) as {
            answer?: string;
            error?: string;
          };
          if (!response.ok || !payload.answer)
            throw new Error(payload.error ?? "Text chat failed.");
          return payload.answer;
        },
      );
      if (!current()) return;
      dispatch({
        type: "MESSAGE_STARTED",
        message: {
          id: crypto.randomUUID(),
          role: "assistant",
          text: answer,
          status: "complete",
        },
      });
    } catch (caught) {
      if (current()) {
        setError(
          caught instanceof Error ? caught.message : "Text chat failed.",
        );
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

  return (
    <main className="shell">
      <a className="skip-link" href="#workspace">
        Skip to workspace
      </a>
      <div className="container">
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
          <span className="topbar-note">A little more understanding.</span>
          <a className="workspace-label" href="#workspace">
            Your workspace <span aria-hidden="true">↗</span>
          </a>
        </header>
        <div className="hero">
          <div className="eyebrow">
            <span className="tiny-line" /> Talk to a source
          </div>
          <h1>
            Less scrolling.
            <br />
            <span>More understanding.</span>
          </h1>
          <p className="lede">
            Upload a document or bring a captioned YouTube video. Then ask
            natural questions with your voice or in text.
          </p>
          <div className="hero-caption" aria-hidden="true">
            <div className="hero-wave">
              <Icon name="voice" />
            </div>
            <span>YOUR SOURCE. YOUR CURIOSITY.</span>
            <strong>
              A conversation away
              <br />
              from your next “aha”.
            </strong>
          </div>
          <div className="hero-links">
            <a className="primary" href="#workspace">
              Explore a source <Icon name="arrow" />
            </a>
            <a href="#how-it-works">
              How it works <span aria-hidden="true">↓</span>
            </a>
          </div>
        </div>
        <div className="workspace" id="workspace" tabIndex={-1}>
          <section
            className="card source-card"
            aria-labelledby="source-heading"
          >
            <div className="status-row">
              <h2 id="source-heading">1. Choose a source</h2>
              <span
                className="status"
                data-state={busy ? "preparing" : source ? "ready" : "idle"}
                aria-live="polite"
              >
                {busy ? "Extracting" : source ? "Source ready" : "Step 1 of 2"}
              </span>
            </div>
            <p className="section-intro">
              Bring something you want to understand.
            </p>
            <div
              className="tabs"
              data-tab={tab}
              role="tablist"
              aria-label="Source type"
            >
              <button
                className={`tab ${tab === "pdf" ? "active" : ""}`}
                id="tab-pdf"
                aria-controls="source-panel"
                tabIndex={tab === "pdf" ? 0 : -1}
                onKeyDown={(event) => {
                  if (["ArrowRight", "ArrowLeft", "End"].includes(event.key)) {
                    event.preventDefault();
                    setTab("youtube");
                    document.getElementById("tab-youtube")?.focus();
                  }
                }}
                onClick={() => {
                  setTab("pdf");
                  setError("");
                }}
                role="tab"
                aria-selected={tab === "pdf"}
              >
                <Icon name="document" /> PDF document
              </button>
              <button
                className={`tab ${tab === "youtube" ? "active" : ""}`}
                id="tab-youtube"
                aria-controls="source-panel"
                tabIndex={tab === "youtube" ? 0 : -1}
                onKeyDown={(event) => {
                  if (["ArrowRight", "ArrowLeft", "Home"].includes(event.key)) {
                    event.preventDefault();
                    setTab("pdf");
                    document.getElementById("tab-pdf")?.focus();
                  }
                }}
                onClick={() => {
                  setTab("youtube");
                  setError("");
                }}
                role="tab"
                aria-selected={tab === "youtube"}
              >
                <Icon name="video" /> YouTube video
              </button>
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
                <div className="dropzone full">
                  <span className="upload-icon">
                    <Icon name="document" />
                  </span>
                  <strong>{file ? file.name : "Pick a PDF up to 25 MB"}</strong>
                  <div className="hint">
                    {file
                      ? `${(file.size / 1024 / 1024).toFixed(1)} MB · Ready to extract`
                      : "Choose a text-based paper, report, or document."}
                  </div>
                  <input
                    aria-label="PDF file"
                    type="file"
                    accept="application/pdf,.pdf"
                    onChange={onFile}
                    disabled={busy}
                  />
                </div>
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
                    Paste a link to a captioned video. We’ll turn its words into
                    a conversation.
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
                  {busy ? "Extracting…" : "Extract source text"}
                </button>
              </div>
            </form>
            {(error || state.error) && (
              <p className="error" role="alert">
                {error || state.error}
              </p>
            )}
            {source && (
              <div className="source-ready">
                <Icon name="document" />
                <div>
                  <strong>{source.sourceName}</strong>
                  <span>Ready to explore · Ask in voice or text</span>
                </div>
                <a href="#conversation-heading" aria-label="Go to conversation">
                  ↗
                </a>
              </div>
            )}
            {source && (
              <details className="preview" open>
                <summary>
                  Extracted text · {source.characters.toLocaleString()}{" "}
                  characters
                </summary>
                <div className="preview-text">{source.text}</div>
              </details>
            )}
          </section>

          <section
            className="card conversation-card"
            aria-labelledby="conversation-heading"
          >
            <div className="status-row">
              <h2 id="conversation-heading" tabIndex={-1}>
                2. Have a conversation
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
            <div className="actions voice-controls">
              <button
                className="primary"
                disabled={
                  !source ||
                  [
                    "connected",
                    "connecting",
                    "preparing",
                    "reconnecting",
                  ].includes(state.status)
                }
                onClick={startVoice}
              >
                <Icon name="voice" /> Start Voice Chat
              </button>
              <button
                className="secondary"
                disabled={state.status !== "connected"}
                onClick={toggleMute}
                aria-pressed={state.muted}
              >
                {state.muted ? "Unmute microphone" : "Mute microphone"}
              </button>
              <button
                className="danger"
                disabled={
                  ![
                    "connected",
                    "connecting",
                    "preparing",
                    "reconnecting",
                  ].includes(state.status)
                }
                onClick={stopVoice}
              >
                Stop
              </button>
            </div>
            <p className="hint">
              If microphone access is unavailable, use the text chat below.
            </p>
            {providerMode === "mock" && (
              <p className="hint" role="status">
                Demo simulation: AI replies are simulated; microphone audio is
                not sent to AI. Use live mode for real answers and voice.
              </p>
            )}
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
                  <div className="voice-orbit" aria-hidden="true">
                    <Icon name="voice" />
                  </div>
                  <h3>
                    {source
                      ? "What are you curious about?"
                      : "Good questions start here."}
                  </h3>
                  <p className="hint">
                    {source
                      ? "Your source is ready. Ask out loud or type below."
                      : "Add a source, then explore the ideas inside it."}
                  </p>
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
                    <span className="message-text">{message.text || "…"}</span>
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
            <form className="composer" onSubmit={sendText}>
              <input
                aria-label="Ask a question"
                ref={questionInput}
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a question…"
                disabled={!source}
              />
              <button
                className="secondary"
                type="submit"
                disabled={!source || !question.trim()}
              >
                Send <Icon name="arrow" />
              </button>
            </form>
          </section>
        </div>
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
                Choose a text-based PDF up to 25 MB or a YouTube video with
                available captions.
              </p>
            </article>
            <article>
              <span className="guide-number">02</span>
              <h3>Make it a conversation</h3>
              <p>
                Extract the text, then ask a question. Start with a summary or
                explore a specific idea.
              </p>
            </article>
            <article>
              <span className="guide-number">03</span>
              <h3>Go a little deeper</h3>
              <p>
                Ask follow-up questions by voice or text. Keep the extracted
                source nearby to check important details.
              </p>
            </article>
          </div>
          <details className="help-detail">
            <summary>Having trouble with a source or your microphone?</summary>
            <p>
              Scanned PDFs need a text layer before upload. YouTube captions
              must be available, and some videos may be blocked by YouTube. For
              voice, allow microphone access in your browser. If voice cannot
              connect, you can still try text chat with an extracted source.
            </p>
          </details>
        </section>
        <Applications />
        <footer className="footer">
          <span>Ursly · Made for your next “aha”.</span>
          <a href="#applications">Applications & GitHub ↗</a>
        </footer>
      </div>
    </main>
  );
}
