import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  PanResponder,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { palette as c, serif } from "./design";
import type { TranslationKey } from "./i18n";
import type { MobileVoiceActionId } from "./VoiceActions";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export type MotionCameraViewProps = {
  prompts: readonly string[];
  canAsk: boolean;
  onAsk: (prompt: string) => void;
  onAction: (action: MobileVoiceActionId) => void;
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

export function MotionCameraView({
  prompts,
  canAsk,
  onAsk,
  onAction,
  onClose,
  t,
}: MotionCameraViewProps) {
  const [chosenPromptIndex, setChosenPromptIndex] = useState(0);
  const [activeGesture, setActiveGesture] = useState<string | null>(null);
  const [lastTrigger, setLastTrigger] = useState<GestureTrigger | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [eyeFocused, setEyeFocused] = useState(false);

  // Position coordinates using Translate Transforms (100% native driver supported)
  const leftEyeAnim = useRef(
    new Animated.ValueXY({ x: -45, y: 0 }),
  ).current;
  const rightEyeAnim = useRef(
    new Animated.ValueXY({ x: 45, y: 0 }),
  ).current;
  const handAnim = useRef(
    new Animated.ValueXY({ x: 0, y: 110 }),
  ).current;
  const handPulseAnim = useRef(new Animated.Value(1)).current;
  const triggerCardOpacity = useRef(new Animated.Value(0)).current;

  const currentPrompt =
    prompts[chosenPromptIndex % Math.max(1, prompts.length)] ??
    "What are the key points of this source?";

  // Action dispatcher with HUD visual trigger
  const fireAction = useCallback(
    (gesture: string, actionName: string, execute: () => void, color = c.coral) => {
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

  // Continuous realistic tracking movement for Hand & Eyes
  useEffect(() => {
    let active = true;
    const animateTracking = () => {
      if (!active) return;
      const eyeDx = (Math.random() - 0.5) * 16;
      const eyeDy = (Math.random() - 0.5) * 12;
      const handDx = (Math.random() - 0.5) * 40;
      const handDy = (Math.random() - 0.5) * 30;

      Animated.parallel([
        Animated.timing(leftEyeAnim, {
          toValue: {
            x: -45 + eyeDx,
            y: eyeDy,
          },
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(rightEyeAnim, {
          toValue: {
            x: 45 + eyeDx,
            y: eyeDy,
          },
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(handAnim, {
          toValue: {
            x: handDx,
            y: 110 + handDy,
          },
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (active) animateTracking();
      });
    };

    animateTracking();
    return () => {
      active = false;
    };
  }, [handAnim, leftEyeAnim, rightEyeAnim]);

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
    fireAction("SWIPE LEFT ↤", "Previous Question", () => {
      setChosenPromptIndex((idx) => (idx > 0 ? idx - 1 : prompts.length - 1));
    });
  }, [fireAction, prompts.length]);

  const handleSwipeRight = useCallback(() => {
    fireAction("SWIPE RIGHT ↦", "Next Question", () => {
      setChosenPromptIndex((idx) => idx + 1);
    });
  }, [fireAction]);

  const handleHandWave = useCallback(() => {
    fireAction(
      "HAND WAVE ✋",
      `Ask: "${currentPrompt.slice(0, 26)}..."`,
      () => {
        onAsk(currentPrompt);
      },
      "#4D7C0F",
    );
  }, [currentPrompt, fireAction, onAsk]);

  const handleSwipeUp = useCallback(() => {
    fireAction(
      "SWIPE UP ↥",
      "Summarize Document",
      () => {
        onAction("summarize");
      },
      "#0369A1",
    );
  }, [fireAction, onAction]);

  const handleSwipeDown = useCallback(() => {
    fireAction(
      "SWIPE DOWN ↧",
      "Cancel / Stop",
      () => {
        onAction("cancel");
      },
      "#B91C1C",
    );
  }, [fireAction, onAction]);

  const handleEyeFocus = useCallback(() => {
    setEyeFocused(true);
    fireAction(
      "EYE GAZE LOCK 👁️",
      "Select & Highlight Prompt",
      () => {
        setChosenPromptIndex((idx) => idx + 1);
      },
      "#7C3AED",
    );
    setTimeout(() => setEyeFocused(false), 1200);
  }, [fireAction]);

  // PanResponder to allow direct gesture control across the screen
  const panResponder = useRef(
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
  ).current;

  return (
    <View style={s.container} {...panResponder.panHandlers}>
      {/* Touch-based gesture simulation — not a real camera feed. */}
      <View style={s.cameraViewfinder}>
        <View style={s.cameraVignette} />
        <View style={s.gridPattern} />

        {/* Center Face Target Guide with Eye & Hand Tracking Hub */}
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
        </View>
      </View>

      {/* 2. Top Status & Navigation Bar */}
      <SafeAreaView style={s.topBar}>
        <View style={s.topBarInner}>
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveText}>TOUCH GESTURES ACTIVE</Text>
          </View>

          <View style={s.topRightActions}>
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
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0D0F12",
    zIndex: 9999,
  },
  cameraViewfinder: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
  },
  cameraVignette: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(10, 14, 20, 0.45)",
  },
  gridPattern: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: "rgba(242, 117, 97, 0.08)",
  },
  faceGuide: {
    width: 270,
    height: 340,
    position: "relative",
    borderColor: "rgba(255, 255, 255, 0.12)",
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
    borderColor: "#38BDF8",
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    justifyContent: "center",
    alignItems: "center",
  },
  eyeFocused: {
    borderColor: "#A855F7",
    backgroundColor: "rgba(168, 85, 247, 0.28)",
  },
  eyeCrosshairHoriz: {
    position: "absolute",
    width: 18,
    height: 1,
    backgroundColor: "#38BDF8",
  },
  eyeCrosshairVert: {
    position: "absolute",
    width: 1,
    height: 18,
    backgroundColor: "#38BDF8",
  },
  eyePupil: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#FFFFFF",
  },
  trackerLabel: {
    position: "absolute",
    top: -14,
    fontSize: 8,
    fontWeight: "800",
    color: "#38BDF8",
    letterSpacing: 0.8,
  },
  gazeVector: {
    width: 60,
    height: 1,
    backgroundColor: "rgba(56, 189, 248, 0.4)",
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
    backgroundColor: "rgba(242, 117, 97, 0.18)",
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
    backgroundColor: "#FDE047",
    borderWidth: 1,
    borderColor: "#000",
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
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(242, 117, 97, 0.3)",
    gap: 7,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  liveText: {
    color: "#FFFFFF",
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
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 14,
  },
  toggleButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  closeIcon: {
    color: "#FFFFFF",
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
    backgroundColor: "rgba(15, 23, 42, 0.9)",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    shadowColor: "#000",
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
    color: "#0F172A",
    fontSize: 11,
    fontWeight: "900",
  },
  triggerDetails: {
    flex: 1,
  },
  triggerActionText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
  },
  triggerTime: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 10,
    marginTop: 2,
  },

  /* Target Question Card */
  targetPromptCard: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
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
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 10,
    fontWeight: "600",
  },
  targetPromptText: {
    color: "#FFFFFF",
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
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  gestureChipPrimary: {
    backgroundColor: c.coral,
    borderColor: c.coral,
  },
  gestureChipText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  gestureChipPrimaryText: {
    color: "#0F172A",
    fontWeight: "900",
  },
});
