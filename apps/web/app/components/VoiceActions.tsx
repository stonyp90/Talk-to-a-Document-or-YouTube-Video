"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

export type VoiceActionId = "youtube" | "upload" | "voice" | "summarize";

type VoiceTrigger = {
  id: string;
  phrase: string;
  action: VoiceActionId;
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
};

type SpeechRecognitionResultLike = {
  [index: number]: SpeechRecognitionAlternativeLike | undefined;
};

type SpeechRecognitionResultListLike = {
  [index: number]: SpeechRecognitionResultLike | undefined;
  length: number;
};

type SpeechRecognitionResultEvent = Event & {
  resultIndex: number;
  results: SpeechRecognitionResultListLike;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onerror: ((event: Event) => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

type VoiceActionsProps = {
  onAction: (action: VoiceActionId) => void;
  canStartVoice: boolean;
  voiceBusy: boolean;
};

const actionLabels: Record<VoiceActionId, string> = {
  youtube: "Open the YouTube source tab",
  upload: "Open the PDF upload picker",
  voice: "Start voice chat",
  summarize: "Ask for a key-ideas summary",
};

const examples: Array<{
  phrase: string;
  action: VoiceActionId;
  label: string;
}> = [
  { phrase: "YouTube", action: "youtube", label: "switch to YouTube" },
  { phrase: "Upload", action: "upload", label: "open the PDF picker" },
  { phrase: "Let's talk", action: "voice", label: "start voice chat" },
  {
    phrase: "Summarize this",
    action: "summarize",
    label: "ask for a summary",
  },
];

function normalize(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function readSavedTriggers(): VoiceTrigger[] {
  try {
    const saved = JSON.parse(
      localStorage.getItem("ursly-voice-triggers-v1") ?? "[]",
    ) as unknown;
    if (!Array.isArray(saved)) return [];
    return saved.filter((item): item is VoiceTrigger =>
      Boolean(
        item &&
          typeof item === "object" &&
          "id" in item &&
          "phrase" in item &&
          "action" in item &&
          typeof item.id === "string" &&
          typeof item.phrase === "string" &&
          item.phrase.trim() &&
          typeof item.action === "string" &&
          item.action in actionLabels,
      ),
    );
  } catch {
    return [];
  }
}

export function VoiceActions({
  onAction,
  canStartVoice,
  voiceBusy,
}: VoiceActionsProps) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [action, setAction] = useState<VoiceActionId>("upload");
  const [triggers, setTriggers] = useState<VoiceTrigger[]>([]);
  const [supported, setSupported] = useState(false);
  const [armed, setArmed] = useState(false);
  const [heard, setHeard] = useState("");
  const [notice, setNotice] = useState(
    "Create a trigger, then arm voice actions to try it hands-free.",
  );
  const recognition = useRef<SpeechRecognitionInstance | null>(null);
  const armedRef = useRef(false);
  const lastTrigger = useRef("");
  const onActionRef = useRef(onAction);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  useEffect(() => {
    setSupported(
      Boolean(
        (window as SpeechWindow).SpeechRecognition ||
          (window as SpeechWindow).webkitSpeechRecognition,
      ),
    );
    setTriggers(readSavedTriggers());
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("ursly-voice-triggers-v1", JSON.stringify(triggers));
    } catch {
      /* Voice triggers still work for this session when storage is unavailable. */
    }
  }, [triggers]);

  useEffect(
    () => () => {
      armedRef.current = false;
      recognition.current?.stop();
      recognition.current = null;
    },
    [],
  );

  function runAction(trigger: VoiceTrigger, transcript = trigger.phrase) {
    const key = `${trigger.id}:${normalize(transcript)}`;
    if (lastTrigger.current === key) return;
    lastTrigger.current = key;
    window.setTimeout(() => {
      if (lastTrigger.current === key) lastTrigger.current = "";
    }, 1400);
    setNotice(
      `Triggered “${trigger.phrase}” · ${actionLabels[trigger.action]}.`,
    );
    onActionRef.current(trigger.action);
  }

  function runExample(example: (typeof examples)[number]) {
    runAction(
      {
        id: `example-${example.action}`,
        phrase: example.phrase,
        action: example.action,
      },
      example.phrase,
    );
  }

  function saveTrigger(event: FormEvent) {
    event.preventDefault();
    const nextPhrase = phrase.trim();
    if (!nextPhrase) return;
    const next: VoiceTrigger = {
      id: crypto.randomUUID(),
      phrase: nextPhrase,
      action,
    };
    setTriggers((current) => [...current, next]);
    setPhrase("");
    setNotice(
      `Saved “${nextPhrase}”. Arm voice actions and say it to run the action.`,
    );
  }

  function stopListening() {
    armedRef.current = false;
    recognition.current?.stop();
    recognition.current = null;
    setArmed(false);
    setNotice(
      "Voice actions are off. Your saved triggers are ready for next time.",
    );
  }

  function startListening() {
    if (!supported) {
      setNotice(
        "This browser does not support speech recognition. Use the example buttons or type instead.",
      );
      return;
    }
    if (triggers.length === 0) {
      setOpen(true);
      setNotice("Create at least one trigger before arming voice actions.");
      return;
    }
    const speechWindow = window as SpeechWindow;
    const SpeechRecognition =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const instance = new SpeechRecognition();
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = navigator.language || "en-US";
    instance.onstart = () => {
      setArmed(true);
      setNotice(
        `Listening for ${triggers.map((item) => `“${item.phrase}”`).join(", ")}.`,
      );
    };
    instance.onresult = (event) => {
      const transcript = Array.from(
        { length: event.results.length - event.resultIndex },
        (_, index) =>
          event.results[event.resultIndex + index]?.[0]?.transcript ?? "",
      )
        .join(" ")
        .trim();
      if (!transcript) return;
      setHeard(transcript);
      const spoken = normalize(transcript);
      const match = triggers.find((item) =>
        spoken.includes(normalize(item.phrase)),
      );
      if (match) runAction(match, transcript);
    };
    instance.onerror = () => {
      if (armedRef.current) {
        setNotice(
          "Voice actions need microphone access. Check the browser permission and try again.",
        );
        setArmed(false);
        armedRef.current = false;
      }
    };
    instance.onend = () => {
      if (!armedRef.current) {
        setArmed(false);
        return;
      }
      try {
        instance.start();
      } catch {
        setArmed(false);
        armedRef.current = false;
        setNotice(
          "Voice actions stopped. Press Arm voice actions to restart them.",
        );
      }
    };
    recognition.current = instance;
    armedRef.current = true;
    try {
      instance.start();
    } catch {
      armedRef.current = false;
      recognition.current = null;
      setNotice(
        "Voice actions could not start. Check microphone permissions and try again.",
      );
    }
  }

  return (
    <section
      className="voice-actions-card"
      aria-labelledby="voice-actions-heading"
    >
      <div className="voice-actions-heading">
        <div>
          <span className="eyebrow">Demo preview · voice actions</span>
          <h2 id="voice-actions-heading">Say a word. Take the next step.</h2>
          <p>
            Create a spoken trigger for an app action. Try an example below, or
            arm the listener and say your own phrase.
          </p>
        </div>
        <button
          type="button"
          className="secondary voice-trigger-button"
          aria-expanded={open}
          aria-controls="voice-trigger-builder"
          onClick={() => setOpen((current) => !current)}
        >
          <Icon name="voice" />{" "}
          {open ? "Close trigger builder" : "Create voice trigger"}
        </button>
      </div>

      <div className="voice-actions-preview">
        <div className="voice-actions-status" data-armed={armed}>
          <span className="voice-actions-status-dot" aria-hidden="true" />
          <div>
            <strong>
              {armed ? "Voice actions are listening" : "Voice actions are off"}
            </strong>
            <span>{notice}</span>
          </div>
        </div>
        <button
          type="button"
          className="primary voice-actions-arm"
          disabled={voiceBusy}
          onClick={armed ? stopListening : startListening}
        >
          <Icon name="voice" /> {armed ? "Stop listening" : "Arm voice actions"}
        </button>
      </div>

      <div className="voice-example-row" aria-label="Voice action examples">
        <span className="voice-example-label">Try an example</span>
        {examples.map((example) => (
          <button
            key={example.phrase}
            type="button"
            className="voice-example"
            onClick={() => runExample(example)}
          >
            <span>“{example.phrase}”</span>
            <small>{example.label}</small>
          </button>
        ))}
      </div>

      {heard && (
        <p className="voice-heard" role="status">
          Heard: <strong>{heard}</strong>
        </p>
      )}

      {open && (
        <div id="voice-trigger-builder" className="voice-trigger-builder">
          <div className="voice-trigger-builder-copy">
            <h3>Build a trigger</h3>
            <p>
              The trigger phrase stays on this device. When it is heard, Ursly
              runs the selected action in this page.
            </p>
          </div>
          <form className="voice-trigger-form" onSubmit={saveTrigger}>
            <div className="voice-trigger-field">
              <label htmlFor="voice-trigger-phrase">
                Trigger word or phrase
              </label>
              <input
                id="voice-trigger-phrase"
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                placeholder="e.g. upload"
                autoComplete="off"
              />
            </div>
            <div className="voice-trigger-field">
              <label htmlFor="voice-trigger-action">When I say it…</label>
              <select
                id="voice-trigger-action"
                value={action}
                onChange={(event) =>
                  setAction(event.target.value as VoiceActionId)
                }
              >
                {Object.entries(actionLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <button className="primary" type="submit" disabled={!phrase.trim()}>
              Save trigger
            </button>
          </form>

          <div className="saved-trigger-list">
            {triggers.length === 0 ? (
              <p className="hint">
                No saved triggers yet. Start with “upload” or “YouTube”.
              </p>
            ) : (
              triggers.map((trigger) => (
                <div className="saved-trigger" key={trigger.id}>
                  <span className="saved-trigger-phrase">
                    “{trigger.phrase}”
                  </span>
                  <span className="saved-trigger-action">
                    {actionLabels[trigger.action]}
                  </span>
                  <button
                    type="button"
                    className="saved-trigger-remove"
                    aria-label={`Remove trigger ${trigger.phrase}`}
                    onClick={() =>
                      setTriggers((current) =>
                        current.filter((item) => item.id !== trigger.id),
                      )
                    }
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
          {!supported && (
            <p className="hint voice-support-note">
              Live speech recognition is not available in this browser. The demo
              buttons still preview every action.
            </p>
          )}
          {!canStartVoice && (
            <p className="hint voice-support-note">
              Start voice chat becomes available after you add a PDF or YouTube
              source.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
