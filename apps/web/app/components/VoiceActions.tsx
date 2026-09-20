"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  type Ref,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { SenseFeedback } from "./SenseFeedback";
import styles from "./SenseControls.module.css";
import type {
  SenseChannelActivity,
  SenseChannelControl,
} from "./senseControlTypes";
import { useLanguage } from "../i18n/LanguageProvider";
import {
  VOICE_ACTIONS,
  carriesOwnPhrasing,
  defaultPhrases,
  defaultTriggers,
  dictationText,
  isLikelyQuestion,
  isSpokenContent,
  matchCommands,
  normalizeSpeech,
  spokenArgument,
  takesSpokenArgument,
  type VoiceActionId,
  type VoiceTrigger,
} from "@/packages/core/src/domain/voiceCommands";
import {
  SPEECH_DELIVERY,
  selectSpeechVoice,
} from "@/apps/web/src/lib/speechVoice";
import { useVoiceSpeed } from "@/apps/web/src/lib/useVoiceSpeed";
import {
  createSpeechListener,
  speechRecognitionSupported,
  type SpeechErrorReason,
  type SpeechListener,
} from "@/apps/web/src/lib/speech";

export type { VoiceActionId };

/** BCP 47 tags the speech engines expect for each interface language. */
const SPEECH_LOCALES = { en: "en-US", fr: "fr-CA" } as const;

const MAX_TRIGGER_LENGTH = 80;
const MAX_SAVED_TRIGGERS = 32;
/** How long a dictated question waits for more words before it is sent. */
const DICTATION_SETTLE_MS = 1600;
/** Spoken confirmations are echoed back by the microphone; ignore that window. */
const ECHO_GUARD_MS = 700;
/** A spoken reply that never ends must not hold the guard open forever. */
const REPLY_GUARD_MS = 4000;
/** Listening ends by itself after this much silence, for a forgotten tab. */
const QUIET_LIMIT_MS = 120_000;

export type VoiceActionsProps = {
  /** The argument carries whatever else was said, for an action that needs it. */
  onAction: (action: VoiceActionId, argument?: string) => void;
  /** A spoken question, ready to send. */
  onDictate: (text: string) => void;
  /** Words heard so far, so the composer can show them landing. */
  onDraft?: (text: string) => void;
  canStartVoice: boolean;
  voiceBusy: boolean;
  /** The conversation phase shows a tighter panel than the source phase. */
  compact?: boolean;
  /** Compact controls for the shared immersive action dock. */
  presentation?: "panel" | "dock" | "merged";
  controlRef?: Ref<SenseChannelControl>;
  feedbackTarget?: HTMLElement | null;
  onActivityChange?: (activity: SenseChannelActivity) => void;
};

const TRIGGER_STORAGE_NAME = "ursly-voice-triggers-v1";

function actionLabels(): Record<VoiceActionId, string> {
  return {
    youtube: "Open the YouTube source tab",
    upload: "Open the PDF upload picker",
    voice: "Start live voice chat",
    summarize: "Ask for a key-ideas summary",
    ask: "Send what I just said",
    stop: "Stop listening or stop the answer",
    back: "Go back or undo the last step",
    next: "Go forward to the next step",
    cancel: "Cancel the current action",
    open: "Open the file browser",
    select: "Select a file with gaze or gesture",
    search: "Search for a file by name",
  };
}

/** Short enough to be over before the speaker has drawn breath. */
function actionReplies(): Partial<Record<VoiceActionId, string>> {
  return {
    youtube: "YouTube.",
    upload: "Opening your files.",
    voice: "Starting voice chat.",
    back: "Going back.",
    next: "Next.",
    cancel: "Cancelled.",
  };
}

function parseSavedTriggers(
  stored: string | null,
  fallback: VoiceTrigger[],
): VoiceTrigger[] {
  try {
    if (stored === null) return fallback;
    const saved = JSON.parse(stored) as unknown;
    if (!Array.isArray(saved)) return [];
    const known = new Set<string>(VOICE_ACTIONS);
    return saved
      .filter(
        (item): item is VoiceTrigger =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as VoiceTrigger).id === "string" &&
          typeof (item as VoiceTrigger).phrase === "string" &&
          typeof (item as VoiceTrigger).action === "string" &&
          known.has((item as VoiceTrigger).action) &&
          Boolean(normalizeSpeech((item as VoiceTrigger).phrase)),
      )
      .filter((item) => item.phrase.length <= MAX_TRIGGER_LENGTH)
      .slice(0, MAX_SAVED_TRIGGERS);
  } catch {
    return [];
  }
}

