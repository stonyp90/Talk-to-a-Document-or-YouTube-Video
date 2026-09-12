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
import type { Language } from "../i18n/languages";
import {
  SPEECH_DELIVERY,
  selectSpeechVoice,
} from "@/apps/web/src/lib/speechVoice";
import {
  VOICE_ACTION_IDS,
  actionHint,
  actionLabel,
  actionReply,
  defaultTriggers,
  matchTriggers,
  normalizeSpoken,
  spokenExamples,
  type SpokenExample,
  type VoiceActionId,
  type VoiceTrigger,
} from "@/apps/web/src/lib/voiceCommands";

/** BCP 47 tags the speech engines expect for each interface language. */
const SPEECH_LOCALES = { en: "en-US", fr: "fr-CA" } as const;

export type { VoiceActionId };

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
  /** The words spoken after the keyword, if any: “YouTube Pennywise”. */
  onAction: (action: VoiceActionId, argument?: string) => void;
  canStartVoice: boolean;
  voiceBusy: boolean;
};

const MAX_TRIGGER_LENGTH = 80;
const MAX_SAVED_TRIGGERS = 32;
const MAX_LISTENING_MS = 30_000;
const SILENCE_TIMEOUT_MS = 8_000;
/** Longest a spoken confirmation may hold the microphone before listening resumes. */
const REPLY_GUARD_MS = 4_000;
const RESTART_DELAY_MS = 250;

const TRIGGER_STORAGE_NAME = "ursly-voice-triggers-v1";

/**
 * The default set per language, kept by reference: React compares snapshots
 * identity-first, so a freshly built array on every read would never settle.
 */
const defaultsByLanguage = new Map<Language, VoiceTrigger[]>();
function defaults(language: Language): VoiceTrigger[] {
  const existing = defaultsByLanguage.get(language);
  if (existing) return existing;
  const built = defaultTriggers(language);
  defaultsByLanguage.set(language, built);
  return built;
}

/**
 * Stored triggers are the caller's customisations, not the whole vocabulary.
 * They used to REPLACE the defaults, so anyone who had ever opened the editor
 * was frozen with whatever was armed that day — and a corrupt or emptied value
 * disarmed the microphone permanently. Every action without a stored wording
 * now keeps its default, and an unreadable value falls back to all of them.
 */
export function parseSavedTriggers(
  stored: string | null,
  language: Language,
): VoiceTrigger[] {
  const withDefaults = (saved: VoiceTrigger[]) => {
    const claimed = new Set(saved.map((trigger) => trigger.action));
    return [
      ...saved,
      ...defaults(language).filter((trigger) => !claimed.has(trigger.action)),
    ];
  };
  try {
    if (stored === null) return defaults(language);
    const saved = JSON.parse(stored) as unknown;
    if (!Array.isArray(saved)) return defaults(language);
    return withDefaults(
      saved
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
              normalizeSpoken(item.phrase) &&
              (VOICE_ACTION_IDS as readonly string[]).includes(item.action),
          ),
        )
        .filter((item) => item.phrase.length <= MAX_TRIGGER_LENGTH)
        .slice(0, MAX_SAVED_TRIGGERS),
    );
  } catch {
    return defaults(language);
  }
}

/**
 * The saved triggers as an external store: browser storage is the source, the
 * server snapshot is the default set, and the parsed value is cached per raw
 * string so React sees a stable reference between renders.
 */
