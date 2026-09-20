"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ConversationMessage } from "@/packages/core/src/domain/conversation";

type Speaker = {
  id: string;
  label: string;
  color: string;
  glow: string;
};

const SPEAKER_PALETTE: Omit<Speaker, "id" | "label">[] = [
  { color: "#f47762", glow: "#f4776240" },
  { color: "#6366f1", glow: "#6366f140" },
  { color: "#10b981", glow: "#10b98140" },
  { color: "#f59e0b", glow: "#f59e0b40" },
  { color: "#ec4899", glow: "#ec489940" },
  { color: "#8b5cf6", glow: "#8b5cf640" },
];

function speakerKey(role: string, index: number): string {
  return role === "assistant" ? "assistant" : `user-${index}`;
}

function useSpeakers(messages: ConversationMessage[]) {
  const map = useRef(new Map<string, Speaker>());

  for (const msg of messages) {
    const key = speakerKey(msg.role, 0);
    if (!map.current.has(key)) {
      const palette = SPEAKER_PALETTE[map.current.size % SPEAKER_PALETTE.length];
      map.current.set(key, {
        id: key,
        label: msg.role === "assistant" ? "Sense to Action" : "You",
        ...palette,
      });
    }
  }

  return Array.from(map.current.values());
}

type StreamProps = {
  messages: ConversationMessage[];
  streamingId: string | null;
  assistantName: string;
  onFeedback?: (messageId: string, rating: "positive" | "negative") => void;
};

