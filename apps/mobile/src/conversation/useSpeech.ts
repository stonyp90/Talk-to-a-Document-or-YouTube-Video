import { useCallback, useRef } from "react";
import * as Speech from "expo-speech";

export function useSpeech(speed = 1.0) {
  const speakingRef = useRef(false);
  const speedRef = useRef(speed);
  speedRef.current = speed;

  const speak = useCallback((text: string) => {
    if (speakingRef.current) Speech.stop();
    speakingRef.current = true;
    Speech.speak(text, {
      language: "en-US",
      pitch: 1.0,
      rate: speedRef.current,
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
