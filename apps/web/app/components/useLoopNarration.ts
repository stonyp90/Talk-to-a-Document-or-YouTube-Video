"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { SPEECH_DELIVERY, selectSpeechVoice } from "../../src/lib/speechVoice";

/** The locale each language is spoken in, which is not the same as its tag. */
const SPEECH_LOCALES: Record<string, string> = {
  en: "en-US",
  fr: "fr-CA",
};

/**
 * The loop, read aloud.
 *
 * Ursly's argument is that you should be able to listen to a thing instead of
 * reading it, so the page that makes that argument can make it about itself:
 * ask, and the loop names each stage as it reaches it, in the same voice the
 * application answers in.
 *
 * It never starts on its own. Sound that a visitor did not ask for is the
 * oldest bad manner on the web, browsers block it anyway, and a page that
 * began talking would contradict the same restraint that keeps the rest of
 * this screen still once it has arrived.
 */
/** Whether this browser can speak at all. Fixed for the life of the page. */
function subscribeToNothing() {
  return () => {};
}
function canSpeak() {
  return (
    typeof window !== "undefined" &&
    !!window.speechSynthesis &&
    typeof SpeechSynthesisUtterance !== "undefined"
  );
}

export function useLoopNarration(locale: string) {
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  // Read rather than stored: the server has no speech synthesiser, so it must
  // render the control absent and the browser must agree with it until it has
  // hydrated. A state set from an effect would render one thing and then
  // another, which is the flicker this hook exists to avoid.
  const available = useSyncExternalStore(
    subscribeToNothing,
    canSpeak,
    () => false,
  );
  // What was last said, so a re-render on the same stage does not repeat it.
  const spoken = useRef<string | undefined>(undefined);
  const spokenLines = useRef(new Set<string>());
  const queue = useRef<string[]>([]);
  const active = useRef(false);

  useEffect(() => {
    if (!available) return;
    // Voices arrive asynchronously in most browsers; asking once here means a
    // list is usually ready by the time anyone presses the control.
    window.speechSynthesis.getVoices?.();
  }, [available]);

  // Nothing should still be talking after the page is gone.
  useEffect(
    () => () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
    [],
  );

  const stop = useCallback(() => {
    setSpeaking(false);
    setPaused(false);
    spoken.current = undefined;
    spokenLines.current.clear();
    queue.current = [];
    active.current = false;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const say = useCallback(
    (line: string) => {
      if (!speaking || typeof window === "undefined") return;
      if (!window.speechSynthesis) return;
      if (spokenLines.current.has(line) || queue.current.includes(line)) return;
      spoken.current = line;
      spokenLines.current.add(line);
      queue.current.push(line);
      if (active.current) return;
      const spokenLocale = SPEECH_LOCALES[locale] ?? locale;
      const speakNext = () => {
        const next = queue.current.shift();
        if (!next || !speaking) {
          active.current = false;
          if (!next) setSpeaking(false);
          return;
        }
        active.current = true;
        const utterance = new SpeechSynthesisUtterance(next);
        utterance.lang = spokenLocale;
        const chosen = selectSpeechVoice(
          window.speechSynthesis.getVoices?.() ?? [],
          spokenLocale,
        );
        if (chosen) utterance.voice = chosen;
        utterance.rate = SPEECH_DELIVERY.rate;
        utterance.pitch = SPEECH_DELIVERY.pitch;
        utterance.volume = SPEECH_DELIVERY.volume;
        utterance.onend = () => {
          active.current = false;
          speakNext();
        };
        utterance.onerror = () => {
          active.current = false;
          speakNext();
        };
        window.speechSynthesis.speak(utterance);
      };
      speakNext();
    },
    [locale, speaking],
  );

  const pause = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, []);

  const toggle = useCallback(() => {
    setSpeaking((on) => {
      if (on) {
        stop();
        return false;
      }
      spoken.current = undefined;
      spokenLines.current.clear();
      queue.current = [];
      return !on;
    });
  }, [stop]);

  return { speaking, paused, available, toggle, pause, resume, stop, say };
}
