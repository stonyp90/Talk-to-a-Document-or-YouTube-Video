"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const steps = [
  {
    label: "Bring a source",
    title: "Start with something worth understanding.",
    text: "Drop in a text-based PDF or paste a YouTube link with captions. Ursly reads the source so you can spend your attention on the ideas inside it.",
    note: "PDFs up to 25 MB · captioned YouTube videos",
  },
  {
    label: "Ask naturally",
    title: "Use your voice when the thought arrives.",
    text: "Select Start Voice Chat and ask in your own words. You can interrupt an answer, mute the microphone, or type whenever that feels easier.",
    note: "Voice or text · you’re always in control",
  },
  {
    label: "Go deeper",
    title: "Turn information into your next aha.",
    text: "Ask a follow-up, challenge an idea, or ask for a simpler explanation. Every answer stays grounded in the source you brought.",
    note: "Ask · follow up · understand",
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
    if (open) heading.current?.focus();
    if (wasOpen.current && !open) {
      if (focusWorkspace.current) {
        document.getElementById("workspace")?.focus();
        focusWorkspace.current = false;
      } else {
        launcher.current?.focus();
      }
    }
    wasOpen.current = open;
  }, [open, step]);

  useEffect(() => {
    if (!open || paused) return;
    const timer = window.setTimeout(() => {
      if (step === steps.length - 1) close(true);
      else setStep((current) => Math.min(current + 1, steps.length - 1));
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
        <span>
          <strong>Get oriented</strong>
          <span className="onboarding-bar-detail">
            3 short steps · about 30 seconds
          </span>
        </span>
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
              setPaused(false);
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
          className="welcome-guide"
          aria-labelledby="welcome-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <div className="welcome-copy" aria-live="polite">
            <span className="eyebrow">
              <span className="tiny-line" /> Step {step + 1} ·{" "}
              {steps[step].label}
            </span>
            <h2 id="welcome-title" ref={heading} tabIndex={-1}>
              {steps[step].title}
            </h2>
            <p>{steps[step].text}</p>
            <div className="welcome-note">
              <span aria-hidden="true">✦</span>
              {steps[step].note}
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
              {step < steps.length - 1 && (
                <button
                  type="button"
                  className="guide-auto-toggle"
                  aria-pressed={paused}
                  onClick={() => setPaused((current) => !current)}
                >
                  {paused ? "Resume slides" : "Pause slides"}
                </button>
              )}
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
        </section>
      )}
    </div>
  );
}
