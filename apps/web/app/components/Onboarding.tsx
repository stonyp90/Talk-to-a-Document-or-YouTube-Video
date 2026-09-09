"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "./Icon";

const steps = [
  {
    label: "Bring a source",
    title: "Start with something worth understanding.",
    text: "Drop in a text-based PDF or paste a YouTube link with captions. Ursly reads the source so you can spend your attention on the ideas inside it.",
    note: "PDFs up to 25 MB · captioned YouTube videos",
    visual: "source",
  },
  {
    label: "Ask naturally",
    title: "Use your voice when the thought arrives.",
    text: "Select Start Voice Chat and ask in your own words. You can interrupt an answer, mute the microphone, or type whenever that feels easier.",
    note: "Voice or text · you’re always in control",
    visual: "voice",
  },
  {
    label: "Go deeper",
    title: "Turn information into your next aha.",
    text: "Ask a follow-up, challenge an idea, or ask for a simpler explanation. Every answer stays grounded in the source you brought.",
    note: "Ask · follow up · understand",
    visual: "chat",
  },
];
const storageKey = "ursly-welcome-v2";

function subscribeToStorage(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}
function needsWelcome() {
  try {
    return localStorage.getItem(storageKey) !== "done";
  } catch {
    return true;
  }
}

export function Onboarding() {
  const firstVisit = useSyncExternalStore(
    subscribeToStorage,
    needsWelcome,
    () => false,
  );
  const [openOverride, setOpen] = useState<boolean | null>(null);
  const open = openOverride ?? firstVisit;
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const focusWorkspace = useRef(false);

  useEffect(() => {
    if (open) {
      heading.current?.focus();
      document.body.classList.add("guide-is-open");
    } else {
      document.body.classList.remove("guide-is-open");
    }
    return () => document.body.classList.remove("guide-is-open");
  }, [open, step]);

  useEffect(() => {
    if (wasOpen.current && !open) {
      if (focusWorkspace.current) {
        document.getElementById("workspace")?.focus();
        focusWorkspace.current = false;
      } else {
        launcher.current?.focus();
      }
    }
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open || paused || step === steps.length - 1) return;
    const timer = window.setTimeout(() => {
      setStep((current) => Math.min(current + 1, steps.length - 1));
    }, 6200);
    return () => window.clearTimeout(timer);
  }, [open, paused, step]);

  function close(start = false) {
    try {
      localStorage.setItem(storageKey, "done");
    } catch {
      /* The guide also works without browser storage. */
    }
    focusWorkspace.current = start;
    setOpen(false);
  }

  return (
    <div className="onboarding">
      <div className="onboarding-bar">
        <span>One source. Two simple steps.</span>
        <button
          ref={launcher}
          type="button"
          className="guide-toggle"
          aria-expanded={open}
          aria-controls="welcome-guide"
          onClick={() => {
            if (open) close();
            else {
              setStep(0);
              setOpen(true);
            }
          }}
        >
          {open ? "Hide guide" : "Quick tour"}
        </button>
      </div>
      {open && (
        <section
          id="welcome-guide"
          className="welcome-guide welcome-guide-fullscreen"
          aria-labelledby="welcome-title"
          role="dialog"
          aria-modal="true"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
            if (event.key === "Tab") {
              const focusable = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
                ),
              );
              const first = focusable[0];
              const last = focusable[focusable.length - 1];
              if (first && last) {
                if (event.shiftKey && document.activeElement === first) {
                  event.preventDefault();
                  last.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                  event.preventDefault();
                  first.focus();
                }
              }
            }
          }}
        >
          <div className="welcome-guide-inner">
            <div className="welcome-guide-topline">
              <div className="welcome-guide-brand">
                {/* The real mark keeps the guide tied to the product identity. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/brand/ursly-mark.svg"
                  width="34"
                  height="34"
                  alt=""
                />
                <span>
                  ursly<span className="brand-dot">.</span>
                </span>
              </div>
              <div className="welcome-guide-controls">
                <span className="welcome-guide-count">
                  Quick tour · 0{step + 1} / 03
                </span>
                {step < steps.length - 1 && (
                  <button
                    type="button"
                    className="guide-auto-toggle"
                    aria-pressed={paused}
                    onClick={() => setPaused((current) => !current)}
                  >
                    <span aria-hidden="true">{paused ? "▶" : "Ⅱ"}</span>
                    {paused ? "Resume slides" : "Pause slides"}
                  </button>
                )}
              </div>
              <button
                type="button"
                className="welcome-close"
                onClick={() => close()}
                aria-label="Close guide"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="welcome-guide-layout">
              <div className="welcome-visual" aria-hidden="true">
                <div className="guide-visual-glow" />
                {steps[step].visual === "source" && (
                  <div className="guide-source-scene">
                    <div className="guide-source-orbit guide-source-orbit-one" />
                    <div className="guide-source-orbit guide-source-orbit-two" />
                    <div className="guide-file-card guide-file-back">
                      <Icon name="video" />
                      <span>video</span>
                    </div>
                    <div className="guide-file-card guide-file-front">
                      <div className="guide-file-icon">
                        <Icon name="document" />
                      </div>
                      <div className="guide-file-lines">
                        <i />
                        <i />
                        <i />
                      </div>
                      <strong>your source</strong>
                    </div>
                    <div className="guide-source-pill">
                      <span /> ready to explore
                    </div>
                  </div>
                )}
                {steps[step].visual === "voice" && (
                  <div className="guide-voice-scene">
                    <div className="guide-voice-ring guide-voice-ring-one" />
                    <div className="guide-voice-ring guide-voice-ring-two" />
                    <div className="guide-voice-core">
                      <Icon name="voice" />
                    </div>
                    <div className="guide-voice-label">
                      Listening for your question<span>•••</span>
                    </div>
                    <div className="guide-voice-caption">
                      “Explain this simply.”
                    </div>
                  </div>
                )}
                {steps[step].visual === "chat" && (
                  <div className="guide-chat-scene">
                    <div className="guide-chat-line guide-chat-line-one" />
                    <div className="guide-chat-bubble guide-chat-bubble-user">
                      What should I remember?
                    </div>
                    <div className="guide-chat-bubble guide-chat-bubble-answer">
                      <span className="guide-answer-mark">
                        <Icon name="voice" />
                      </span>
                      <span>Here’s the idea in a nutshell.</span>
                    </div>
                    <div className="guide-chat-spark guide-chat-spark-one">
                      ✦
                    </div>
                    <div className="guide-chat-spark guide-chat-spark-two">
                      ·
                    </div>
                  </div>
                )}
              </div>

              <div className="welcome-copy" aria-live="polite">
                <span className="eyebrow">
                  <span className="tiny-line" /> Step {step + 1} ·{" "}
                  {steps[step].label}
                </span>
                <h2 id="welcome-title" ref={heading} tabIndex={-1} key={step}>
                  {steps[step].title}
                </h2>
                <p key={`text-${step}`}>{steps[step].text}</p>
                <div className="welcome-note">
                  <span aria-hidden="true">✦</span>
                  {steps[step].note}
                </div>
              </div>
            </div>

            <div className="welcome-guide-footer">
              <ol className="guide-step-rail" aria-label="Guide steps">
                {steps.map((item, index) => (
                  <li
                    key={item.label}
                    className={
                      index === step ? "active" : index < step ? "complete" : ""
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setStep(index)}
                      aria-label={`Go to step ${index + 1}: ${item.label}`}
                      aria-current={index === step ? "step" : undefined}
                    >
                      <span>{index < step ? "✓" : `0${index + 1}`}</span>
                      <b>{item.label}</b>
                    </button>
                  </li>
                ))}
              </ol>
              <div className="welcome-actions">
                <button
                  type="button"
                  className="guide-skip"
                  onClick={() => close()}
                >
                  Skip guide
                </button>
                {step > 0 && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setStep(step - 1)}
                  >
                    Back
                  </button>
                )}
                <button
                  type="button"
                  className="primary guide-next"
                  onClick={() => {
                    if (step === steps.length - 1) close(true);
                    else {
                      setPaused(false);
                      setStep(step + 1);
                    }
                  }}
                >
                  {step === steps.length - 1 ? "Open Ursly" : "Continue"}
                  <span aria-hidden="true">↗</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
