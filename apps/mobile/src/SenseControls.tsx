import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Animated, AppState, Easing, StyleSheet, Text, View } from "react-native";
import { palette as c, Touch, Wave } from "./design";
import {
  MobileVoiceActions,
  type MobileVoiceActionsProps,
} from "./VoiceActions";
import {
  MotionCameraView,
  type MotionCameraViewProps,
} from "./MotionCameraView";
import {
  createNativeSenseSession,
  type NativeSenseActivity,
  type NativeSenseChannelActivity,
  type NativeSenseChannelControl,
} from "./senseSession";
export type { NativeSenseActivity } from "./senseSession";
export { SenseTestControls, SENSE_TEST_MODE } from "./senseTestInputs";

type Managed = "presentation" | "controlRef" | "onActivityChange";
export type MobileSenseControlsProps = Omit<MobileVoiceActionsProps, Managed> &
  Pick<
    MotionCameraViewProps,
    "prompts" | "canAsk" | "onAsk" | "fileBrowserOpen" | "onFileNav"
  > & {
    onActivityChange?: (activity: NativeSenseActivity) => void;
    onStop?: () => void;
  };
const IDLE: NativeSenseChannelActivity = { active: false, connecting: false };
const TRANSCRIPT_FADE_MS = 4000;

export function MobileSenseControls(props: MobileSenseControlsProps) {
  const voice = useRef<NativeSenseChannelControl>(null);
  const motion = useRef<NativeSenseChannelControl>(null);
  const current = useRef(props);
  useLayoutEffect(() => {
    current.current = props;
  });
  const [speech, setSpeech] = useState(IDLE);
  const [camera, setCamera] = useState(IDLE);
  const [liveText, setLiveText] = useState("");
  const [liveFinal, setLiveFinal] = useState(false);
  const [detectedLang, setDetectedLang] = useState<string>("");
  const transcriptOpacity = useRef(new Animated.Value(0)).current;
  const transcriptTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const session = useRef<ReturnType<typeof createNativeSenseSession> | null>(
    null,
  );
  const { onActivityChange } = props;
  const connecting = speech.connecting || camera.connecting;
  const active =
    speech.active || camera.active || connecting || props.voiceBusy;

  const languageLabels: Record<string, string> = {
    "en-US": "English",
    "fr-FR": "Français",
    "en": "English",
    "fr": "Français",
  };

  const showTranscript = (text: string, isFinal: boolean, lang?: string) => {
    setLiveText(text);
    setLiveFinal(isFinal);
    if (lang) setDetectedLang(lang);
    transcriptOpacity.setValue(1);
    if (transcriptTimer.current) clearTimeout(transcriptTimer.current);
    if (isFinal) {
      transcriptTimer.current = setTimeout(() => {
        Animated.timing(transcriptOpacity, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }).start();
      }, TRANSCRIPT_FADE_MS);
    }
  };

  useEffect(() => {
    if (!active) {
      setLiveText("");
      setLiveFinal(false);
      setDetectedLang("");
      transcriptOpacity.setValue(0);
    }
  }, [active, transcriptOpacity]);

  useEffect(() => {
    onActivityChange?.({
      listening: speech.active,
      motion: camera.active,
      connecting,
    });
  }, [speech.active, camera.active, connecting, onActivityChange]);
  useEffect(() => {
    const controller = createNativeSenseSession({
      voice: () => voice.current,
      motion: () => motion.current,
      onStop: () => current.current.onStop?.(),
    });
    session.current = controller;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") controller.stop();
    });
    return () => {
      subscription.remove();
      controller.stop();
      session.current = null;
    };
  }, []);

  return (
    <View style={s.root}>
      <Animated.View
        style={[
          s.transcriptBar,
          { opacity: transcriptOpacity },
          liveFinal && s.transcriptFinal,
        ]}
        pointerEvents="none"
      >
        {detectedLang && (
          <View style={s.langBadge}>
            <Text style={s.langBadgeText}>
              {languageLabels[detectedLang] || detectedLang}
            </Text>
          </View>
        )}
        <Text style={s.transcriptText} numberOfLines={2}>
          {liveText}
        </Text>
      </Animated.View>
      <Touch
        label={props.t(active ? "Stop experience" : "Start experience")}
        motion={props.motion}
        selected={active}
        onPress={() =>
          active ? session.current?.stop() : session.current?.start()
        }
        style={[s.control, active && s.active]}
      >
        <View style={s.controlContent}>
          <Wave
            motion={props.motion && active}
            color={c.accent}
          />
          <Text style={[s.label, active && s.activeLabel]}>
            {props.t(active ? "Stop experience" : "Start experience")}
          </Text>
          {!active && <View style={s.betaBadge}><Text style={s.betaText}>BETA</Text></View>}
          <View style={[s.signal, active && s.activeSignal]} />
        </View>
      </Touch>
      <MobileVoiceActions
        {...props}
        presentation="merged"
        controlRef={voice}
        onActivityChange={setSpeech}
        onTranscript={(text, isFinal, lang) => showTranscript(text, isFinal, lang)}
      />
      <MotionCameraView
        {...props}
        presentation="merged"
        controlRef={motion}
        onActivityChange={setCamera}
        onClose={() => session.current?.stop()}
      />
    </View>
  );
}
const s = StyleSheet.create({
  root: {
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "100%",
    position: "relative",
    alignItems: "center",
    gap: 4,
  },
  control: {
    minHeight: 50,
    minWidth: 180,
    maxWidth: "100%",
    flexShrink: 1,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.white,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  active: { backgroundColor: "transparent", borderColor: c.accent, borderWidth: 2 },
  controlContent: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    color: c.ink,
    fontWeight: "700",
    fontSize: 14,
    flexShrink: 1,
    textAlign: "center",
  },
  activeLabel: { color: c.accent },
  betaBadge: {
    backgroundColor: c.muted,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  betaText: {
    color: c.white,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  signal: { width: 6, height: 6, borderRadius: 3, backgroundColor: c.line },
  activeSignal: { backgroundColor: c.accent },
  transcriptBar: {
    backgroundColor: c.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    maxWidth: "90%",
    borderWidth: 1,
    borderColor: c.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  transcriptFinal: {
    borderColor: c.accent,
  },
  langBadge: {
    backgroundColor: c.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  langBadgeText: {
    color: c.white,
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  transcriptText: {
    color: c.ink,
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
});
