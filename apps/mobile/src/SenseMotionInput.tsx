import { CameraView, useCameraPermissions } from "expo-camera";
import { Accelerometer } from "expo-sensors";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { palette as c } from "./design";
import type { MotionCameraViewProps } from "./MotionCameraView";
import {
  createPermissionSession,
  createTiltReader,
  type TiltAction,
} from "./senseSession";
import { SENSE_TEST_MODE, senseTestInputs } from "./senseTestInputs";

/** A real camera thumbnail and physical device tilt, without simulated tracking. */
export function SenseMotionInput(props: MotionCameraViewProps) {
  const { t, controlRef, onActivityChange } = props;
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraPending, setCameraPending] = useState(false);
  const [sensorPending, setSensorPending] = useState(false);
  const [sensorActive, setSensorActive] = useState(false);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState(0);
  const chosenRef = useRef(0);
  const cameraWanted = useRef(false);
  const mockActive = useRef(false);
  const sensorWanted = useRef(false);
  const sensor = useRef<{ remove(): void } | null>(null);
  const tilt = useRef(createTiltReader());
  const live = useRef({ props, permission, requestPermission });
  useLayoutEffect(() => {
    live.current = { props, permission, requestPermission };
  });

  const runMotionAction = useCallback((action: TiltAction) => {
    const current = live.current.props;
    if (current.fileBrowserOpen && current.onFileNav) {
      current.onFileNav({ type: action === "ask" ? "openSelected" : action });
      return;
    }
    if (action === "ask") {
      const prompt = current.prompts[chosenRef.current];
      if (current.canAsk && prompt) current.onAsk(prompt);
      return;
    }
    const count = Math.max(1, current.prompts.length);
    const next =
      (chosenRef.current + (action === "next" ? 1 : -1) + count) % count;
    chosenRef.current = next;
    setChosen(next);
  }, []);

  const cameraGate = useRef<ReturnType<typeof createPermissionSession> | null>(
    null,
  );
  const motionGate = useRef<ReturnType<typeof createPermissionSession> | null>(
    null,
  );
  useEffect(() => {
    const camera = createPermissionSession({
      request: async () =>
        Boolean(
          live.current.permission?.granted ||
          (await live.current.requestPermission()).granted,
        ),
      open: () => {
        cameraWanted.current = true;
        setCameraVisible(true);
      },
      close: () => {
        cameraWanted.current = false;
        setCameraVisible(false);
        setCameraReady(false);
      },
      pending: setCameraPending,
      denied: () =>
        setError(
          live.current.props.t(
            "Camera access was denied. Allow it in Settings and restart the experience.",
          ),
        ),
    });
    const motion = createPermissionSession({
      request: async () => {
        if (!(await Accelerometer.isAvailableAsync())) return false;
        return (await Accelerometer.requestPermissionsAsync()).granted;
      },
      open: () => {
        tilt.current.reset();
        sensorWanted.current = true;
        Accelerometer.setUpdateInterval(100);
        sensor.current = Accelerometer.addListener((sample) => {
          if (!sensorWanted.current) return;
          const action = tilt.current.read(sample, Date.now());
          if (!action) return;
          runMotionAction(action);
        });
        setSensorActive(true);
      },
      close: () => {
        sensorWanted.current = false;
        sensor.current?.remove();
        sensor.current = null;
        tilt.current.reset();
        setSensorActive(false);
      },
      pending: setSensorPending,
      denied: () =>
        setError(
          live.current.props.t(
            "Motion is unavailable on this device. Voice and typing still work.",
          ),
        ),
    });

    cameraGate.current = camera;
    motionGate.current = motion;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background") {
        mockActive.current = false;
        camera.stop();
        motion.stop();
      }
    });
    return () => {
      subscription.remove();
      mockActive.current = false;
      camera.dispose();
      motion.dispose();
      cameraGate.current = null;
      motionGate.current = null;
    };
  }, [runMotionAction]);

  useImperativeHandle(
    controlRef,
    () => ({
      start() {
        setError("");
        if (SENSE_TEST_MODE) {
          mockActive.current = true;
          setSensorActive(true);
          return;
        }
        cameraGate.current?.start();
        motionGate.current?.start();
      },
      stop() {
        mockActive.current = false;
        cameraGate.current?.stop();
        motionGate.current?.stop();
      },
    }),
    [],
  );

  useEffect(() => {
    onActivityChange?.({
      active: cameraReady || sensorActive,
      connecting:
        cameraPending || sensorPending || (cameraVisible && !cameraReady),
    });
  }, [
    cameraReady,
    sensorActive,
    cameraPending,
    sensorPending,
    cameraVisible,
    onActivityChange,
  ]);

  useEffect(() => {
    if (!SENSE_TEST_MODE) return;
    return senseTestInputs.subscribe((input) => {
      if (input.type === "motion" && mockActive.current)
        runMotionAction(input.action);
    });
  }, [runMotionAction]);

  return (
    <>
      {SENSE_TEST_MODE && sensorActive ? (
        <View pointerEvents="none" style={s.preview}>
          <Text style={s.prompt}>
            {props.prompts[chosen % Math.max(1, props.prompts.length)] ??
              t("Simulated inputs")}
          </Text>
        </View>
      ) : null}
      {cameraVisible && (
        <View
          pointerEvents="none"
          style={s.preview}
          accessibilityLabel={t("Camera on")}
        >
          <CameraView
            style={s.camera}
            facing="front"
            mode="picture"
            mute
            onCameraReady={() => {
              if (cameraWanted.current) setCameraReady(true);
            }}
            onMountError={() => {
              cameraGate.current?.stop();
              setError(
                t(
                  "The camera could not be started. Restart the experience to retry.",
                ),
              );
            }}
          />
          <Text style={s.prompt}>
            {props.prompts[chosen % Math.max(1, props.prompts.length)] ?? ""}
          </Text>
        </View>
      )}
      {error ? (
        <Text accessibilityRole="alert" style={s.error}>
          {error}
        </Text>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  preview: {
    position: "absolute",
    right: 8,
    bottom: 72,
    width: 116,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.white,
  },
  camera: { width: "100%", height: 88 },
  prompt: { color: c.ink, padding: 8, fontSize: 10, lineHeight: 14 },
  error: {
    color: c.error,
    fontSize: 12,
    lineHeight: 17,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
});