let savedTriggersCache: {
  raw: string | null;
  language?: Language;
  parsed: VoiceTrigger[];
} = { raw: null, parsed: [] };
function readSavedTriggers(language: Language): VoiceTrigger[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(TRIGGER_STORAGE_NAME);
  } catch {
    raw = null;
  }
  if (
    savedTriggersCache.raw !== raw ||
    savedTriggersCache.language !== language
  )
    savedTriggersCache = {
      raw,
      language,
      parsed: parseSavedTriggers(raw, language),
    };
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
    useCallback(() => readSavedTriggers(language), [language]),
    useCallback(() => defaults(language), [language]),
  );
  const [editedTriggers, setEditedTriggers] = useState<VoiceTrigger[] | null>(
    null,
  );
  const triggers = editedTriggers ?? savedTriggers;
  const setTriggers = useCallback(
    (update: (current: VoiceTrigger[]) => VoiceTrigger[]) =>
      setEditedTriggers((current) =>
        update(current ?? readSavedTriggers(language)),
      ),
    [language],
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
  // Nothing said yet: the opening line quotes the words this language answers
  // to, so the caller never has to guess which wording will work.
  const [notice, setNotice] = useState<string | null>(null);
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

  useEffect(() => {
    // Installed voices load lazily, and the list is empty until something asks
    // for it. Asking on mount means the first spoken reply already has one.
    window.speechSynthesis?.getVoices();
  }, []);

  function speak(reply: string, onDone?: () => void) {
    if (typeof window === "undefined" || !window.speechSynthesis) return false;
    if (typeof SpeechSynthesisUtterance === "undefined") return false;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(reply);
    utterance.lang = speechLocale;
    // The browser default is whichever voice was installed first, and it is
    // often the small robotic one. Voices also arrive asynchronously, so an
    // empty list here simply means the default is used this once.
    const chosen = selectSpeechVoice(
      window.speechSynthesis.getVoices(),
      speechLocale,
    );
    if (chosen) utterance.voice = chosen;
    utterance.rate = SPEECH_DELIVERY.rate;
    utterance.pitch = SPEECH_DELIVERY.pitch;
    utterance.volume = SPEECH_DELIVERY.volume;
    // A browser without a voice never reports the end of an utterance. The
    // microphone must not stay closed behind a reply nobody hears, so the
    // hand-back happens on end, on error, or after the reply's own length.
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(guard);
      onDone?.();
    };
    const guard = window.setTimeout(settle, REPLY_GUARD_MS);
    utterance.onend = settle;
    utterance.onerror = settle;
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

  function runAction(trigger: VoiceTrigger, argument = "") {
    if (voiceBusy) {
      stopListening(
        "Voice actions paused while Ursly is busy with another action.",
      );
      return;
    }
    if (trigger.action === "voice" && !canStartVoice) {
      if (armedRef.current) stopListening();
      setNotice(
        t("Add a PDF or YouTube source first, then say “{phrase}” again.", {
          phrase:
            spokenExamples(language).find(
              (example) => example.action === "voice",
            )?.phrase ?? "",
        }),
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
      t("Triggered “{phrase}” · {action}.", {
        phrase: trigger.phrase,
        action: t(actionLabel(trigger.action)),
      }),
    );
    // The confirmation is spoken, so it has to be in the language the voice is
    // speaking: an English sentence read by a French voice is unintelligible.
    const resumed = speak(
      t(actionReply(trigger.action)),
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
    onActionRef.current(trigger.action, argument);
  }

  function runExample(example: SpokenExample) {
    runAction(
      {
        id: `example-${example.action}`,
        phrase: example.phrase,
        action: example.action,
        aliases: example.aliases,
      },
      example.phrase,
    );
  }

  function saveTrigger(event: FormEvent) {
    event.preventDefault();
    const nextPhrase = phrase.trim();
    const normalizedPhrase = normalizeSpoken(nextPhrase);
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
          normalizeSpoken(trigger.phrase) === normalizedPhrase,
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
      `${editingId ? "Updated" : "Saved"} trigger: ${nextPhrase}. Press Speak a command and say it to run the action.`,
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
      // Built with t() rather than a template literal: this is the one line
      // shown at the instant the microphone opens, and it was reaching French
      // callers in English.
      setNotice(
        t("Listening for {phrases}.", {
          phrases: triggersRef.current
            .map((item) => `“${item.phrase}”`)
            .join(", "),
        }),
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
      for (const match of matchTriggers(transcript, triggersRef.current)) {
        if (handledTriggers.current.has(match.id)) continue;
        handledTriggers.current.add(match.id);
        runAction(match, match.argument);
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
          : "Voice recognition stopped unexpectedly. Press Speak a command to try again.",
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
            "Voice actions stopped. Press Speak a command to restart them.",
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

  const spoken = spokenExamples(language);
  const examplesToShow = spoken.slice(0, 4);
  const wordsFor = (id: VoiceActionId) =>
    spoken.find((example) => example.action === id)?.phrase ?? "";
  const opening = t(
    "Press once, then say a command such as “{first}” or “{second}”.",
    { first: wordsFor("upload"), second: wordsFor("youtube") },
  );

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
          <span>{notice === null ? opening : t(notice)}</span>
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
            aria-label={`“${example.phrase}” ${t(example.hint)}`}
            title={t(example.hint)}
            onClick={() => runExample(example)}
          >
            “{example.phrase}”
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
                {VOICE_ACTION_IDS.map((id) => (
                  <option key={id} value={id}>
                    {t(actionLabel(id))}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="primary"
              type="submit"
              disabled={!normalizeSpoken(phrase)}
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
                    {t(actionLabel(trigger.action))}
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
