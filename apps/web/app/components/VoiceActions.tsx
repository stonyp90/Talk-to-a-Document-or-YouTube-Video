"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";

export type VoiceActionId =
  | "youtube"
  | "upload"
  | "voice"
  | "summarize"
  | "back"
  | "next"
  | "cancel";

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
  back: "Go back or undo the last step",
  next: "Go forward to the next step",
  cancel: "Cancel the current action",
};

const actionReplies: Record<VoiceActionId, string> = {
  youtube: "Opening the YouTube source tab.",
  upload: "Opening the PDF upload picker.",
  voice: "Starting voice chat.",
  summarize: "Preparing a key-ideas summary.",
  back: "Going back and undoing the last step.",
  next: "Moving forward to the next step.",
  cancel: "Cancelling the current action.",
};

const defaultTriggers: VoiceTrigger[] = [
  { id: "default-back", phrase: "back", action: "back" },
  { id: "default-next", phrase: "next", action: "next" },
  { id: "default-cancel", phrase: "cancel", action: "cancel" },
];

const examples: Array<{
  phrase: string;
  action: VoiceActionId;
  label: string;
}> = [
  { phrase: "YouTube", action: "youtube", label: "switch to YouTube" },
  { phrase: "Upload", action: "upload", label: "open the PDF picker" },
  { phrase: "Let's talk", action: "voice", label: "try a voice action" },
  {
    phrase: "Summarize this",
    action: "summarize",
    label: "ask for a summary",
  },
  { phrase: "Back", action: "back", label: "undo the last step" },
  { phrase: "Next", action: "next", label: "continue forward" },
  { phrase: "Cancel", action: "cancel", label: "stop the current action" },
];

function normalize(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[-–—]/g, "")
    .replace(/[^\p{L}\p{N}\s']/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escaped(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findMatches(
  transcript: string,
  available: VoiceTrigger[],
): VoiceTrigger[] {
  const spoken = normalize(transcript);
  return available
    .map((trigger, index) => {
      const phrase = normalize(trigger.phrase);
      if (!phrase) return null;
      const match = spoken.match(
        new RegExp(`(?:^|\\s)${escaped(phrase)}(?=$|\\s)`),
      );
      return match
        ? { trigger, index, position: match.index ?? Number.MAX_SAFE_INTEGER }
        : null;
    })
    .filter(
      (
        item,
      ): item is { trigger: VoiceTrigger; index: number; position: number } =>
        item !== null,
    )
    .sort(
      (left, right) =>
        left.position - right.position || left.index - right.index,
    )
    .map(({ trigger }) => trigger);
}

function readSavedTriggers(): VoiceTrigger[] {
  try {
    const stored = localStorage.getItem("ursly-voice-triggers-v1");
    if (stored === null) return defaultTriggers;
    const saved = JSON.parse(stored) as unknown;
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
          normalize(item.phrase) &&
          Object.hasOwn(actionLabels, item.action),
      ),
    );
  } catch {
    return [];
  }
}

function browserSupportsSpeechRecognition(): boolean {
  if (typeof window === "undefined") return false;
  const speechWindow = window as SpeechWindow;
  return Boolean(
    speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition,
  );
}

