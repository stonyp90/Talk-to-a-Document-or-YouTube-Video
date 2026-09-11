"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Icon } from "./Icon";
import { useLanguage } from "../i18n/LanguageProvider";

/** BCP 47 tags the speech engines expect for each interface language. */
const SPEECH_LOCALES = { en: "en-US", fr: "fr-CA" } as const;

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

const MAX_TRIGGER_LENGTH = 80;
const MAX_SAVED_TRIGGERS = 32;
const MAX_LISTENING_MS = 30_000;
const SILENCE_TIMEOUT_MS = 8_000;
const RESTART_DELAY_MS = 250;

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

const TRIGGER_STORAGE_NAME = "ursly-voice-triggers-v1";

function parseSavedTriggers(stored: string | null): VoiceTrigger[] {
  try {
    if (stored === null) return defaultTriggers;
    const saved = JSON.parse(stored) as unknown;
    if (!Array.isArray(saved)) return [];
    return saved
      .filter((item): item is VoiceTrigger =>
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
      )
      .filter((item) => item.phrase.length <= MAX_TRIGGER_LENGTH)
      .slice(0, MAX_SAVED_TRIGGERS);
  } catch {
    return [];
  }
}

/**
 * The saved triggers as an external store: browser storage is the source, the
 * server snapshot is the default set, and the parsed value is cached per raw
 * string so React sees a stable reference between renders.
 */
