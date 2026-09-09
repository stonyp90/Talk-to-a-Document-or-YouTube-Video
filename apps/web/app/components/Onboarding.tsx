"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const steps = [
  {
    title: "Bring something you’re curious about",
    text: "Choose a text-based PDF (up to 25 MB), or paste a YouTube link with available captions. Select Continue to questions and we’ll read it for you.",
  },
  {
    title: "Ask in your own words",
    text: "Select Start Voice Chat, allow the microphone, and ask out loud. Prefer to stay quiet? Type your question and select Send instead.",
  },
  {
    title: "Make it your conversation",
    text: "Keep the conversation going: interrupt an answer, follow up, mute or stop at any time. Open View source text to check details, or Change source to start over.",
  },
];
const storageKey = "ursly-welcome-v1";

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
  const heading = useRef<HTMLHeadingElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const userOpened = useRef(false);

  useEffect(() => {
    if (open && userOpened.current) heading.current?.focus();
  }, [open, step]);

  function close(start = false) {
    try {
      localStorage.setItem(storageKey, "done");
    } catch {
      /* The guide also works without browser storage. */
    }
    setOpen(false);
    if (start) document.getElementById("workspace")?.focus();
    else launcher.current?.focus();
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
              userOpened.current = true;
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
          className="welcome-guide"
          aria-labelledby="welcome-title"
          onKeyDown={(event) => {
            if (event.key === "Escape") close();
          }}
        >
          <div className="welcome-copy" aria-live="polite">
            <span className="eyebrow">
              Welcome to Ursly · Quick tour {step + 1} of 3
            </span>
            <h2 id="welcome-title" ref={heading} tabIndex={-1}>
              {steps[step].title}
            </h2>
            <p>{steps[step].text}</p>
          </div>
          <div className="welcome-actions">
            <button
              type="button"
              className="guide-toggle"
              onClick={() => close()}
            >
              Skip tour
            </button>
            {step > 0 && (
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  userOpened.current = true;
                  setStep(step - 1);
                }}
              >
                Back
              </button>
            )}
            <button
              type="button"
              className="primary"
              onClick={() => {
                if (step === steps.length - 1) close(true);
                else {
                  userOpened.current = true;
                  setStep(step + 1);
                }
              }}
            >
              {step === steps.length - 1 ? "Let’s get started" : "Next"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
