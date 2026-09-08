"use client";

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
} from "@/src/domain/conversation";
import type { IngestedSource } from "@/src/domain/ingestion";
import { RealtimeClient } from "@/src/lib/realtimeClient";

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
  const [providerMode, setProviderMode] = useState<string>("");
  const [state, dispatch] = useReducer(
    conversationReducer,
    initialConversationState,
  );
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
    setBusy(true);
    setError("");
    setSource(undefined);
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
          }).then((r) => r.json());
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
      if (current())
        setError(
          caught instanceof Error ? caught.message : "Text chat failed.",
        );
    } finally {
      textRequests.current.delete(controller);
    }
  }

  function onFile(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.target.files?.[0]);
    setError("");
  }

  return (
    <main className="shell">
      <div className="container">
        <div className="eyebrow">Talk to a source</div>
        <h1>Ask it out loud.</h1>
        <p className="lede">
          Upload a document or bring a captioned YouTube video. Then ask natural
          questions with your voice or in text.
        </p>

        <section className="card" aria-labelledby="source-heading">
          <div className="status-row">
            <h2 id="source-heading">1. Choose a source</h2>
            <span className="status">{statusText[state.status]}</span>
          </div>
          <div className="tabs" role="tablist" aria-label="Source type">
            <button
              className={`tab ${tab === "pdf" ? "active" : ""}`}
              onClick={() => setTab("pdf")}
              role="tab"
              aria-selected={tab === "pdf"}
            >
              PDF document
            </button>
            <button
              className={`tab ${tab === "youtube" ? "active" : ""}`}
              onClick={() => setTab("youtube")}
              role="tab"
              aria-selected={tab === "youtube"}
            >
              YouTube video
            </button>
          </div>
          <form onSubmit={ingest} className="source-grid">
            {tab === "pdf" ? (
              <div className="dropzone full">
                <strong>Pick a PDF up to 25 MB</strong>
                <div className="hint">
                  Text is extracted securely on the server.
                </div>
                <input
                  aria-label="PDF file"
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={onFile}
                />
              </div>
            ) : (
              <div className="field full">
                <label htmlFor="youtube-url">YouTube URL</label>
                <input
                  id="youtube-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  inputMode="url"
                />
              </div>
            )}
            <div className="actions full">
              <button
                className="primary"
                disabled={!canIngest || busy}
                type="submit"
              >
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
            <details className="preview" open>
              <summary>
                Extracted text · {source.characters.toLocaleString()} characters
              </summary>
              <div className="preview-text">{source.text}</div>
            </details>
          )}
        </section>

        <section className="card" aria-labelledby="conversation-heading">
          <div className="status-row">
            <h2 id="conversation-heading">2. Have a conversation</h2>
            <span className="hint">
              {source ? source.sourceName : "Ingest a source first"}
            </span>
          </div>
          <div className="actions">
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
              Start Voice Chat
            </button>
            <button
              className="secondary"
              disabled={state.status !== "connected"}
              onClick={toggleMute}
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
              Demo simulation: microphone audio is not sent to AI. Use live mode
              for a real voice conversation.
            </p>
          )}
          <div className="chat" aria-live="polite">
            {state.messages.length === 0 ? (
              <p className="hint">Your conversation will appear here.</p>
            ) : (
              state.messages.map((message) => (
                <div key={message.id} className={`message ${message.role}`}>
                  {message.text || "…"}
                </div>
              ))
            )}
          </div>
          <form className="composer" onSubmit={sendText}>
            <input
              aria-label="Ask a question"
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
              Send
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