export function VoiceActions({
  onAction,
  canStartVoice,
  voiceBusy,
}: VoiceActionsProps) {
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [action, setAction] = useState<VoiceActionId>("upload");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [triggers, setTriggers] = useState<VoiceTrigger[]>(readSavedTriggers);
  const [supported] = useState(browserSupportsSpeechRecognition);
  const [armed, setArmed] = useState(false);
  const [heard, setHeard] = useState("");
  const [revealedExample, setRevealedExample] = useState<VoiceActionId | null>(
    null,
  );
  const [notice, setNotice] = useState(
    "Create a trigger, then arm voice actions to try it hands-free.",
  );
  const recognition = useRef<SpeechRecognitionInstance | null>(null);
  const armedRef = useRef(false);
  const triggersRef = useRef(triggers);
  const handledTriggers = useRef(new Set<string>());
  const onActionRef = useRef(onAction);

  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);

  useEffect(() => {
    triggersRef.current = triggers;
  }, [triggers]);

  function speak(reply: string, onDone?: () => void) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (typeof SpeechSynthesisUtterance === "undefined") return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(reply);
    utterance.lang = navigator.language || "en-US";
    utterance.onend = onDone ?? null;
    window.speechSynthesis.speak(utterance);
  }

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

  useEffect(() => {
    if (voiceBusy && armedRef.current) {
      armedRef.current = false;
      recognition.current?.stop();
      recognition.current = null;
      setArmed(false);
      setNotice(
        "Voice actions paused while Ursly is busy with another action.",
      );
    }
  }, [voiceBusy]);

  function runAction(trigger: VoiceTrigger, transcript = trigger.phrase) {
    const continueListening =
      armedRef.current &&
      !["upload", "voice", "cancel"].includes(trigger.action);
    if (continueListening) {
      armedRef.current = false;
      recognition.current?.stop();
      recognition.current = null;
      setArmed(false);
    } else if (
      armedRef.current &&
      ["upload", "voice", "cancel"].includes(trigger.action)
    ) {
      stopListening();
    }
    setNotice(
      `Triggered “${trigger.phrase}” · ${actionLabels[trigger.action]}.`,
    );
    speak(
      actionReplies[trigger.action],
      continueListening ? startListening : undefined,
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
    const normalizedPhrase = normalize(nextPhrase);
    if (!normalizedPhrase) {
      setNotice("Use at least one letter or number in the trigger phrase.");
      return;
    }
    if (
      triggers.some(
        (trigger) =>
          trigger.id !== editingId &&
          normalize(trigger.phrase) === normalizedPhrase,
      )
    ) {
      setNotice(`“${nextPhrase}” is already saved. Choose a different phrase.`);
      return;
    }
    const next: VoiceTrigger = {
      id: editingId ?? crypto.randomUUID(),
      phrase: nextPhrase,
      action,
    };
    setTriggers((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? next : item))
        : [...current, next],
    );
    setPhrase("");
    setEditingId(null);
    setNotice(
      `${editingId ? "Updated" : "Saved"} trigger: ${nextPhrase}. Arm voice actions and say it to run the action.`,
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

    let instance: SpeechRecognitionInstance;
    try {
      instance = new SpeechRecognition();
    } catch {
      setNotice(
        "Voice actions could not start. Check microphone permissions and try again.",
      );
      return;
    }
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = navigator.language || "en-US";
    instance.onstart = () => {
      handledTriggers.current.clear();
      setArmed(true);
      setNotice(
        `Listening for ${triggersRef.current.map((item) => `“${item.phrase}”`).join(", ")}.`,
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
      for (const match of findMatches(transcript, triggersRef.current)) {
        if (handledTriggers.current.has(match.id)) continue;
        handledTriggers.current.add(match.id);
        runAction(match, transcript);
        if (!armedRef.current) break;
      }
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
          <h2 id="voice-actions-heading" tabIndex={-1}>
            Say a word. Take the next step.
          </h2>
          <p>
            Create a spoken trigger for an app action. Say that word anywhere in
            a sentence and Ursly acts as soon as it hears it.
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
        <div className="voice-example-heading">
          <span className="voice-example-label">Try an example</span>
          <span className="voice-example-hint">
            Tap to try · <Icon name="eye" /> to see what to say
          </span>
        </div>
        {examples.map((example) => (
          <div className="voice-example-card" key={example.phrase}>
            <button
              type="button"
              className="voice-example"
              disabled={voiceBusy}
              aria-label={`“${example.phrase}” ${example.label}`}
              onClick={() => runExample(example)}
            >
              <span className="voice-example-copy">
                <strong>{example.label}</strong>
                <small>Try this action</small>
              </span>
              <span className="voice-example-arrow" aria-hidden="true">
                ↗
              </span>
            </button>
            <button
              type="button"
              className="voice-example-reveal"
              aria-expanded={revealedExample === example.action}
              aria-controls={`voice-example-trigger-${example.action}`}
              onClick={() =>
                setRevealedExample((current) =>
                  current === example.action ? null : example.action,
                )
              }
            >
              <Icon name="eye" />
              {revealedExample === example.action
                ? "Hide trigger"
                : "Show trigger"}
            </button>
            {revealedExample === example.action && (
              <div
                id={`voice-example-trigger-${example.action}`}
                className="voice-example-trigger"
              >
                <span>Say this</span>
                <strong>“{example.phrase}”</strong>
              </div>
            )}
          </div>
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
              The phrases stay on this device. Every action is configurable,
              including the built-in Back, Next, and Cancel commands.
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
            <button
              className="primary"
              type="submit"
              disabled={!normalize(phrase)}
            >
              {editingId ? "Update trigger" : "Save trigger"}
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
                  <div className="saved-trigger-actions">
                    <button
                      type="button"
                      className="saved-trigger-remove"
                      aria-label={`Edit trigger ${trigger.phrase}`}
                      onClick={() => {
                        setPhrase(trigger.phrase);
                        setAction(trigger.action);
                        setEditingId(trigger.id);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </button>
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
          <p className="hint voice-support-note">
            For uploads, your browser still asks you to confirm the local file;
            websites cannot read arbitrary files without that confirmation.
          </p>
        </div>
      )}
    </section>
  );
}
