import { useCallback, useRef } from "react";
import * as Speech from "expo-speech";

export function useSpeech() {
  const speakingRef = useRef(false);

  const speak = useCallback((text: string) => {
    if (speakingRef.current) Speech.stop();
    speakingRef.current = true;
    Speech.speak(text, {
      language: "en-US",
      pitch: 1.0,
      rate: 0.95,
      onDone: () => {
        speakingRef.current = false;
      },
      onStopped: () => {
        speakingRef.current = false;
      },
    });
  }, []);

  const stop = useCallback(() => {
    if (!speakingRef.current) return;
    speakingRef.current = false;
    Speech.stop();
  }, []);

  return { speak, stop };
}
