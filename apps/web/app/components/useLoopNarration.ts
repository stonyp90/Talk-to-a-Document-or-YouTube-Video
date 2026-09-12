"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
export function useLoopNarration(locale: string) {
  const [speaking, setSpeaking] = useState(false);
  const [available, setAvailable] = useState(false);
  // What was last said, so a re-render on the same stage does not repeat it.
  const spoken = useRef<string | undefined>(undefined);

  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      !!window.speechSynthesis &&
      typeof SpeechSynthesisUtterance !== "undefined";
    setAvailable(supported);
    if (!supported) return;
    // Voices arrive asynchronously in most browsers; asking once here means a
    // list is usually ready by the time anyone presses the control.
    window.speechSynthesis.getVoices?.();
  }, []);

  // Nothing should still be talking after the page is gone.
  useEffect(
    () => () => {
      if (typeof window !== "undefined") window.speechSynthesis?.cancel();
    },
    [],
  );

  const stop = useCallback(() => {
    setSpeaking(false);
    spoken.current = undefined;
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  }, []);

  const say = useCallback(
    (line: string) => {
      if (!speaking || typeof window === "undefined") return;
      if (!window.speechSynthesis) return;
      if (spoken.current === line) return;
      spoken.current = line;
      const spokenLocale = SPEECH_LOCALES[locale] ?? locale;
      const utterance = new SpeechSynthesisUtterance(line);
      utterance.lang = spokenLocale;
      // The browser's own default is whichever voice was installed first, and
      // it is usually the small robotic one; this picks the best one present.
      const chosen = selectSpeechVoice(
        window.speechSynthesis.getVoices?.() ?? [],
        spokenLocale,
      );
      if (chosen) utterance.voice = chosen;
      utterance.rate = SPEECH_DELIVERY.rate;
      utterance.pitch = SPEECH_DELIVERY.pitch;
      utterance.volume = SPEECH_DELIVERY.volume;
      // One stage at a time: the walk moves on whether or not the last line
      // finished, and two voices over each other is worse than a line missed.
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    },
    [locale, speaking],
  );

  const toggle = useCallback(() => {
    setSpeaking((on) => {
      if (on && typeof window !== "undefined") window.speechSynthesis?.cancel();
      spoken.current = undefined;
      return !on;
    });
  }, []);

  return { speaking, available, toggle, stop, say };
}
