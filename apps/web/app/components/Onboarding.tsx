"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IntroVideo } from "./IntroVideo";

const steps = [
  {
    label: "Bring a source",
    title: "Start with something worth understanding.",
    text: "Drop in a text-based PDF or paste a YouTube link with captions. Ursly reads it and keeps the extracted text available for you to check.",
    note: "PDFs up to 25 MB · YouTube captions · source preview",
  },
  {
    label: "Ask naturally",
    title: "Use your voice when the thought arrives.",
    text: "Select Start Voice Chat and ask in your own words. Interrupt an answer, mute the microphone, or type whenever that feels easier.",
    note: "Live voice · mute · interrupt · text fallback",
  },
  {
    label: "Go deeper",
    title: "Turn information into your next aha.",
    text: "Ask a follow-up, challenge an idea, or ask for a simpler explanation. Quick prompts help you get moving, and every answer stays grounded in your source.",
    note: "Source-grounded answers · quick prompts · follow-ups",
  },
  {
    label: "Voice to action",
    title: "Say it once. Take the next step.",
    text: "Voice to action turns a simple phrase into the next useful move: open a PDF picker, switch to YouTube, prepare a summary, or start voice chat. Motion beta offers another hands-free way to reveal the next control.",
    note: "Voice shortcuts · motion beta · always in your control",
  },
];

const visualSteps = [
  { label: "Source", title: "PDF or YouTube", detail: "Read it · preview it" },
  {
    label: "Conversation",
    title: "Voice or text",
    detail: "Ask · interrupt · mute",
  },
  {
    label: "Understanding",
    title: "Answers that stay grounded",
    detail: "Follow up · go deeper",
  },
  {
    label: "Shortcuts",
    title: "Voice actions + motion",
    detail: "Take the next step",
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
          <strong>Quick product tour</strong>
          <span className="onboarding-bar-detail">
            4 features · about 25 seconds
          </span>
        </span>
        <span className="onboarding-actions">
          <IntroVideo />
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
        </span>
      </div>

      {open && (
        <section
          id="welcome-guide"
          className="welcome-guide"
          aria-labelledby="welcome-title"
          aria-describedby="welcome-description"
          aria-label="4-step product tour"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <div
            className={`welcome-copy${
              step === steps.length - 1 ? " welcome-copy-feature" : ""
            }`}
            aria-live="polite"
            key={steps[step].label}
          >
            <span className="eyebrow">
              <span className="tiny-line" /> Step {step + 1} ·{" "}
              {steps[step].label}
            </span>
            <h2 id="welcome-title" ref={heading} tabIndex={-1}>
              {steps[step].title}
            </h2>
            <p id="welcome-description">{steps[step].text}</p>
            <div className="welcome-note">
              <span aria-hidden="true">✦</span>
              {steps[step].note}
            </div>
            {step === steps.length - 1 && (
              <div
                className="welcome-feature-preview"
                aria-label="Voice to action preview"
              >
                <div className="welcome-feature-command">
                  <span className="welcome-feature-wave" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>“Add a PDF”</span>
                </div>
                <span className="welcome-feature-arrow" aria-hidden="true">
                  →
                </span>
                <div className="welcome-feature-result">
                  <span aria-hidden="true" /> PDF picker ready
                </div>
              </div>
            )}
          </div>

          <div className="welcome-visual" aria-hidden="true">
            <div className="welcome-visual-bar">
              <span>URS-LY TOUR</span>
              <span>0{step + 1} / 04</span>
            </div>
            <div
              key={visualSteps[step].label}
              className={`welcome-visual-screen feature-${step + 1}`}
            >
              <span className="welcome-visual-orb" />
              <span className="welcome-visual-label">
                {visualSteps[step].label}
              </span>
              <strong>{visualSteps[step].title}</strong>
              <span>{visualSteps[step].detail}</span>
              <div className="welcome-visual-lines">
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="welcome-visual-track">
              {visualSteps.map((item, index) => (
                <span key={item.label} data-active={index === step} />
              ))}
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