/**
 * Saved triggers as an external store: the browser holds them, the server
 * snapshot is the built-in set, and a parsed value is cached per raw string so
 * React sees a stable reference between renders.
 */
let savedCache: {
  raw: string | null;
  language: string;
  parsed: VoiceTrigger[];
} = { raw: null, language: "", parsed: [] };

function readSavedTriggers(language: "en" | "fr"): VoiceTrigger[] {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(TRIGGER_STORAGE_NAME);
  } catch {
    raw = null;
  }
  if (savedCache.raw !== raw || savedCache.language !== language)
    savedCache = {
      raw,
      language,
      parsed: parseSavedTriggers(raw, defaultTriggers(language)),
    };
  return savedCache.parsed;
}

function subscribeToTriggerStorage(notify: () => void): () => void {
  window.addEventListener("storage", notify);
  return () => window.removeEventListener("storage", notify);
}

export function VoiceActions({
  onAction,
  onDictate,
  onDraft,
  canStartVoice,
  voiceBusy,
  compact = false,
  presentation = "panel",
  controlRef,
  feedbackTarget,
  onActivityChange,
}: VoiceActionsProps) {
  const { language, t } = useLanguage();
  const { speed: voiceSpeed } = useVoiceSpeed();
  const dock = presentation !== "panel";
  const merged = presentation === "merged";
  // Workspace keeps this target mounted. The post-commit snapshot discovers it
  // without causing an extra state update in an effect during hydration.
  const settingsTarget = useSyncExternalStore(
    () => () => {},
    () => (merged ? document.getElementById("sense-command-settings") : null),
    () => null,
  );
  const labels = useMemo(() => actionLabels(), []);
  const replies = useMemo(() => actionReplies(), []);
  const serverTriggers = useMemo(() => defaultTriggers(language), [language]);
  const savedTriggers = useSyncExternalStore(
    subscribeToTriggerStorage,
    () => readSavedTriggers(language),
    () => serverTriggers,
  );
  const [editedTriggers, setEditedTriggers] = useState<VoiceTrigger[] | null>(
    null,
  );
  const triggers = editedTriggers ?? savedTriggers;

  const browserSupported = useSyncExternalStore(
    () => () => {},
    speechRecognitionSupported,
    () => true,
  );
  const [speechProvider, setSpeechProvider] = useState<"browser" | "realtime">(
    "browser",
  );
  const supported = speechProvider === "realtime" || browserSupported;
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/health", { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then((health) => {
        if (!controller.signal.aborted && health?.commandSpeech === "realtime")
          setSpeechProvider("realtime");
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const [open, setOpen] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [action, setAction] = useState<VoiceActionId>("summarize");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [connectingSpeech, setConnectingSpeech] = useState(false);
  const [heard, setHeard] = useState("");
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState("");
  const [problem, setProblem] = useState("");
  const [editorProblem, setEditorProblem] = useState("");
  const [editorNotice, setEditorNotice] = useState("");

  const listener = useRef<SpeechListener | null>(null);
  const draftRef = useRef("");
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const echoUntil = useRef(0);
  // Every handler below is created once and reads the latest props through
  // these, so changing a prop never tears down a live microphone.
  const latest = useRef({
    onAction,
    onDictate,
    onDraft,
    canStartVoice,
    voiceBusy,
    triggers,
    language,
    voiceSpeed,
  });
  useEffect(() => {
    latest.current = {
      onAction,
      onDictate,
      onDraft,
      canStartVoice,
      voiceBusy,
      triggers,
      language,
      voiceSpeed,
    };
  });

  const setTriggers = useCallback(
    (update: (current: VoiceTrigger[]) => VoiceTrigger[]) =>
      setEditedTriggers((current) =>
        update(current ?? readSavedTriggers(latest.current.language)),
      ),
    [],
  );

  useEffect(() => {
    // Installed voices load lazily, and the list is empty until something asks
    // for it. Asking on mount means the first spoken reply already has one.
    // Not every environment that offers a synthesiser offers a voice list.
    window.speechSynthesis?.getVoices?.();
  }, []);

  useEffect(() => {
    if (!editedTriggers) return;
    try {
      localStorage.setItem(
        TRIGGER_STORAGE_NAME,
        JSON.stringify(editedTriggers),
      );
    } catch {
      /* Triggers still work for this session when storage is unavailable. */
    }
  }, [editedTriggers]);

  const speak = useCallback((reply: string) => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    if (typeof SpeechSynthesisUtterance === "undefined") return;
    const utterance = new SpeechSynthesisUtterance(reply);
    const locale = SPEECH_LOCALES[latest.current.language];
    utterance.lang = locale;
    // The browser default is whichever voice was installed first, and it is
    // often the small robotic one. Voices also arrive asynchronously, so an
    // empty list here simply means the default is used this once.
    const chosen = selectSpeechVoice(
      window.speechSynthesis.getVoices?.() ?? [],
      locale,
    );
    if (chosen) utterance.voice = chosen;
    utterance.rate = latest.current.voiceSpeed;
    utterance.pitch = SPEECH_DELIVERY.pitch;
    utterance.volume = SPEECH_DELIVERY.volume;
    // The reply comes out of the speakers and straight back into the
    // microphone. Rather than closing the microphone — which loses the next
    // sentence — the guard makes listening ignore what it hears meanwhile.
    echoUntil.current = Date.now() + REPLY_GUARD_MS;
    const release = () => {
      echoUntil.current = Date.now() + ECHO_GUARD_MS;
    };
    utterance.onend = release;
    utterance.onerror = release;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }, []);

  const publishDraft = useCallback((text: string) => {
    draftRef.current = text;
    setDraft(text);
    latest.current.onDraft?.(text);
  }, []);

  const sendDraft = useCallback(() => {
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = undefined;
    const text = draftRef.current.trim();
    if (!text) return;
    publishDraft("");
    setHeard("");
    latest.current.onDictate(text);
  }, [publishDraft]);

  const stopListening = useCallback((message = "") => {
    listener.current?.stop();
    setConnectingSpeech(false);
    if (settleTimer.current) clearTimeout(settleTimer.current);
    settleTimer.current = undefined;
    setHeard("");
    setNotice(message);
  }, []);

  const runAction = useCallback(
    (target: VoiceActionId, spoken?: string, argument?: string) => {
      const { canStartVoice: ready, onAction: run } = latest.current;
      if (target === "voice" && !ready) {
        setNotice(t("Add a PDF or YouTube source first, then say it again."));
        return;
      }
      if (target === "ask") {
        sendDraft();
        return;
      }
      if (target === "stop" || target === "cancel") {
        publishDraft("");
        stopListening(
          target === "stop"
            ? t("Stopped listening.")
            : t("Cancelled. Nothing was sent."),
        );
        run(target);
        return;
      }
      // With an argument the page says something far more useful than the
      // shortcut's own name — which video it is opening — so it speaks instead.
      setNotice(
        argument
          ? ""
          : spoken
            ? t("Heard “{spoken}” · {action}.", {
                spoken,
                action: t(labels[target]),
              })
            : `${t(labels[target])}.`,
      );
      const reply = replies[target];
      if (reply && spoken) speak(reply);
      run(target, argument);
    },
    [labels, publishDraft, replies, sendDraft, speak, stopListening, t],
  );

  const handlePhrase = useCallback(
    ({ text, final }: { text: string; final: boolean }) => {
      if (Date.now() < echoUntil.current) return;
      setHeard(text);
      // Acting on a hypothesis fires commands nobody said: "back" on the way to
      // "backpack". Only settled text moves anything.
      if (!final) return;
      const { triggers: available, language: locale } = latest.current;
      const matches = matchCommands(text, available, { language: locale });
      const leftover = dictationText(text, matches);
      const commands = matches.filter(
        (match) => match.trigger.action !== "ask",
      );
      const asked = matches.some((match) => match.trigger.action === "ask");

      // What a command leaves behind is only dictation if something was said.
      // "Can you go back please" is one instruction; treating its leftover as a
      // question would leave "can you please" sitting in the composer.
      const said =
        commands.length === 0
          ? leftover
          : isSpokenContent(leftover)
            ? leftover
            : "";

      // The speaker put their own words around a built-in command: "summarize
      // this in three points" is their request, not the canned one, so the
      // whole sentence goes to the assistant and the shortcut stands aside.
      const rephrased =
        said &&
        isLikelyQuestion(said) &&
        commands.some((match) => carriesOwnPhrasing(match.trigger.action));
      if (rephrased) {
        publishDraft(text);
        sendDraft();
        return;
      }

      // An action that takes an argument claims the rest of the sentence:
      // "YouTube, Miles Davis" is one instruction, not a command and a question.
      const searching = commands.find((match) =>
        takesSpokenArgument(match.trigger.action),
      );
      const argument = searching ? spokenArgument(leftover) : "";
      if (said && !argument) {
        const next = draftRef.current ? `${draftRef.current} ${said}` : said;
        publishDraft(next);
      }
      for (const match of commands)
        runAction(
          match.trigger.action,
          text,
          match === searching && argument ? argument : undefined,
        );
      // The words have been acted on. Leaving them under "Heard" makes a command
      // that is already finished look like a question still waiting to be sent.
      if (commands.length > 0 && !draftRef.current) setHeard("");
      if (!listener.current?.listening()) return;
      if (asked) {
        sendDraft();
        return;
      }
      // Nothing was commanded and the words stand on their own: treat the pause
      // that follows as the end of a question, the way a listener would.
      if (settleTimer.current) clearTimeout(settleTimer.current);
      if (commands.length === 0 && isLikelyQuestion(draftRef.current))
        settleTimer.current = setTimeout(sendDraft, DICTATION_SETTLE_MS);
    },
    [publishDraft, runAction, sendDraft],
  );

  const handleError = useCallback(
    (reason: SpeechErrorReason) => {
      setConnectingSpeech(false);
      setProblem(
        reason === "denied"
          ? t(
              merged
                ? "Microphone access was denied. Allow it in your browser, then restart the experience."
                : "Voice needs microphone access. Allow it in your browser, then press Speak again.",
            )
          : reason === "unavailable"
            ? t(
                dock
                  ? "This browser does not recognise speech. You can still type or add a source."
                  : "This browser does not recognise speech. The buttons below do the same things.",
              )
            : t(
                merged
                  ? "The microphone dropped out. Restart the experience to reconnect."
                  : "The microphone dropped out. Press Speak to pick it back up.",
              ),
      );
    },
    [dock, merged, t],
  );

  const reportListening = useCallback((value: boolean) => {
    setListening(value);
    setConnectingSpeech(false);
  }, []);

  useEffect(() => {
    onActivityChange?.({ active: listening, connecting: connectingSpeech });
  }, [listening, connectingSpeech, onActivityChange]);

  useEffect(() => {
    const instance = createSpeechListener({
      provider: speechProvider,
      language: SPEECH_LOCALES[language],
      quietLimitMs: QUIET_LIMIT_MS,
      onPhrase: handlePhrase,
      onError: handleError,
      onListeningChange: reportListening,
      onConnectingChange: setConnectingSpeech,
    });
    listener.current = instance;
    return () => {
      instance.stop();
      listener.current = null;
    };
    // The listener is built once; language changes are applied below so that a
    // re-render never drops a microphone the reader is speaking into.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleError, handlePhrase, speechProvider]);

  useEffect(() => {
    listener.current?.setLanguage(SPEECH_LOCALES[language]);
  }, [language]);

  useEffect(() => {
    // A live realtime session owns the microphone; two listeners on one device
    // transcribe each other. Release it without touching the notice, which the
    // panel is already showing for the session itself.
    if (voiceBusy) listener.current?.stop();
  }, [voiceBusy]);

  useEffect(() => {
    function pause() {
      if (document.visibilityState !== "visible")
        stopListening(t("Listening stopped when this page was hidden."));
    }
    document.addEventListener("visibilitychange", pause);
    return () => document.removeEventListener("visibilitychange", pause);
  }, [stopListening, t]);

  useEffect(
    () => () => {
      if (settleTimer.current) clearTimeout(settleTimer.current);
    },
    [],
  );

  function startListening() {
    if (latest.current.voiceBusy) return;
    setProblem("");
    if (!supported) {
      handleError("unavailable");
      return;
    }
    setNotice("");
    setConnectingSpeech(true);
    listener.current?.start();
  }

  useImperativeHandle(controlRef, () => ({
    start: startListening,
    stop: () => stopListening(""),
  }));

  function saveTrigger(event: FormEvent) {
    event.preventDefault();
    const reportProblem = merged ? setEditorProblem : setProblem;
    setEditorNotice("");
    const next = phrase.trim();
    if (!normalizeSpeech(next)) {
      reportProblem(
        t("Use at least one letter or number in the trigger phrase."),
      );
      return;
    }
    if (next.length > MAX_TRIGGER_LENGTH) {
      reportProblem(
        t("Keep trigger phrases to {max} characters or fewer.", {
          max: MAX_TRIGGER_LENGTH,
        }),
      );
      return;
    }
    if (
      triggers.some(
        (trigger) =>
          trigger.id !== editingId &&
          normalizeSpeech(trigger.phrase) === normalizeSpeech(next),
      )
    ) {
      reportProblem(t("“{phrase}” is already saved.", { phrase: next }));
      return;
    }
    if (!editingId && triggers.length >= MAX_SAVED_TRIGGERS) {
      reportProblem(
        t("You can save up to {max} voice triggers.", {
          max: MAX_SAVED_TRIGGERS,
        }),
      );
      return;
    }
    const saved: VoiceTrigger = {
      id:
        editingId ??
        (typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `trigger-${Date.now()}-${Math.random().toString(36).slice(2)}`),
      phrase: next,
      action,
    };
    setTriggers((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? saved : item))
        : [...current, saved],
    );
    setPhrase("");
    setEditingId(null);
    reportProblem("");
    const confirmation = t(
      merged
        ? "Saved “{phrase}”. Say it during the experience."
        : "Saved “{phrase}”. Press Speak and say it.",
      { phrase: next },
    );
    if (merged) setEditorNotice(confirmation);
    else setNotice(confirmation);
  }

  const examples = useMemo(() => {
    const phrases = defaultPhrases(language);
    const shown: VoiceActionId[] = canStartVoice
      ? ["summarize", "voice", "next", "stop"]
      : ["upload", "youtube", "summarize", "cancel"];
    return shown.map((id) => ({
      action: id,
      phrase: phrases[id][0] ?? id,
      label: labels[id],
    }));
  }, [canStartVoice, labels, language]);

  const resting = listening
    ? canStartVoice
      ? "Ask your question out loud, or say a command. It sends when you pause."
      : "Say “upload”, or say “YouTube” and the artist or title you want."
    : canStartVoice
      ? "Press Speak, then ask your question out loud. Say “summarize this”, or just talk."
      : "Press Speak, then say a command such as “upload” or “YouTube”.";

  const commandSettings = (
    <details
      className={
        merged
          ? styles.settingsCustomize
          : dock
            ? styles.customize
            : "voice-customize"
      }
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary title={dock ? t("Customize commands") : undefined}>
        {dock && !merged && <span aria-hidden="true">···</span>}
        <span className={dock && !merged ? styles.srOnly : undefined}>
          {t("Customize commands")}
        </span>
      </summary>
      <div
        id="voice-trigger-builder"
        className={
          merged
            ? "voice-trigger-builder"
            : dock
              ? styles.triggerBuilder
              : "voice-trigger-builder"
        }
      >
        {merged && editorProblem && (
          <p className="voice-error" role="alert">
            {editorProblem}
          </p>
        )}
        {merged && editorNotice && (
          <p className="voice-notice" role="status">
            {editorNotice}
          </p>
        )}
        <div className="voice-trigger-builder-copy">
          <h3>{t("Build a trigger")}</h3>
          <p>
            {t(
              "The phrases stay on this device. Every action is configurable, and the built-in wordings keep working alongside yours.",
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
            <label htmlFor="voice-trigger-action">{t("When I say it…")}</label>
            <select
              id="voice-trigger-action"
              value={action}
              onChange={(event) =>
                setAction(event.target.value as VoiceActionId)
              }
            >
              {VOICE_ACTIONS.map((id) => (
                <option key={id} value={id}>
                  {t(labels[id])}
                </option>
              ))}
            </select>
          </div>
          <button
            className="primary"
            type="submit"
            disabled={!normalizeSpeech(phrase)}
          >
            {editingId ? t("Update trigger") : t("Save trigger")}
          </button>
        </form>

        <div className="saved-trigger-list">
          {triggers.length === 0 ? (
            <p className="hint">
              {t("No saved triggers. The built-in wordings still work.")}
            </p>
          ) : (
            triggers.map((trigger) => (
              <div className="saved-trigger" key={trigger.id}>
                <span className="saved-trigger-phrase">“{trigger.phrase}”</span>
                <span className="saved-trigger-action">
                  {t(labels[trigger.action])}
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
        {!supported && !dock && (
          <p className="hint voice-support-note">
            {t(
              "Live speech recognition is not available in this browser. The example buttons still run every action.",
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
  );

  return (
    <section
      className={dock ? styles.voice : "voice-commands"}
      data-speech-provider={speechProvider}
      aria-labelledby={dock ? undefined : "voice-actions-heading"}
      aria-label={dock ? t("Speak") : undefined}
      data-armed={listening}
      data-compact={compact}
    >
      <div className={dock ? styles.controlRow : "voice-commands-row"}>
        {!merged && (
          <button
            type="button"
            className={dock ? styles.speak : "voice-mic"}
            disabled={voiceBusy}
            aria-pressed={listening || connectingSpeech}
            onClick={
              listening || connectingSpeech
                ? () => stopListening("")
                : startListening
            }
          >
            {!dock && <span className="voice-mic-ring" aria-hidden="true" />}
            <Icon name="voice" />
            <span className="voice-mic-label">
              {connectingSpeech
                ? t("Cancel")
                : listening
                  ? t("Stop listening")
                  : t("Speak")}
            </span>
          </button>
        )}
        {!dock && (
          <div
            className="voice-commands-status"
            role="status"
            aria-live="polite"
          >
            <strong id="voice-actions-heading">
              {connectingSpeech
                ? t("Connecting…")
                : listening
                  ? t("Listening")
                  : t("Voice to action")}
            </strong>
            <span>
              {connectingSpeech
                ? t("Getting the microphone ready. You can cancel at any time.")
                : notice || t(resting)}
            </span>
          </div>
        )}
      </div>

      <SenseFeedback target={merged ? feedbackTarget : undefined}>
        <div
          className={dock ? styles.feedback : undefined}
          data-merged={merged || undefined}
          data-sense-channel="voice"
          hidden={
            dock &&
            !(
              connectingSpeech ||
              (!merged && listening) ||
              notice ||
              draft ||
              problem ||
              (listening && heard)
            )
          }
        >
          {dock && (connectingSpeech || (!merged && listening) || notice) && (
            <p className={styles.status} role="status">
              {connectingSpeech ? t("Connecting…") : notice || t("Listening")}
            </p>
          )}

          {(draft || (listening && heard)) && (
            <div className="voice-draft">
              <span className="voice-draft-label">
                {draft ? t("Your question") : t("Heard")}
              </span>
              <span className="voice-draft-text">
                {draft || <em>{heard}</em>}
                {draft && heard && !draft.endsWith(heard) ? (
                  <em> {heard}</em>
                ) : null}
              </span>
              {draft && (
                <div className="voice-draft-actions">
                  <button
                    type="button"
                    className="voice-example"
                    onClick={sendDraft}
                  >
                    {t("Send it")}
                  </button>
                  <button
                    type="button"
                    className="voice-example"
                    onClick={() => publishDraft("")}
                  >
                    {t("Clear")}
                  </button>
                </div>
              )}
            </div>
          )}

          {!dock && (
            <div
              className="voice-example-row"
              aria-label={t("Voice command examples")}
            >
              <span className="voice-example-say">{t("Say")}</span>
              {examples.map((example) => (
                <button
                  key={example.action}
                  type="button"
                  className="voice-example"
                  disabled={voiceBusy}
                  aria-label={`“${example.phrase}” — ${t(example.label)}`}
                  title={t(example.label)}
                  onClick={() => runAction(example.action)}
                >
                  “{example.phrase}”
                </button>
              ))}
            </div>
          )}

          {problem && (
            <p className="voice-error" role="alert">
              {problem}
            </p>
          )}
        </div>
      </SenseFeedback>

      {merged
        ? settingsTarget
          ? createPortal(commandSettings, settingsTarget)
          : null
        : commandSettings}
    </section>
  );
}
