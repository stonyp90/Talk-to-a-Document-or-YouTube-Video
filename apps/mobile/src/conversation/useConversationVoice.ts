import { useEffect, useRef, useCallback } from "react";
import { ExpoSpeechRecognitionModule } from "expo-speech-recognition";

export function useConversationVoice(
  active: boolean,
  onUserSpeech: (text: string) => void,
) {
  const listeningRef = useRef(false);

  useEffect(() => {
    if (!active) return;

    const resultSub = ExpoSpeechRecognitionModule.addListener(
      "result",
      (event: { isFinal: boolean; results: { transcript: string }[] }) => {
        if (event.isFinal && event.results.length > 0) {
          const text = event.results[0].transcript.trim();
          if (text) onUserSpeech(text);
        }
      },
    );

    const errorSub = ExpoSpeechRecognitionModule.addListener("error", () => {
      listeningRef.current = false;
    });

    return () => {
      resultSub.remove();
      errorSub.remove();
    };
  }, [active, onUserSpeech]);

  const startListening = useCallback(async () => {
    if (listeningRef.current) return;
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;
    listeningRef.current = true;
    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: false,
      continuous: true,
    });
  }, []);

  const stopListening = useCallback(() => {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { startListening, stopListening };
}
