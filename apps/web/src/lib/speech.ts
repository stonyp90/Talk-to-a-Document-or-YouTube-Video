/**
 * The browser speech engine, wrapped so the rest of the interface never has to
 * think about it. Two things the raw API gets wrong for a conversation:
 *
 * It hands back the whole session's results on every event, so a naive reader
 * replays old phrases. And it mixes settled text with hypotheses it is still
 * revising, so acting on every result fires commands on words nobody said —
 * "back" while the speaker is still on their way to "backpack". Callers here
 * get each new phrase once, labelled with whether the engine has settled on it.
 *
 * The engine also hangs up by itself after a pause on most platforms. Listening
 * survives that: it restarts until the caller stops it, or until nobody has
 * spoken for the quiet limit, which is what stops a forgotten tab.
 */

/** How long to wait before picking the microphone back up after a hang-up. */
const RESTART_DELAY_MS = 250;
/** Silence after which listening ends on its own, for a tab left open. */
const DEFAULT_QUIET_LIMIT_MS = 120_000;

export type SpeechPhrase = { text: string; final: boolean };
export type SpeechErrorReason = "denied" | "unavailable" | "failed";

type RecognitionAlternative = { transcript?: string };
type RecognitionResult = {
  [index: number]: RecognitionAlternative | undefined;
  isFinal?: boolean;
};
type RecognitionResultList = {
  [index: number]: RecognitionResult | undefined;
  length: number;
};
type RecognitionEvent = {
  resultIndex?: number;
  results: RecognitionResultList;
};

type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  onresult: ((event: RecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type RecognitionConstructor = new () => Recognition;
type SpeechWindow = Window & {
  SpeechRecognition?: RecognitionConstructor;
  webkitSpeechRecognition?: RecognitionConstructor;
};

function engineConstructor(): RecognitionConstructor | undefined {
  if (typeof window === "undefined") return undefined;
  const speechWindow = window as SpeechWindow;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

export function speechRecognitionSupported(): boolean {
  return Boolean(engineConstructor());
}

export type SpeechListenerOptions = {
  language: string;
  onPhrase: (phrase: SpeechPhrase) => void;
  onError?: (reason: SpeechErrorReason) => void;
  onListeningChange?: (listening: boolean) => void;
  /** Silence after which listening stops on its own. */
  quietLimitMs?: number;
};

export type SpeechListener = {
  start: () => void;
  stop: () => void;
  listening: () => boolean;
  setLanguage: (language: string) => void;
};

export function createSpeechListener({
  language,
  onPhrase,
  onError,
  onListeningChange,
  quietLimitMs = DEFAULT_QUIET_LIMIT_MS,
}: SpeechListenerOptions): SpeechListener {
  let engine: Recognition | undefined;
  let wanted = false;
  let current = language;
  let generation = 0;
  let restart: ReturnType<typeof setTimeout> | undefined;
  let quiet: ReturnType<typeof setTimeout> | undefined;
  let delivered = 0;

  const announce = (listening: boolean) => onListeningChange?.(listening);

  function clearTimers() {
    if (restart) clearTimeout(restart);
    if (quiet) clearTimeout(quiet);
    restart = undefined;
    quiet = undefined;
  }

  function stop() {
    const wasWanted = wanted;
    wanted = false;
    generation++;
    clearTimers();
    const stopping = engine;
    engine = undefined;
    try {
      stopping?.stop();
    } catch {
      /* The engine may already have ended; stopping is idempotent by design. */
    }
    if (wasWanted) announce(false);
  }

  function markActivity() {
    if (!wanted) return;
    if (quiet) clearTimeout(quiet);
    quiet = setTimeout(stop, quietLimitMs);
  }

  function open() {
    const Engine = engineConstructor();
    if (!Engine) {
      wanted = false;
      onError?.("unavailable");
      return;
    }
    let instance: Recognition;
    try {
      instance = new Engine();
    } catch {
      wanted = false;
      onError?.("failed");
      announce(false);
      return;
    }
    const epoch = ++generation;
    const stale = () => epoch !== generation || engine !== instance;

    instance.continuous = true;
    instance.interimResults = true;
    instance.lang = current;
    instance.maxAlternatives = 1;
    // Each engine session numbers its results from zero, so the count of what
    // has already been handed on resets with it.
    delivered = 0;

    instance.onstart = () => {
      if (stale()) return;
      announce(true);
      markActivity();
    };

    instance.onresult = (event) => {
      if (stale()) return;
      markActivity();
      const results = event.results;
      const from = Math.max(event.resultIndex ?? 0, delivered);
      for (let index = from; index < results.length; index++) {
        const result = results[index];
        const text = (result?.[0]?.transcript ?? "").trim();
        const final = Boolean(result?.isFinal);
        if (final) delivered = index + 1;
        if (text) onPhrase({ text, final });
      }
    };

    instance.onerror = (event) => {
      if (stale()) return;
      const reason = (event as Event & { error?: string }).error;
      // Silence and an aborted session are ordinary; the engine simply ends and
      // the restart below picks the microphone back up.
      if (reason === "no-speech" || reason === "aborted") return;
      if (reason === "not-allowed" || reason === "service-not-allowed") {
        stop();
        onError?.("denied");
        return;
      }
      onError?.("failed");
    };

    instance.onend = () => {
      if (stale()) return;
      engine = undefined;
      if (!wanted) {
        announce(false);
        return;
      }
      restart = setTimeout(() => {
        if (wanted) open();
      }, RESTART_DELAY_MS);
    };

    engine = instance;
    try {
      instance.start();
    } catch {
      engine = undefined;
      wanted = false;
      clearTimers();
      onError?.("failed");
      announce(false);
    }
  }

  return {
    start() {
      if (wanted) return;
      wanted = true;
      open();
    },
    stop,
    listening: () => wanted,
    setLanguage(next: string) {
      if (next === current) return;
      current = next;
      if (!wanted) return;
      // A live engine cannot change language; take it down and bring it back.
      const resume = () => {
        wanted = true;
        open();
      };
      stop();
      resume();
    },
  };
}
