"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Icon } from "./Icon";
import { useLanguage } from "../i18n/LanguageProvider";
import type { FeedbackRating } from "@/packages/core/src/domain/feedback";

type FeedbackPhase = "rating" | "comment" | "submitted";

const FADE_MS = 300;
const THANK_YOU_MS = 1800;

export function InteractionFeedback({
  sourceId,
  onDismiss,
}: {
  sourceId: string;
  onDismiss: () => void;
}) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<FeedbackPhase>("rating");
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [comment, setComment] = useState("");
  const [visible, setVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => {
      cancelAnimationFrame(frame);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    fadeTimer.current = setTimeout(onDismiss, FADE_MS);
  }, [onDismiss]);

  function selectRating(value: FeedbackRating) {
    setRating(value);
    setPhase("comment");
  }

  async function submitFeedback() {
    if (!rating) return;
    setSubmitting(true);
    try {
      await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, comment: comment.trim() || undefined, sourceId }),
      });
    } catch {
      /* A lost feedback is not a reader-facing failure. */
    } finally {
      setSubmitting(false);
      setPhase("submitted");
      fadeTimer.current = setTimeout(dismiss, THANK_YOU_MS);
    }
  }

  function skipComment() {
    setComment("");
    void submitFeedback();
  }

  const ratings: { value: FeedbackRating; label: string }[] = [
    { value: "helpful", label: t("Helpful") },
    { value: "partially", label: t("Partially helpful") },
    { value: "not-helpful", label: t("Not helpful") },
  ];

  return (
    <div
      className="interaction-feedback"
      role="region"
      aria-label={t("Rate this answer")}
      style={{
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      <button
        type="button"
        className="interaction-feedback-close"
        aria-label={t("Dismiss feedback")}
        onClick={dismiss}
      >
        <Icon name="close" />
      </button>

      {phase === "rating" && (
        <div className="interaction-feedback-ratings">
          <p className="interaction-feedback-prompt">
            {t("Was this helpful?")}
          </p>
          <div className="interaction-feedback-options" role="group" aria-label={t("Rating options")}>
            {ratings.map(({ value, label }) => (
              <button
                type="button"
                key={value}
                className="interaction-feedback-btn"
                onClick={() => selectRating(value)}
                aria-label={label}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {phase === "comment" && (
        <div className="interaction-feedback-comment">
          <p className="interaction-feedback-prompt">
            {t("Any details to share?")}
          </p>
          <textarea
            className="interaction-feedback-textarea field"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            placeholder={t("Optional")}
            rows={2}
            aria-label={t("Feedback comment")}
            maxLength={1000}
          />
          <div className="interaction-feedback-actions">
            <button
              type="button"
              className="interaction-feedback-btn"
              onClick={skipComment}
              disabled={submitting}
            >
              {t("Skip")}
            </button>
            <button
              type="button"
              className="interaction-feedback-btn interaction-feedback-submit"
              onClick={submitFeedback}
              disabled={submitting}
            >
              {submitting ? t("Sending") : t("Send")}
            </button>
          </div>
        </div>
      )}

      {phase === "submitted" && (
        <p className="interaction-feedback-thanks" role="status">
          {t("Thank you for your feedback.")}
        </p>
      )}
    </div>
  );
}
