import { useState, useEffect, useRef, useCallback } from "react";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

export function useGalaxyVoice() {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const transcriptRef = useRef("");

  useEffect(() => {
    const resultSub = ExpoSpeechRecognitionModule.addListener(
      "result",
      (event: { isFinal: boolean; results: { transcript: string }[] }) => {
        if (event.results.length > 0) {
          const text = event.results[0].transcript;
          transcriptRef.current = text;
          setTranscript(text);
        }
      },
    );

    const endSub = ExpoSpeechRecognitionModule.addListener("end", () => {
      setListening(false);
    });

    const errorSub = ExpoSpeechRecognitionModule.addListener(
      "error",
      () => {
        setListening(false);
      },
    );

    return () => {
      resultSub.remove();
      endSub.remove();
      errorSub.remove();
    };
  }, []);

  const toggleListening = useCallback(async () => {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }

    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;

    transcriptRef.current = "";
    setTranscript("");
    setListening(true);
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: true,
      continuous: true,
    });
  }, [listening]);

  return { transcript, listening, toggleListening };
}
