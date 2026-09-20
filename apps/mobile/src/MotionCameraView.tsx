import { CameraView, useCameraPermissions } from "expo-camera";
import React, { useCallback, useEffect, useMemo, useRef, useState, type Ref } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { createFaceReader } from "@talk/core/domain/faceTracking";
import type { FaceReading } from "@talk/core/domain/faceTracking";
import { createBodyReader } from "@talk/core/domain/bodyTracking";
import type { BodyReading, BodyGestureId } from "@talk/core/domain/bodyTracking";
import { palette as c, serif } from "./design";
import { SenseMotionInput } from "./SenseMotionInput";
import type { NativeSenseChannelControl, NativeSenseChannelActivity } from "./senseSession";
import {
  createSimulatedFaceDetector,
  DEFAULT_FACE_TRACKING_CONFIG,
  type FaceTrackingConfig,
} from "./faceTracking";
import {
  createSimulatedBodyDetector,
  DEFAULT_BODY_TRACKING_CONFIG,
  type BodyTrackingConfig,
} from "./bodyTracking";
import { medium } from "./haptics";
import type { TranslationKey } from "./i18n";
import type { MobileVoiceActionId } from "./VoiceActions";
import type { FileNavAction } from "../../../packages/core/src/domain/fileNavigation";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export type MotionCameraViewProps = {
  presentation?: "panel" | "merged";
  controlRef?: Ref<NativeSenseChannelControl>;
  onActivityChange?: (activity: NativeSenseChannelActivity) => void;
  prompts: readonly string[];
  canAsk: boolean;
  fileBrowserOpen?: boolean;
  onAsk: (prompt: string) => void;
  onAction: (action: MobileVoiceActionId) => void;
  onFileNav?: (action: FileNavAction) => void;
  onClose: () => void;
  t: (key: TranslationKey) => string;
};

type GestureTrigger = {
  id: string;
  gesture: string;
  actionName: string;
  timestamp: string;
  color: string;
};

function SettingSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const steps = Math.round((max - min) / step);
  const currentStep = Math.round((value - min) / step);

  return (
    <View style={ss.container}>
      <View style={ss.header}>
        <Text style={ss.label}>{label}</Text>
        <Text style={ss.value}>{format(value)}</Text>
      </View>
      <View style={ss.trackRow}>
        <Pressable
          style={ss.stepButton}
          onPress={() => {
            const next = Math.max(min, value - step);
            onChange(Math.round(next * 1000) / 1000);
          }}
        >
          <Text style={ss.stepText}>-</Text>
        </Pressable>
        <View style={ss.track}>
          <View style={[ss.trackFill, { flex: currentStep }]} />
          <View style={[ss.trackEmpty, { flex: steps - currentStep }]} />
        </View>
        <Pressable
          style={ss.stepButton}
          onPress={() => {
            const next = Math.min(max, value + step);
            onChange(Math.round(next * 1000) / 1000);
          }}
        >
          <Text style={ss.stepText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export function MotionCameraView(props: MotionCameraViewProps) {
  return props.presentation === "merged" ? <SenseMotionInput {...props} /> : <MotionCameraPanel {...props} />;
}

function MotionCameraPanel({
  prompts,
  canAsk,
  fileBrowserOpen = false,
  onAsk,
  onAction,
  onFileNav,
  onClose,
  t,
}: MotionCameraViewProps) {
  const [chosenPromptIndex, setChosenPromptIndex] = useState(0);
  const [activeGesture, setActiveGesture] = useState<string | null>(null);
  const [lastTrigger, setLastTrigger] = useState<GestureTrigger | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [eyeFocused, setEyeFocused] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [faceConfig, setFaceConfig] = useState<FaceTrackingConfig>(
    DEFAULT_FACE_TRACKING_CONFIG,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [faceReading, setFaceReading] = useState<FaceReading>({ present: false });
  const [blinkCount, setBlinkCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [bodyConfig, setBodyConfig] = useState<BodyTrackingConfig>(
    DEFAULT_BODY_TRACKING_CONFIG,
  );
  const [bodyReading, setBodyReading] = useState<BodyReading>({ present: false });
  const [bodyGestureCount, setBodyGestureCount] = useState(0);
  const [lastBodyGesture, setLastBodyGesture] = useState<BodyGestureId | null>(null);

  const faceReaderRef = useRef(createFaceReader(faceConfig));
  const detectorRef = useRef(createSimulatedFaceDetector());
  const bodyReaderRef = useRef(createBodyReader(bodyConfig));
  const bodyDetectorRef = useRef(createSimulatedBodyDetector());
  const fpsCounterRef = useRef({ frames: 0, lastAt: Date.now() });

  useEffect(() => {
    faceReaderRef.current.configure(faceConfig);
  }, [faceConfig]);

  useEffect(() => {
    if (permission?.status === "undetermined") {
      requestPermission();
    }
  }, [permission?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const leftEyeAnim = useMemo(
    () => new Animated.ValueXY({ x: -45, y: 0 }),
    [],
  );
  const rightEyeAnim = useMemo(
    () => new Animated.ValueXY({ x: 45, y: 0 }),
    [],
  );
  const handAnim = useMemo(
    () => new Animated.ValueXY({ x: 0, y: 110 }),
    [],
  );
  const handPulseAnim = useMemo(() => new Animated.Value(1), []);
  const triggerCardOpacity = useMemo(() => new Animated.Value(0), []);

  // Body tracking joint positions (animated)
  const bodyJoints = useMemo(
    () => ({
      head: new Animated.ValueXY({ x: 0, y: -80 }),
      leftShoulder: new Animated.ValueXY({ x: -60, y: -40 }),
      rightShoulder: new Animated.ValueXY({ x: 60, y: -40 }),
      leftHand: new Animated.ValueXY({ x: -90, y: 30 }),
      rightHand: new Animated.ValueXY({ x: 90, y: 30 }),
      torso: new Animated.ValueXY({ x: 0, y: 0 }),
      leftFoot: new Animated.ValueXY({ x: -40, y: 140 }),
      rightFoot: new Animated.ValueXY({ x: 40, y: 140 }),
    }),
    [],
  );

  const currentPrompt =
    prompts[chosenPromptIndex % Math.max(1, prompts.length)] ??
    "What are the key points of this source?";

  // Action dispatcher with HUD visual trigger
  const fireAction = useCallback(
    (gesture: string, actionName: string, execute: () => void, color = c.coral) => {
      medium();
      setActiveGesture(gesture);
      const time = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setLastTrigger({
        id: Math.random().toString(36).slice(2),
        gesture,
        actionName,
        timestamp: time,
        color,
      });

      triggerCardOpacity.setValue(1);
      Animated.sequence([
        Animated.timing(triggerCardOpacity, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.delay(1800),
        Animated.timing(triggerCardOpacity, {
          toValue: 0.85,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      execute();
    },
    [triggerCardOpacity],
  );

  // Face tracking detection loop at ~15fps
  useEffect(() => {
    if (!trackingEnabled) return;
    let active = true;
    const intervalMs = 66; // ~15fps

    const tick = () => {
      if (!active) return;
      const detection = detectorRef.current.detect();
      const reading = faceReaderRef.current.read(detection);
      setFaceReading(reading);

      // Body tracking detection
      const bodyDetection = bodyDetectorRef.current.detect();
      if (bodyDetection) {
        const bodyRead = bodyReaderRef.current.read(bodyDetection);
        setBodyReading(bodyRead);

        // Fire body gesture if detected
        if (bodyRead.gesture) {
          handleBodyGesture(bodyRead.gesture);
        }

        // Animate body joint positions based on landmarks
        const lm = bodyDetection.landmarks;
        const scale = 200;
        const offsetX = (bodyRead.position?.x ?? 0.5) - 0.5;
        const offsetY = (bodyRead.position?.y ?? 0.45) - 0.45;
        Animated.parallel([
          Animated.timing(bodyJoints.head, {
            toValue: { x: (lm.nose.x - 0.5) * scale, y: (lm.nose.y - 0.45) * scale },
            duration: intervalMs,
            useNativeDriver: true,
          }),
          Animated.timing(bodyJoints.leftShoulder, {
            toValue: { x: (lm.leftShoulder.x - 0.5) * scale, y: (lm.leftShoulder.y - 0.45) * scale },
            duration: intervalMs,
            useNativeDriver: true,
          }),
          Animated.timing(bodyJoints.rightShoulder, {
            toValue: { x: (lm.rightShoulder.x - 0.5) * scale, y: (lm.rightShoulder.y - 0.45) * scale },
            duration: intervalMs,
            useNativeDriver: true,
          }),
          Animated.timing(bodyJoints.leftHand, {
            toValue: { x: (lm.leftWrist.x - 0.5) * scale, y: (lm.leftWrist.y - 0.45) * scale },
            duration: intervalMs,
            useNativeDriver: true,
          }),
          Animated.timing(bodyJoints.rightHand, {
            toValue: { x: (lm.rightWrist.x - 0.5) * scale, y: (lm.rightWrist.y - 0.45) * scale },
            duration: intervalMs,
            useNativeDriver: true,
          }),
          Animated.timing(bodyJoints.torso, {
            toValue: { x: offsetX * scale, y: offsetY * scale },
            duration: intervalMs,
            useNativeDriver: true,
          }),
          Animated.timing(bodyJoints.leftFoot, {
            toValue: { x: (lm.leftAnkle.x - 0.5) * scale, y: (lm.leftAnkle.y - 0.45) * scale },
            duration: intervalMs,
            useNativeDriver: true,
          }),
          Animated.timing(bodyJoints.rightFoot, {
            toValue: { x: (lm.rightAnkle.x - 0.5) * scale, y: (lm.rightAnkle.y - 0.45) * scale },
            duration: intervalMs,
            useNativeDriver: true,
          }),
        ]).start();
      }

      // FPS counter
      const counter = fpsCounterRef.current;
      counter.frames++;
      const now = Date.now();
      if (now - counter.lastAt >= 1000) {
        setFps(counter.frames);
        counter.frames = 0;
        counter.lastAt = now;
      }

      if (reading.blinked) {
        setBlinkCount((c) => c + 1);
        handleEyeFocus();
      }

      if (reading.present && reading.position && reading.eyes) {
        // Map face position (0-1) to overlay coordinates
        // Face guide is 270x340 centered on screen
        // Eyes hub is at top:90, 140 wide, centered
        const faceX = (reading.position.x - 0.5) * 80;
        const faceY = (reading.position.y - 0.4) * 60;

        // Eye positions driven by gaze direction
        const gazeX = (reading.gaze?.x ?? 0) * 12;
        const gazeY = (reading.gaze?.y ?? 0) * 8;

        // Eye openness affects reticle size (simulated via offset)
        const leftOpen = reading.eyes.left.openness;
        const rightOpen = reading.eyes.right.openness;
        const leftSquint = (1 - leftOpen) * 6;
        const rightSquint = (1 - rightOpen) * 6;

        Animated.parallel([
          Animated.timing(leftEyeAnim, {
            toValue: { x: -45 + faceX + gazeX, y: faceY + gazeY + leftSquint },
            duration: intervalMs,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(rightEyeAnim, {
            toValue: { x: 45 + faceX + gazeX, y: faceY + gazeY + rightSquint },
            duration: intervalMs,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(handAnim, {
            toValue: { x: faceX * 0.6, y: 110 + faceY * 0.5 },
            duration: intervalMs * 1.5,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      }
    };

    const id = setInterval(tick, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [trackingEnabled, faceConfig]); // eslint-disable-line react-hooks/exhaustive-deps

  // Pulsing energy for hand tracking
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(handPulseAnim, {
          toValue: 1.15,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(handPulseAnim, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    pulse.start();
    return () => pulse.stop();
  }, [handPulseAnim]);

  // Gestures Handlers
  const handleSwipeLeft = useCallback(() => {
    if (fileBrowserOpen) {
      fireAction("SWIPE LEFT ↤", "File: Previous", () => {
        onFileNav?.({ type: "prev" });
      }, c.gestureGaze);
      return;
    }
    fireAction("SWIPE LEFT ↤", "Previous Question", () => {
      setChosenPromptIndex((idx) => (idx > 0 ? idx - 1 : prompts.length - 1));
    });
  }, [fireAction, prompts.length, fileBrowserOpen, onFileNav]);

  const handleSwipeRight = useCallback(() => {
    if (fileBrowserOpen) {
      fireAction("SWIPE RIGHT ↦", "File: Next", () => {
        onFileNav?.({ type: "next" });
      }, c.gestureGaze);
      return;
    }
    fireAction("SWIPE RIGHT ↦", "Next Question", () => {
      setChosenPromptIndex((idx) => idx + 1);
    });
  }, [fireAction, fileBrowserOpen, onFileNav]);

  const handleHandWave = useCallback(() => {
    fireAction(
      "HAND WAVE ✋",
      `Ask: "${currentPrompt.slice(0, 26)}..."`,
      () => {
        onAsk(currentPrompt);
      },
      c.gestureWave,
    );
  }, [currentPrompt, fireAction, onAsk]);

  const handleSwipeUp = useCallback(() => {
    if (fileBrowserOpen) {
      fireAction("SWIPE UP ↥", "File: Open", () => {
        onFileNav?.({ type: "openSelected" });
      }, c.gestureWave);
      return;
    }
    fireAction(
      "SWIPE UP ↥",
      "Summarize Document",
      () => {
        onAction("summarize");
      },
      c.gestureSummarize,
    );
  }, [fireAction, onAction, fileBrowserOpen, onFileNav]);

  const handleSwipeDown = useCallback(() => {
    if (fileBrowserOpen) {
      fireAction("SWIPE DOWN ↧", "File: Go Up", () => {
        onFileNav?.({ type: "navigateUp" });
      }, c.gestureCancel);
      return;
    }
    fireAction(
      "SWIPE DOWN ↧",
      "Cancel / Stop",
      () => {
        onAction("cancel");
      },
      c.gestureCancel,
    );
  }, [fireAction, onAction, fileBrowserOpen, onFileNav]);

  const handleEyeFocus = useCallback(() => {
    setEyeFocused(true);
    fireAction(
      "EYE GAZE LOCK 👁️",
      "Select & Highlight Prompt",
      () => {
        setChosenPromptIndex((idx) => idx + 1);
      },
      c.gestureGaze,
    );
    setTimeout(() => setEyeFocused(false), 1200);
  }, [fireAction]);

  // Body gesture handlers - full body tracking actions
  const handleBodyGesture = useCallback(
    (gesture: BodyGestureId) => {
      setLastBodyGesture(gesture);
      setBodyGestureCount((c) => c + 1);

      // When the file browser is open, remap body gestures to file navigation
      if (fileBrowserOpen) {
        switch (gesture) {
          case "leanLeft":
            fireAction("LEAN LEFT ↤", "File: Previous", () => {
              onFileNav?.({ type: "prev" });
            }, c.gestureGaze);
            break;
          case "leanRight":
            fireAction("LEAN RIGHT ↦", "File: Next", () => {
              onFileNav?.({ type: "next" });
            }, c.gestureGaze);
            break;
          case "nod":
            fireAction("NOD", "File: Open", () => {
              onFileNav?.({ type: "openSelected" });
            }, c.gestureWave);
            break;
          case "shake":
            fireAction("HEAD SHAKE", "File: Go Up", () => {
              onFileNav?.({ type: "navigateUp" });
            }, c.gestureCancel);
            break;
          default:
            break;
        }
        return;
      }

      switch (gesture) {
        case "wave":
          fireAction("BODY WAVE", "Ask Current Question", () => {
            onAsk(currentPrompt);
          }, c.gestureWave);
          break;
        case "point":
          fireAction("POINT", "Select Prompt", () => {
            setChosenPromptIndex((idx) => idx + 1);
          }, c.gestureGaze);
          break;
        case "armsUp":
          fireAction("ARMS UP", "Summarize", () => {
            onAction("summarize");
          }, c.gestureSummarize);
          break;
        case "armsDown":
          fireAction("ARMS DOWN", "Cancel", () => {
            onAction("cancel");
          }, c.gestureCancel);
          break;
        case "nod":
          fireAction("NOD", "Confirm / Next", () => {
            setChosenPromptIndex((idx) => idx + 1);
          }, c.gestureGaze);
          break;
        case "shake":
          fireAction("HEAD SHAKE", "Go Back", () => {
            onAction("back");
          }, c.gestureCancel);
          break;
        case "crouch":
          fireAction("CROUCH", "Lower Panel", () => {
            setSettingsOpen((prev) => !prev);
          });
          break;
        case "jump":
          fireAction("JUMP", "Raise Panel", () => {
            setSettingsOpen(false);
          }, c.gestureWave);
          break;
        case "leanLeft":
          handleSwipeLeft();
          break;
        case "leanRight":
          handleSwipeRight();
          break;
        default:
          break;
      }
    },
    [fireAction, currentPrompt, onAsk, onAction, handleSwipeLeft, handleSwipeRight, fileBrowserOpen, onFileNav],
  );

  // PanResponder to allow direct gesture control across the screen
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dx) > 15 || Math.abs(gestureState.dy) > 15,
        onPanResponderRelease: (_, gestureState) => {
          const { dx, dy } = gestureState;
          if (Math.abs(dx) > Math.abs(dy)) {
            if (dx > 40) handleSwipeRight();
            else if (dx < -40) handleSwipeLeft();
          } else {
            if (dy < -40) handleSwipeUp();
            else if (dy > 40) handleSwipeDown();
            else handleHandWave();
          }
        },
      }),
    [handleSwipeLeft, handleSwipeRight, handleSwipeUp, handleSwipeDown, handleHandWave],
  );

  return (
    <View style={s.container} {...panResponder.panHandlers}>
      {/* Real camera feed or permission fallback */}
      {permission?.granted ? (
        <CameraView style={s.cameraViewfinder} facing="front" />
      ) : permission ? (
        <View style={s.permissionDenied}>
          <Text style={s.permissionDeniedTitle}>Camera Access Required</Text>
          <Text style={s.permissionDeniedText}>
            Motion Camera needs permission to access your device camera. Please
            enable it to use the motion gesture controls.
          </Text>
          <Pressable style={s.permissionRetryButton} onPress={requestPermission}>
            <Text style={s.permissionRetryText}>Enable Camera</Text>
          </Pressable>
        </View>
      ) : (
        <View style={[s.cameraViewfinder, { justifyContent: "center", alignItems: "center" }]}>
          <Text style={s.permissionRequestText}>Requesting camera access…</Text>
        </View>
      )}

      {/* Center Face Target Guide with Eye & Hand Tracking Hub */}
      {permission?.granted && (
        <View style={s.faceGuide}>
          <View style={[s.corner, s.cornerTL]} />
          <View style={[s.corner, s.cornerTR]} />
          <View style={[s.corner, s.cornerBL]} />
          <View style={[s.corner, s.cornerBR]} />

          {/* Real-time Tracking Overlays on EYES */}
          {trackingEnabled && (
            <View style={s.eyesHub}>
              {/* Left Eye Reticle */}
              <Animated.View
                style={[
                  s.eyeReticle,
                  eyeFocused && s.eyeFocused,
                  {
                    transform: leftEyeAnim.getTranslateTransform(),
                  },
                ]}
              >
                <View style={s.eyeCrosshairHoriz} />
                <View style={s.eyeCrosshairVert} />
                <View style={s.eyePupil} />
                <Text style={s.trackerLabel}>EYE:L</Text>
              </Animated.View>

              {/* Eye Gaze Vector Line */}
              <View style={s.gazeVector} />

              {/* Right Eye Reticle */}
              <Animated.View
                style={[
                  s.eyeReticle,
                  eyeFocused && s.eyeFocused,
                  {
                    transform: rightEyeAnim.getTranslateTransform(),
                  },
                ]}
              >
                <View style={s.eyeCrosshairHoriz} />
                <View style={s.eyeCrosshairVert} />
                <View style={s.eyePupil} />
                <Text style={s.trackerLabel}>EYE:R</Text>
              </Animated.View>
            </View>
          )}

          {/* Real-time Tracking Overlays on HANDS */}
          {trackingEnabled && (
            <Animated.View
              style={[
                s.handReticle,
                {
                  transform: [
                    ...handAnim.getTranslateTransform(),
                    { scale: handPulseAnim },
                  ],
                },
              ]}
            >
              <View style={s.palmRing} />
              <View style={s.palmCenter} />
              {/* Joint landmarks for fingers */}
              <View style={[s.fingerJoint, { top: -24, left: 14 }]} />
              <View style={[s.fingerJoint, { top: -32, left: 28 }]} />
              <View style={[s.fingerJoint, { top: -30, left: 42 }]} />
              <View style={[s.fingerJoint, { top: -22, left: 54 }]} />
              <View style={[s.fingerJoint, { top: -6, left: -4 }]} />
              <Text style={s.handTrackerLabel}>HAND:TRACKED</Text>
            </Animated.View>
          )}

          {/* Full Body Skeleton Overlay */}
          {trackingEnabled && bodyReading.present && (
            <View style={s.bodyOverlay} pointerEvents="none">
              {/* Skeleton lines */}
              <View style={s.skeletonLines}>
                {/* Left arm line */}
                <Animated.View style={[s.skeletonLine, {
                  position: "absolute",
                  left: 135,
                  top: 170,
                  width: 2,
                  height: 60,
                  backgroundColor: c.hudJoint,
                  opacity: 0.5,
                  transform: [{ rotate: "-30deg" }],
                }]} />
                {/* Right arm line */}
                <Animated.View style={[s.skeletonLine, {
                  position: "absolute",
                  left: 135,
                  top: 170,
                  width: 2,
                  height: 60,
                  backgroundColor: c.hudJoint,
                  opacity: 0.5,
                  transform: [{ rotate: "30deg" }],
                }]} />
              </View>

              {/* Body joints */}
              <Animated.View style={[s.bodyJoint, s.bodyJointHead, { transform: bodyJoints.head.getTranslateTransform() }]}>
                <Text style={s.bodyJointLabel}>HEAD</Text>
              </Animated.View>
              <Animated.View style={[s.bodyJoint, { transform: bodyJoints.leftShoulder.getTranslateTransform() }]} />
              <Animated.View style={[s.bodyJoint, { transform: bodyJoints.rightShoulder.getTranslateTransform() }]} />
              <Animated.View style={[s.bodyJoint, s.bodyJointHand, { transform: bodyJoints.leftHand.getTranslateTransform() }]}>
                <Text style={s.bodyJointLabel}>L</Text>
              </Animated.View>
              <Animated.View style={[s.bodyJoint, s.bodyJointHand, { transform: bodyJoints.rightHand.getTranslateTransform() }]}>
                <Text style={s.bodyJointLabel}>R</Text>
              </Animated.View>
              <Animated.View style={[s.bodyJoint, { transform: bodyJoints.torso.getTranslateTransform() }]} />
              <Animated.View style={[s.bodyJoint, s.bodyJointFoot, { transform: bodyJoints.leftFoot.getTranslateTransform() }]} />
              <Animated.View style={[s.bodyJoint, s.bodyJointFoot, { transform: bodyJoints.rightFoot.getTranslateTransform() }]} />

              {/* Pose & gesture label */}
              {bodyReading.pose && (
                <View style={s.poseLabel}>
                  <Text style={s.poseLabelText}>
                    {bodyReading.pose.toUpperCase()}
                    {bodyReading.gesture ? ` · ${bodyReading.gesture.toUpperCase()}` : ""}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      )}

      {/* 2. Top Status & Navigation Bar */}
      <SafeAreaView style={s.topBar}>
        <View style={s.topBarInner}>
          <View style={s.liveBadge}>
            <View style={[s.liveDot, !faceReading.present && { backgroundColor: c.hudWhite40 }]} />
            <Text style={s.liveText}>
              {faceReading.present ? `FACE ${fps}FPS` : "NO FACE"} · {blinkCount}BL
            </Text>
            <View style={[s.liveDot, { backgroundColor: bodyReading.present ? c.hudLive : c.hudWhite40 }]} />
            <Text style={s.liveText}>
              {bodyReading.present ? "BODY" : "NO BODY"} · {bodyGestureCount}BG
              {lastBodyGesture ? ` · ${lastBodyGesture.toUpperCase()}` : ""}
            </Text>
          </View>

          <View style={s.topRightActions}>
            <Pressable
              style={s.toggleButton}
              onPress={() => setSettingsOpen((prev) => !prev)}
            >
              <Text style={s.toggleButtonText}>
                {settingsOpen ? "CLOSE" : "PARAMS"}
              </Text>
            </Pressable>

            <Pressable
              style={s.toggleButton}
              onPress={() => setTrackingEnabled((prev) => !prev)}
            >
              <Text style={s.toggleButtonText}>
                {trackingEnabled ? "HUD: ON" : "HUD: OFF"}
              </Text>
            </Pressable>

            <Pressable
              style={s.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close Motion View"
              onPress={onClose}
            >
              <Text style={s.closeIcon}>✕</Text>
            </Pressable>
          </View>
        </View>
      </SafeAreaView>

      {/* 3. Real-time Action Trigger Banner (HUD) */}
      <View style={s.hudActionSection}>
        {lastTrigger && (
          <Animated.View
            style={[
              s.triggerBanner,
              {
                borderColor: lastTrigger.color,
                opacity: triggerCardOpacity,
              },
            ]}
          >
            <View
              style={[s.triggerPill, { backgroundColor: lastTrigger.color }]}
            >
              <Text style={s.triggerPillText}>{lastTrigger.gesture}</Text>
            </View>
            <View style={s.triggerDetails}>
              <Text style={s.triggerActionText}>{lastTrigger.actionName}</Text>
              <Text style={s.triggerTime}>Triggered at {lastTrigger.timestamp}</Text>
            </View>
          </Animated.View>
        )}

        {/* Chosen Question Target Card */}
        <View style={s.targetPromptCard}>
          <View style={s.targetPromptHeader}>
            <Text style={s.targetPromptTag}>TARGET QUESTION</Text>
            <Text style={s.targetPromptStep}>
              {chosenPromptIndex + 1} of {Math.max(1, prompts.length)}
            </Text>
          </View>
          <Text numberOfLines={2} style={s.targetPromptText}>
            {currentPrompt}
          </Text>
        </View>

        {/* Direct Action Trigger Controls */}
        <View style={s.quickTriggerRow}>
          <Pressable style={s.gestureChip} onPress={handleSwipeLeft}>
            <Text style={s.gestureChipText}>↤ Prev</Text>
          </Pressable>
          <Pressable
            style={[s.gestureChip, s.gestureChipPrimary]}
            onPress={handleHandWave}
          >
            <Text style={[s.gestureChipText, s.gestureChipPrimaryText]}>
              Wave: Ask
            </Text>
          </Pressable>
          <Pressable style={s.gestureChip} onPress={handleSwipeRight}>
            <Text style={s.gestureChipText}>Next ↦</Text>
          </Pressable>
          <Pressable style={s.gestureChip} onPress={handleSwipeUp}>
            <Text style={s.gestureChipText}>↥ Summary</Text>
          </Pressable>
          <Pressable style={s.gestureChip} onPress={handleEyeFocus}>
            <Text style={s.gestureChipText}>◎ Gaze</Text>
          </Pressable>
        </View>

        {/* Configurable Face Tracking Settings Panel */}
        {settingsOpen && (
          <View style={s.settingsPanel}>
            <Text style={s.settingsTitle}>FACE TRACKING PARAMETERS</Text>
            <ScrollView style={s.settingsScroll} nestedScrollEnabled>
              <View style={s.settingsGrid}>
                <SettingSlider
                  label="Confidence"
                  value={faceConfig.minConfidence}
                  min={0.1}
                  max={1}
                  step={0.05}
                  format={(v) => `${Math.round(v * 100)}%`}
                  onChange={(v) =>
                    setFaceConfig((c) => ({ ...c, minConfidence: v }))
                  }
                />
                <SettingSlider
                  label="Blink Thresh"
                  value={faceConfig.blinkThreshold}
                  min={0.05}
                  max={0.5}
                  step={0.05}
                  format={(v) => v.toFixed(2)}
                  onChange={(v) =>
                    setFaceConfig((c) => ({ ...c, blinkThreshold: v }))
                  }
                />
                <SettingSlider
                  label="Blink Dur ms"
                  value={faceConfig.blinkDurationMs}
                  min={50}
                  max={500}
                  step={10}
                  format={(v) => `${Math.round(v)}ms`}
                  onChange={(v) =>
                    setFaceConfig((c) => ({ ...c, blinkDurationMs: v }))
                  }
                />
                <SettingSlider
                  label="Cooldown ms"
                  value={faceConfig.blinkCooldownMs}
                  min={100}
                  max={2000}
                  step={50}
                  format={(v) => `${Math.round(v)}ms`}
                  onChange={(v) =>
                    setFaceConfig((c) => ({ ...c, blinkCooldownMs: v }))
                  }
                />
                <SettingSlider
                  label="Gaze Dwell"
                  value={faceConfig.gazeDwellMs}
                  min={100}
                  max={2000}
                  step={50}
                  format={(v) => `${Math.round(v)}ms`}
                  onChange={(v) =>
                    setFaceConfig((c) => ({ ...c, gazeDwellMs: v }))
                  }
                />
                <SettingSlider
                  label="Gaze Cols"
                  value={faceConfig.gazeColumns}
                  min={2}
                  max={6}
                  step={1}
                  format={(v) => `${Math.round(v)}`}
                  onChange={(v) =>
                    setFaceConfig((c) => ({ ...c, gazeColumns: v }))
                  }
                />
                <SettingSlider
                  label="Gaze Rows"
                  value={faceConfig.gazeRows}
                  min={2}
                  max={6}
                  step={1}
                  format={(v) => `${Math.round(v)}`}
                  onChange={(v) =>
                    setFaceConfig((c) => ({ ...c, gazeRows: v }))
                  }
                />
              </View>

              {/* Live telemetry */}
              <View style={s.telemetryRow}>
                <View style={s.telemetryItem}>
                  <Text style={s.telemetryLabel}>FACE</Text>
                  <Text style={s.telemetryValue}>
                    {faceReading.present ? "YES" : "NO"}
                  </Text>
                </View>
                {faceReading.position && (
                  <View style={s.telemetryItem}>
                    <Text style={s.telemetryLabel}>POS</Text>
                    <Text style={s.telemetryValue}>
                      {faceReading.position.x.toFixed(2)},{" "}
                      {faceReading.position.y.toFixed(2)}
                    </Text>
                  </View>
                )}
                {faceReading.gaze && (
                  <View style={s.telemetryItem}>
                    <Text style={s.telemetryLabel}>GAZE</Text>
                    <Text style={s.telemetryValue}>
                      {faceReading.gaze.x.toFixed(2)},{" "}
                      {faceReading.gaze.y.toFixed(2)}
                    </Text>
                  </View>
                )}
                {faceReading.eyes && (
                  <View style={s.telemetryItem}>
                    <Text style={s.telemetryLabel}>EYES</Text>
                    <Text style={s.telemetryValue}>
                      L:{faceReading.eyes.left.openness.toFixed(2)}{" "}
                      R:{faceReading.eyes.right.openness.toFixed(2)}
                    </Text>
                  </View>
                )}
                {faceReading.headYaw !== undefined && (
                  <View style={s.telemetryItem}>
                    <Text style={s.telemetryLabel}>YAW</Text>
                    <Text style={s.telemetryValue}>
                      {faceReading.headYaw.toFixed(1)}°
                    </Text>
                  </View>
                )}
              </View>

              {/* Body tracking telemetry */}
              <View style={s.telemetryRow}>
                <View style={s.telemetryItem}>
                  <Text style={s.telemetryLabel}>BODY</Text>
                  <Text style={s.telemetryValue}>
                    {bodyReading.present ? "YES" : "NO"}
                  </Text>
                </View>
                {bodyReading.position && (
                  <View style={s.telemetryItem}>
                    <Text style={s.telemetryLabel}>BODY POS</Text>
                    <Text style={s.telemetryValue}>
                      {bodyReading.position.x.toFixed(2)},{" "}
                      {bodyReading.position.y.toFixed(2)}
                    </Text>
                  </View>
                )}
                {bodyReading.pose && (
                  <View style={s.telemetryItem}>
                    <Text style={s.telemetryLabel}>POSE</Text>
                    <Text style={s.telemetryValue}>
                      {bodyReading.pose.toUpperCase()}
                    </Text>
                  </View>
                )}
                {bodyReading.energy !== undefined && (
                  <View style={s.telemetryItem}>
                    <Text style={s.telemetryLabel}>ENERGY</Text>
                    <Text style={s.telemetryValue}>
                      {(bodyReading.energy * 100).toFixed(0)}%
                    </Text>
                  </View>
                )}
                {bodyReading.movingParts && bodyReading.movingParts.length > 0 && (
                  <View style={s.telemetryItem}>
                    <Text style={s.telemetryLabel}>MOVING</Text>
                    <Text style={s.telemetryValue}>
                      {bodyReading.movingParts.length} PARTS
                    </Text>
                  </View>
                )}
                {bodyReading.gesture && (
                  <View style={s.telemetryItem}>
                    <Text style={s.telemetryLabel}>GESTURE</Text>
                    <Text style={s.telemetryValue}>
                      {bodyReading.gesture.toUpperCase()}
                    </Text>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: c.hudBg,
    zIndex: 9999,
  },
  cameraViewfinder: {
    ...StyleSheet.absoluteFill,
  },
  permissionDenied: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    gap: 12,
  },
  permissionDeniedTitle: {
    color: c.hudText,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  permissionDeniedText: {
    color: c.hudMuted,
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  permissionRetryButton: {
    marginTop: 8,
    backgroundColor: c.coral,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  permissionRetryText: {
    color: c.hudText,
    fontSize: 15,
    fontWeight: "700",
  },
  permissionRequestText: {
    color: c.hudWhite60,
    fontSize: 14,
    fontWeight: "600",
  },
  faceGuide: {
    width: 270,
    height: 340,
    position: "absolute",
    top: "50%",
    left: "50%",
    marginTop: -170,
    marginLeft: -135,
    zIndex: 5,
    borderColor: c.hudSubtleBorder,
    borderWidth: 1,
    borderRadius: 36,
    justifyContent: "center",
    alignItems: "center",
  },
  corner: {
    position: "absolute",
    width: 24,
    height: 24,
    borderColor: c.coral,
  },
  cornerTL: { top: -2, left: -2, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: -2, right: -2, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: -2, left: -2, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: -2, right: -2, borderBottomWidth: 3, borderRightWidth: 3 },

  /* Eyes Hub */
  eyesHub: {
    position: "absolute",
    top: 90,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: 140,
  },
  eyeReticle: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: c.hudReticle,
    backgroundColor: c.hudReticleBg,
    justifyContent: "center",
    alignItems: "center",
  },
  eyeFocused: {
    borderColor: c.hudReticleFocus,
    backgroundColor: c.hudFocusBg,
  },
  eyeCrosshairHoriz: {
    position: "absolute",
    width: 18,
    height: 1,
    backgroundColor: c.hudReticle,
  },
  eyeCrosshairVert: {
    position: "absolute",
    width: 1,
    height: 18,
    backgroundColor: c.hudReticle,
  },
  eyePupil: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: c.hudText,
  },
  trackerLabel: {
    position: "absolute",
    top: -14,
    fontSize: 8,
    fontWeight: "800",
    color: c.hudReticle,
    letterSpacing: 0.8,
  },
  gazeVector: {
    width: 60,
    height: 1,
    backgroundColor: c.hudGazeLine,
  },

  /* Hand Reticles */
  handReticle: {
    position: "absolute",
    width: 68,
    height: 68,
    justifyContent: "center",
    alignItems: "center",
  },
  palmRing: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: c.coral,
    backgroundColor: c.hudPalmBg,
  },
  palmCenter: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: c.coral,
  },
  fingerJoint: {
    position: "absolute",
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: c.hudJoint,
    borderWidth: 1,
    borderColor: c.hudJointBorder,
  },
  handTrackerLabel: {
    position: "absolute",
    bottom: -18,
    width: 120,
    textAlign: "center",
    fontSize: 9,
    fontWeight: "800",
    color: c.coral,
    letterSpacing: 0.9,
  },

  /* Top Bar */
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  topBarInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingRight: 64,
    paddingTop: 8,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.hudPanelBg,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.hudPanelBorder,
    gap: 7,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.hudLive,
  },
  liveText: {
    color: c.hudText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  topRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  toggleButton: {
    backgroundColor: c.hudToggleBg,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  toggleButtonText: {
    color: c.hudText,
    fontSize: 11,
    fontWeight: "700",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: c.hudWhite20,
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    color: c.hudText,
    fontSize: 16,
    fontWeight: "700",
  },

  /* HUD Action Bottom Section */
  hudActionSection: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    gap: 12,
    zIndex: 10,
  },
  triggerBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.hudPanelBgHeavy,
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    shadowColor: c.hudBg,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  triggerPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  triggerPillText: {
    color: c.hudPanel,
    fontSize: 11,
    fontWeight: "900",
  },
  triggerDetails: {
    flex: 1,
  },
  triggerActionText: {
    color: c.hudText,
    fontSize: 14,
    fontWeight: "800",
  },
  triggerTime: {
    color: c.hudWhite50,
    fontSize: 10,
    marginTop: 2,
  },

  /* Target Question Card */
  targetPromptCard: {
    backgroundColor: c.hudWhite10,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: c.hudSubtleLine,
    gap: 6,
  },
  targetPromptHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  targetPromptTag: {
    color: c.coral,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  targetPromptStep: {
    color: c.hudWhite60,
    fontSize: 10,
    fontWeight: "600",
  },
  targetPromptText: {
    color: c.hudText,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: serif,
  },

  /* Action Trigger Row */
  quickTriggerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 6,
  },
  gestureChip: {
    flex: 1,
    backgroundColor: c.hudChipBg,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.hudWhite10,
  },
  gestureChipPrimary: {
    backgroundColor: c.coral,
    borderColor: c.coral,
  },
  gestureChipText: {
    color: c.hudText,
    fontSize: 11,
    fontWeight: "700",
  },
  gestureChipPrimaryText: {
    color: c.hudPanel,
    fontWeight: "900",
  },

  /* Settings Panel */
  settingsPanel: {
    backgroundColor: c.hudPanelBgHeavy,
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: c.hudSubtleBorder,
    gap: 8,
    maxHeight: 280,
  },
  settingsTitle: {
    color: c.coral,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  settingsScroll: {
    maxHeight: 240,
  },
  settingsGrid: {
    gap: 6,
  },
  telemetryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: c.hudSubtleBorder,
  },
  telemetryItem: {
    backgroundColor: c.hudWhite8,
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    minWidth: 60,
  },
  telemetryLabel: {
    color: c.hudWhite50,
    fontSize: 8,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  telemetryValue: {
    color: c.hudReticle,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 1,
  },

  /* Body Tracking Overlay */
  bodyOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
  skeletonLines: {
    ...StyleSheet.absoluteFill,
  },
  skeletonLine: {
    borderRadius: 1,
  },
  bodyJoint: {
    position: "absolute",
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: c.hudJoint,
    borderWidth: 1.5,
    borderColor: c.hudJointBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  bodyJointHead: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: c.hudReticle,
    borderColor: c.hudReticle,
  },
  bodyJointHand: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: c.coral,
    borderColor: c.coral,
  },
  bodyJointFoot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: c.hudJoint,
  },
  bodyJointLabel: {
    position: "absolute",
    top: -12,
    fontSize: 7,
    fontWeight: "800",
    color: c.hudText,
    letterSpacing: 0.6,
  },
  poseLabel: {
    position: "absolute",
    bottom: -30,
    backgroundColor: c.hudPanelBg,
    paddingVertical: 3,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.hudPanelBorder,
  },
  poseLabelText: {
    color: c.hudReticle,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1,
  },
});

const ss = StyleSheet.create({
  container: {
    gap: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  label: {
    color: c.hudWhite70,
    fontSize: 10,
    fontWeight: "700",
  },
  value: {
    color: c.hudReticle,
    fontSize: 10,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  trackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  stepButton: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: c.hudWhite10,
    justifyContent: "center",
    alignItems: "center",
  },
  stepText: {
    color: c.hudText,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 16,
  },
  track: {
    flex: 1,
    height: 4,
    flexDirection: "row",
    borderRadius: 2,
    overflow: "hidden",
  },
  trackFill: {
    backgroundColor: c.hudReticle,
  },
  trackEmpty: {
    backgroundColor: c.hudWhite10,
  },
});