let savedTriggersCache: { raw: string | null; parsed: VoiceTrigger[] } = {
  raw: null,
  parsed: defaultTriggers,
};
function readSavedTriggers(): VoiceTrigger[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(TRIGGER_STORAGE_NAME);
  } catch {
    raw = null;
  }
  if (savedTriggersCache.raw !== raw || raw === null)
    savedTriggersCache = { raw, parsed: parseSavedTriggers(raw) };
  return savedTriggersCache.parsed;
}
function subscribeToTriggerStorage(notify: () => void): () => void {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
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
  const { language, t } = useLanguage();
  const speechLocale = SPEECH_LOCALES[language];
  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [action, setAction] = useState<VoiceActionId>("upload");
  const [editingId, setEditingId] = useState<string | null>(null);
  // Saved triggers live in browser storage, which the server cannot read: the
  // server snapshot is the default set, hydration reads the saved one, and an
  // edit made on this page wins over both until it is persisted.
  const savedTriggers = useSyncExternalStore(
    subscribeToTriggerStorage,
    readSavedTriggers,
    () => defaultTriggers,
  );
  const [editedTriggers, setEditedTriggers] = useState<VoiceTrigger[] | null>(
    null,
  );
  const triggers = editedTriggers ?? savedTriggers;
  const setTriggers = useCallback(
    (update: (current: VoiceTrigger[]) => VoiceTrigger[]) =>
      setEditedTriggers((current) => update(current ?? readSavedTriggers())),
    [],
  );
  // The server cannot know the browser; it assumes support and hydration
  // corrects it without a mismatch.
  const supported = useSyncExternalStore(
    () => () => {},
    browserSupportsSpeechRecognition,
    () => true,
  );
  const [armed, setArmed] = useState(false);
  const [heard, setHeard] = useState("");
  const [notice, setNotice] = useState(
    "Press once, then say a command such as “upload” or “YouTube”.",
  );
  const recognition = useRef<SpeechRecognitionInstance | null>(null);
  const armedRef = useRef(false);
  const startingRef = useRef(false);
  const listeningEpoch = useRef(0);
  const maximumTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const silenceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const restartTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const resumeAfterSpeech = useRef(false);
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
    if (typeof window === "undefined" || !window.speechSynthesis) return false;
    if (typeof SpeechSynthesisUtterance === "undefined") return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(reply);
    utterance.lang = speechLocale;
    utterance.onend = onDone ?? null;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  function clearListeningTimers() {
    if (maximumTimer.current) clearTimeout(maximumTimer.current);
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (restartTimer.current) clearTimeout(restartTimer.current);
    maximumTimer.current = undefined;
    silenceTimer.current = undefined;
    restartTimer.current = undefined;
  }

  function stopListening(
    message = "Voice actions are off. Your saved triggers are ready for next time.",
  ) {
    listeningEpoch.current += 1;
    armedRef.current = false;
    startingRef.current = false;
    resumeAfterSpeech.current = false;
    clearListeningTimers();
    const current = recognition.current;
    recognition.current = null;
    try {
      current?.stop();
    } catch {
      /* Recognition may already have ended; stopping is intentionally idempotent. */
    }
    setArmed(false);
    setNotice(message);
  }

  function resetSilenceTimer(epoch: number) {
    if (!armedRef.current || epoch !== listeningEpoch.current) return;
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    silenceTimer.current = setTimeout(() => {
      if (epoch !== listeningEpoch.current || !armedRef.current) return;
      stopListening("Voice actions stopped after 8 seconds without speech.");
    }, SILENCE_TIMEOUT_MS);
  }

  useEffect(() => {
    if (!editedTriggers) return;
    try {
      localStorage.setItem(
        TRIGGER_STORAGE_NAME,
        JSON.stringify(editedTriggers),
      );
    } catch {
      /* Voice triggers still work for this session when storage is unavailable. */
    }
  }, [editedTriggers]);

  useEffect(
    () => () => {
      armedRef.current = false;
      listeningEpoch.current += 1;
      clearListeningTimers();
      try {
        recognition.current?.stop();
      } catch {
        /* The component is unmounting; there is nothing left to recover. */
      }
      recognition.current = null;
    },
    [],
  );

  useEffect(() => {
    if (voiceBusy && armedRef.current) {
      stopListening(
        "Voice actions paused while Ursly is busy with another action.",
      );
    }
  }, [voiceBusy]);

  useEffect(() => {
    function stopWhenHidden() {
      if (document.visibilityState !== "visible" && armedRef.current)
        stopListening("Voice actions stopped when this page was hidden.");
    }
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () =>
      document.removeEventListener("visibilitychange", stopWhenHidden);
  }, []);

  function runAction(trigger: VoiceTrigger, transcript = trigger.phrase) {
    if (voiceBusy) {
      stopListening(
        "Voice actions paused while Ursly is busy with another action.",
      );
      return;
    }
    if (trigger.action === "voice" && !canStartVoice) {
      if (armedRef.current) stopListening();
      setNotice(
        "Add a PDF or YouTube source first, then say “let’s talk” again.",
      );
      return;
    }
    const continueListening =
      armedRef.current &&
      !["upload", "voice", "cancel"].includes(trigger.action);
    if (continueListening) {
      stopListening("Voice actions are preparing for the next command.");
      resumeAfterSpeech.current = true;
    } else if (
      armedRef.current &&
      ["upload", "voice", "cancel"].includes(trigger.action)
    ) {
      stopListening();
    }
    setNotice(
      `Triggered “${trigger.phrase}” · ${actionLabels[trigger.action]}.`,
    );
    const resumed = speak(
      actionReplies[trigger.action],
      continueListening
        ? () => {
            if (!resumeAfterSpeech.current || voiceBusy) return;
            resumeAfterSpeech.current = false;
            startListening();
          }
        : undefined,
    );
    if (continueListening && !resumed) {
      resumeAfterSpeech.current = false;
      startListening();
    }
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
    if (nextPhrase.length > MAX_TRIGGER_LENGTH) {
      setNotice(
        `Keep trigger phrases to ${MAX_TRIGGER_LENGTH} characters or fewer.`,
      );
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
    if (!editingId && triggers.length >= MAX_SAVED_TRIGGERS) {
      setNotice(`You can save up to ${MAX_SAVED_TRIGGERS} voice triggers.`);
      return;
    }
    const next: VoiceTrigger = {
      id:
        editingId ??
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `trigger-${Date.now()}-${Math.random().toString(36).slice(2)}`),
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

  function startListening() {
    if (armedRef.current || startingRef.current || voiceBusy) return;
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
    const epoch = listeningEpoch.current + 1;
    listeningEpoch.current = epoch;
    startingRef.current = true;
    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = speechLocale;
    instance.onstart = () => {
      if (
        epoch !== listeningEpoch.current ||
        recognition.current !== instance
      ) {
        try {
          instance.stop();
        } catch {
          /* Ignore a stale recognition instance. */
        }
        return;
      }
      startingRef.current = false;
      handledTriggers.current.clear();
      setArmed(true);
      setNotice(
        `Listening for ${triggersRef.current.map((item) => `“${item.phrase}”`).join(", ")}.`,
      );
      resetSilenceTimer(epoch);
    };
    instance.onresult = (event) => {
      if (epoch !== listeningEpoch.current || recognition.current !== instance)
        return;
      const transcript = Array.from(
        { length: event.results.length - event.resultIndex },
        (_, index) =>
          event.results[event.resultIndex + index]?.[0]?.transcript ?? "",
      )
        .join(" ")
        .trim();
      if (!transcript) return;
      resetSilenceTimer(epoch);
      setHeard(transcript);
      for (const match of findMatches(transcript, triggersRef.current)) {
        if (handledTriggers.current.has(match.id)) continue;
        handledTriggers.current.add(match.id);
        runAction(match, transcript);
        if (!armedRef.current) break;
      }
    };
    instance.onerror = (event) => {
      if (epoch !== listeningEpoch.current || recognition.current !== instance)
        return;
      const error = (event as Event & { error?: string }).error;
      stopListening(
        error === "not-allowed" || error === "service-not-allowed"
          ? "Voice actions need microphone access. Check the browser permission and try again."
          : "Voice recognition stopped unexpectedly. Press Arm voice actions to try again.",
      );
    };
    instance.onend = () => {
      if (epoch !== listeningEpoch.current || recognition.current !== instance)
        return;
      startingRef.current = false;
      setArmed(false);
      setNotice("Voice actions are reconnecting to the microphone…");
      if (!armedRef.current) {
        return;
      }
      restartTimer.current = setTimeout(() => {
        if (
          epoch !== listeningEpoch.current ||
          !armedRef.current ||
          recognition.current !== instance
        )
          return;
        try {
          instance.start();
        } catch {
          stopListening(
            "Voice actions stopped. Press Arm voice actions to restart them.",
          );
        }
      }, RESTART_DELAY_MS);
    };
    recognition.current = instance;
    armedRef.current = true;
    try {
      instance.start();
    } catch {
      clearListeningTimers();
      armedRef.current = false;
      startingRef.current = false;
      recognition.current = null;
      setNotice(
        "Voice actions could not start. Check microphone permissions and try again.",
      );
      return;
    }
    maximumTimer.current = setTimeout(() => {
      if (epoch === listeningEpoch.current && armedRef.current)
        stopListening(
          "Voice actions stopped after 30 seconds for your privacy.",
        );
    }, MAX_LISTENING_MS);
  }

  const examplesToShow = examples.slice(0, 4);

  return (
    <section
      className="voice-commands"
      aria-labelledby="voice-actions-heading"
      data-armed={armed}
    >
      <div className="voice-commands-row">
        <button
          type="button"
          className="voice-mic"
          disabled={voiceBusy}
          aria-pressed={armed}
          onClick={armed ? () => stopListening() : startListening}
        >
          <span className="voice-mic-ring" aria-hidden="true" />
          <Icon name="voice" />
          <span className="voice-mic-label">
            {armed ? t("Stop listening") : t("Speak a command")}
          </span>
        </button>
        <div className="voice-commands-status" role="status" aria-live="polite">
          <strong id="voice-actions-heading">
            {armed ? t("Listening for a command") : t("Voice to action")}
          </strong>
          <span>{t(notice)}</span>
        </div>
      </div>

      <div
        className="voice-example-row"
        aria-label={t("Voice command examples")}
      >
        <span className="voice-example-say">{t("Say")}</span>
        {examplesToShow.map((example) => (
          <button
            key={example.phrase}
            type="button"
            className="voice-example"
            disabled={voiceBusy}
            aria-label={`“${t(example.phrase)}” ${t(example.label)}`}
            title={t(example.label)}
            onClick={() => runExample(example)}
          >
            “{t(example.phrase)}”
          </button>
        ))}
      </div>

      {heard && (
        <p className="voice-heard" role="status">
          {t("Heard:")} <strong>{heard}</strong>
        </p>
      )}

      <details
        className="voice-customize"
        open={open}
        onToggle={(event) => setOpen(event.currentTarget.open)}
      >
        <summary>{t("Customize commands")}</summary>
        <div id="voice-trigger-builder" className="voice-trigger-builder">
          <div className="voice-trigger-builder-copy">
            <h3>{t("Build a trigger")}</h3>
            <p>
              {t(
                "The phrases stay on this device. Every action is configurable, including the built-in Back, Next, and Cancel commands.",
              )}
            </p>
          </div>
          <form className="voice-trigger-form" onSubmit={saveTrigger}>
            <div className="voice-trigger-field">
              <label htmlFor="voice-trigger-phrase">
                {t("Trigger word or phrase")}
              </label>
              <input
                id="voice-trigger-phrase"
                value={phrase}
                onChange={(event) => setPhrase(event.target.value)}
                placeholder={t("e.g. upload")}
                autoComplete="off"
              />
            </div>
            <div className="voice-trigger-field">
              <label htmlFor="voice-trigger-action">
                {t("When I say it…")}
              </label>
              <select
                id="voice-trigger-action"
                value={action}
                onChange={(event) =>
                  setAction(event.target.value as VoiceActionId)
                }
              >
                {Object.entries(actionLabels).map(([id, label]) => (
                  <option key={id} value={id}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="primary"
              type="submit"
              disabled={!normalize(phrase)}
            >
              {editingId ? t("Update trigger") : t("Save trigger")}
            </button>
          </form>

          <div className="saved-trigger-list">
            {triggers.length === 0 ? (
              <p className="hint">
                {t("No saved triggers yet. Start with “upload” or “YouTube”.")}
              </p>
            ) : (
              triggers.map((trigger) => (
                <div className="saved-trigger" key={trigger.id}>
                  <span className="saved-trigger-phrase">
                    “{trigger.phrase}”
                  </span>
                  <span className="saved-trigger-action">
                    {t(actionLabels[trigger.action])}
                  </span>
                  <div className="saved-trigger-actions">
                    <button
                      type="button"
                      className="saved-trigger-remove"
                      aria-label={t("Edit trigger {phrase}", {
                        phrase: trigger.phrase,
                      })}
                      onClick={() => {
                        setPhrase(trigger.phrase);
                        setAction(trigger.action);
                        setEditingId(trigger.id);
                        setOpen(true);
                      }}
                    >
                      {t("Edit")}
                    </button>
                    <button
                      type="button"
                      className="saved-trigger-remove"
                      aria-label={t("Remove trigger {phrase}", {
                        phrase: trigger.phrase,
                      })}
                      onClick={() =>
                        setTriggers((current) =>
                          current.filter((item) => item.id !== trigger.id),
                        )
                      }
                    >
                      {t("Remove")}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          {!supported && (
            <p className="hint voice-support-note">
              {t(
                "Live speech recognition is not available in this browser. The example buttons still preview every action.",
              )}
            </p>
          )}
          {!canStartVoice && (
            <p className="hint voice-support-note">
              {t(
                "Start voice chat becomes available after you add a PDF or YouTube source.",
              )}
            </p>
          )}
          <p className="hint voice-support-note">
            {t(
              "For uploads, your browser still asks you to confirm the local file; websites cannot read arbitrary files without that confirmation.",
            )}
          </p>
        </div>
      </details>
    </section>
  );
}