export function ConversationStream({
  messages,
  streamingId,
  assistantName,
  onFeedback,
}: StreamProps) {
  const speakers = useSpeakers(messages);
  const speakerMap = useRef(new Map<string, Speaker>());
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);

  for (const msg of messages) {
    const key = msg.role === "assistant" ? "assistant" : "user";
    if (!speakerMap.current.has(key)) {
      const speaker = speakers.find((s) => s.id === key);
      if (speaker) speakerMap.current.set(key, speaker);
    }
  }

  const speakerFor = useCallback(
    (msg: ConversationMessage) => {
      const key = msg.role === "assistant" ? "assistant" : "user";
      return (
        speakerMap.current.get(key) ?? {
          id: key,
          label: msg.role === "assistant" ? assistantName : "You",
          color: "#f47762",
          glow: "#f4776240",
        }
      );
    },
    [assistantName],
  );

  useEffect(() => {
    const el = scrollRef.current;
    // Not every environment that renders this implements smooth scrolling.
    el?.scrollTo?.({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages.length, messages[messages.length - 1]?.text]);

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (last) {
      const s = speakerFor(last);
      setActiveSpeaker(s.id);
      const timer = setTimeout(() => setActiveSpeaker(null), 1200);
      return () => clearTimeout(timer);
    }
  }, [messages.length, messages[messages.length - 1]?.text, speakerFor]);

  return (
    <div className="conversation-stream">
      <SpeakerTabs
        speakers={speakers}
        activeSpeaker={activeSpeaker}
        messages={messages}
      />
      <div className="stream-scroll" ref={scrollRef}>
        <div className="stream-track">
          {messages.map((msg, i) => {
            const speaker = speakerFor(msg);
            const isStreaming = msg.id === streamingId;
            const isExpanded = expandedId === msg.id;
            const isLast = i === messages.length - 1;
            return (
              <StreamMessage
                key={msg.id}
                message={msg}
                speaker={speaker}
                streaming={isStreaming}
                expanded={isExpanded}
                isLast={isLast}
                onToggle={() =>
                  setExpandedId(isExpanded ? null : msg.id)
                }
                onFeedback={
                  msg.role === "assistant" && !isStreaming && msg.text
                    ? (rating) => onFeedback?.(msg.id, rating)
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function SpeakerTabs({
  speakers,
  activeSpeaker,
  messages,
}: {
  speakers: Speaker[];
  activeSpeaker: string | null;
  messages: ConversationMessage[];
}) {
  if (speakers.length <= 1) return null;

  const countBySpeaker = new Map<string, number>();
  for (const msg of messages) {
    const key = msg.role === "assistant" ? "assistant" : "user";
    countBySpeaker.set(key, (countBySpeaker.get(key) ?? 0) + 1);
  }

  return (
    <div className="speaker-tabs" role="tablist">
      {speakers.map((speaker) => {
        const isActive = activeSpeaker === speaker.id;
        const count = countBySpeaker.get(speaker.id) ?? 0;
        return (
          <button
            key={speaker.id}
            role="tab"
            className={`speaker-tab${isActive ? " speaker-tab--active" : ""}`}
            style={
              {
                "--speaker-color": speaker.color,
                "--speaker-glow": speaker.glow,
              } as React.CSSProperties
            }
            aria-selected={isActive}
          >
            <span className="speaker-tab-dot" />
            <span className="speaker-tab-label">{speaker.label}</span>
            <span className="speaker-tab-count">{count}</span>
          </button>
        );
      })}
    </div>
  );
}

function StreamMessage({
  message,
  speaker,
  streaming,
  expanded,
  isLast,
  onToggle,
  onFeedback,
}: {
  message: ConversationMessage;
  speaker: Speaker;
  streaming: boolean;
  expanded: boolean;
  isLast: boolean;
  onToggle: () => void;
  onFeedback?: (rating: "positive" | "negative") => void;
}) {
  const [feedbackGiven, setFeedbackGiven] = useState<
    "positive" | "negative" | null
  >(null);
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="stream-msg stream-msg--system">
        <div className="stream-msg-bar" style={{ "--speaker-color": "#705d1b", "--speaker-glow": "#705d1b30" } as React.CSSProperties}>
          <span className="stream-msg-text">{message.text}</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`stream-msg${isUser ? " stream-msg--user" : " stream-msg--assistant"}${isLast ? " stream-msg--last" : ""}`}
      data-streaming={streaming || undefined}
    >
      <div
        className="stream-msg-bar"
        style={
          {
            "--speaker-color": speaker.color,
            "--speaker-glow": speaker.glow,
          } as React.CSSProperties
        }
      >
        <div className="stream-msg-indicator">
          <span
            className={`stream-msg-dot${streaming ? " stream-msg-dot--pulse" : ""}`}
          />
          <span className="stream-msg-speaker">{speaker.label}</span>
        </div>

        <button
          type="button"
          className="stream-msg-content"
          onClick={onToggle}
          aria-expanded={expanded}
        >
          {expanded ? (
            <span className="stream-msg-text stream-msg-text--full">
              {message.text || (streaming ? "" : "...")}
            </span>
          ) : (
            <span className="stream-msg-preview">
              <span className="stream-msg-text">
                {message.text
                  ? message.text.slice(0, 80) + (message.text.length > 80 ? "..." : "")
                  : streaming
                    ? ""
                    : "..."}
              </span>
              {message.text && message.text.length > 80 && (
                <span className="stream-msg-expand">tap to read</span>
              )}
            </span>
          )}
        </button>

        {streaming && <span className="stream-msg-streaming" />}
      </div>

      {!streaming && onFeedback && !feedbackGiven && (
        <div className="stream-msg-feedback">
          <button
            type="button"
            className="stream-feedback-btn"
            onClick={() => {
              setFeedbackGiven("positive");
              onFeedback("positive");
            }}
            aria-label="Helpful"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
          <button
            type="button"
            className="stream-feedback-btn"
            onClick={() => {
              setFeedbackGiven("negative");
              onFeedback("negative");
            }}
            aria-label="Not helpful"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          </button>
        </div>
      )}

      {feedbackGiven && (
        <div
          className="stream-msg-feedback-given"
          style={{ "--feedback-color": feedbackGiven === "positive" ? "#10b981" : "#f47762" } as React.CSSProperties}
        >
          <span className="stream-feedback-dot" />
        </div>
      )}
    </div>
  );
}
