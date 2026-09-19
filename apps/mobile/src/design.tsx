import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
  Image,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type AccessibilityRole,
  type StyleProp,
  type ViewStyle,
} from "react-native";

export const palette = {
  paper: "#F8F5EF",
  ink: "#292735",
  muted: "#716C78",
  // Keep native surfaces on the same tokens as the web's light theme.
  coral: "#F47762",
  accent: "#A84332",
  stepLabel: "#A9513A",
  peach: "#FBE2D6",
  lavender: "#EEE9E1",
  softLavender: "#E7E1DB",
  lilac: "#B8AA99",
  warmLilac: "#C8B6A3",
  lime: "#D8EEAE",
  olive: "#677C4A",
  oliveDark: "#4D5E39",
  oliveMid: "#5D713E",
  // Keep native cards aligned with the web surface instead of pure white.
  white: "#FFFDF9",
  line: "#E5E0D8",
  strongLine: "#D9D1C5",
  inputBorder: "#C9C0B5",
  scrim: "#29273599",
  error: "#A23F3F",
  errorBg: "#FCE8E3",
  softMuted: "#9B9294",
  orbitRing: "#514B59",
  orbitRingInner: "#77717B",
  revealBg: "#FDFBF7",
  sheetBg: "#F2EEE8",
  stepNumber: "#765B48",
  selectedBg: "#FFE0D5",
  gestureWave: "#4D7C0F",
  gestureSummarize: "#0369A1",
  gestureCancel: "#B91C1C",
  gestureGaze: "#7C3AED",
  // Dark HUD overlay for the motion camera gesture controls
  hudBg: "#0D0F12",
  hudText: "#FFFFFF",
  hudMuted: "rgba(255, 255, 255, 0.65)",
  hudReticle: "#38BDF8",
  hudReticleFocus: "#A855F7",
  hudJoint: "#FDE047",
  hudLive: "#EF4444",
  hudPanel: "#0F172A",
  hudPanelBorder: "rgba(242, 117, 97, 0.3)",
  hudSubtleBorder: "rgba(255, 255, 255, 0.12)",
  hudSubtleLine: "rgba(255, 255, 255, 0.15)",
  hudWhite20: "rgba(255, 255, 255, 0.2)",
  hudWhite6: "rgba(255, 255, 255, 0.06)",
  hudWhite8: "rgba(255, 255, 255, 0.08)",
  hudWhite10: "rgba(255, 255, 255, 0.1)",
  hudWhite40: "rgba(255, 255, 255, 0.4)",
  hudWhite50: "rgba(255, 255, 255, 0.5)",
  hudWhite60: "rgba(255, 255, 255, 0.6)",
  hudWhite70: "rgba(255, 255, 255, 0.7)",
  hudReticleBg: "rgba(56, 189, 248, 0.15)",
  hudFocusBg: "rgba(168, 85, 247, 0.28)",
  hudGazeLine: "rgba(56, 189, 248, 0.4)",
  hudPalmBg: "rgba(242, 117, 97, 0.18)",
  hudPanelBg: "rgba(15, 23, 42, 0.75)",
  hudPanelBgHeavy: "rgba(15, 23, 42, 0.9)",
  hudChipBg: "rgba(255, 255, 255, 0.12)",
  hudJointBorder: "#000000",
  hudToggleBg: "rgba(255, 255, 255, 0.15)",
  void: "#0D0F12",
  starGlow: "#FDE047",
  planetHighlight: "#A855F7",
  glassBg: "rgba(255,255,255,0.1)",
  glassBorder: "rgba(255,255,255,0.15)",
  glassText: "#FFFDF9",
};

export const spacing = {
  "3xs": 2,
  "2xs": 4,
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 48,
  "5xl": 64,
  "6xl": 96,
};

export const serif = Platform.select({ ios: "Georgia", android: "serif" });

export function useMotion() {
  const [reduced, setReduced] = useState(true);
  const [foreground, setForeground] = useState(
    AppState.currentState === "active",
  );
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (mounted) setReduced(value);
    });
    const motion = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    const app = AppState.addEventListener("change", (state) =>
      setForeground(state === "active"),
    );
    return () => {
      mounted = false;
      motion.remove();
      app.remove();
    };
  }, []);
  return !reduced && foreground;
}

export function Touch({
  children,
  onPress,
  label,
  disabled = false,
  motion,
  style,
  selected,
  accessibilityRole,
  accessibilityDisabled,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  motion: boolean;
  style?: StyleProp<ViewStyle>;
  selected?: boolean;
  accessibilityRole?: AccessibilityRole;
  // Announced as unavailable while still accepting a press, so the control can
  // explain itself instead of silently doing nothing.
  accessibilityDisabled?: boolean;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  const animate = (value: number) => {
    scale.stopAnimation();
    if (motion)
      Animated.spring(scale, {
        toValue: value,
        useNativeDriver: true,
        speed: 35,
        bounciness: 3,
      }).start();
    else scale.setValue(1);
  };
  return (
    <Animated.View
      style={[style, { opacity: disabled ? 0.42 : 1, transform: [{ scale }] }]}
    >
      <Pressable
        accessibilityRole={accessibilityRole ?? "button"}
        accessibilityLabel={label}
        accessibilityState={{
          disabled: disabled || !!accessibilityDisabled,
          ...(selected === undefined ? {} : { selected }),
        }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        style={({ pressed }) => [
          d.touch,
          pressed && !motion && { opacity: 0.72 },
        ]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function Reveal({
  children,
  motion,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  motion: boolean;
  delay?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [progress] = useState(() => new Animated.Value(motion ? 0 : 1));
  useEffect(() => {
    if (!motion) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [motion, progress, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [14, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function Wave({
  motion,
  color = palette.ink,
  large = false,
}: {
  motion: boolean;
  color?: string;
  large?: boolean;
}) {
  const [phase] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!motion) {
      phase.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(phase, {
          toValue: 1,
          duration: 1150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: 1150,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [motion, phase]);
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[d.wave, large && { height: 68, gap: 7 }]}
    >
      {[0.4, 0.7, 1, 0.63, 0.85].map((height, index) => (
        <Animated.View
          key={index}
          style={{
            width: large ? 10 : 4,
            height: (large ? 60 : 25) * height,
            borderRadius: 10,
            backgroundColor: color,
            transform: [
              {
                scaleY: phase.interpolate({
                  inputRange: [0, 1],
                  outputRange: index % 2 ? [1, 0.45] : [0.6, 1],
                }),
              },
            ],
          }}
        />
      ))}
    </View>
  );
}

export function Brand({ small = false }: { small?: boolean }) {
  return (
    <View accessible accessibilityLabel="Ursly" style={d.brand}>
      <Image
        alt=""
        source={require("../assets/brand-mark.png")}
        accessible={false}
        style={[
          d.brandMark,
          small && { width: 27, height: 27, borderRadius: 9 },
        ]}
      />
      <Text style={[d.wordmark, small && { fontSize: 27 }]}>
        ursly<Text style={{ color: palette.coral }}>.</Text>
      </Text>
    </View>
  );
}

export function SourceIcon({
  kind,
  color = palette.ink,
}: {
  kind: "pdf" | "youtube";
  color?: string;
}) {
  return kind === "pdf" ? (
    <View accessible={false} style={[d.document, { borderColor: color }]}>
      <View style={[d.docLine, { backgroundColor: color }]} />
      <View style={[d.docLine, { backgroundColor: color }]} />
      <View style={[d.docLine, { width: 9, backgroundColor: color }]} />
    </View>
  ) : (
    <View accessible={false} style={[d.video, { borderColor: color }]}>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: 6,
          borderBottomWidth: 6,
          borderLeftWidth: 9,
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          borderLeftColor: color,
          marginLeft: 3,
        }}
      />
    </View>
  );
}

export function Bell({ color = palette.ink }: { color?: string }) {
  return (
    <View accessible={false} style={d.bell}>
      <View style={[d.bellBody, { borderColor: color }]} />
      <View style={[d.bellClapper, { backgroundColor: color }]} />
    </View>
  );
}

export function Orbit({ motion }: { motion: boolean }) {
  const [float] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!motion) {
      float.setValue(0);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [motion, float]);
  return (
    <View
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={d.orbit}
    >
      <View style={d.orbitRing} />
      <View
        style={[
          d.orbitRing,
          { width: 142, height: 142, borderColor: palette.orbitRingInner },
        ]}
      />
      <Animated.View
        style={[
          d.orbitCore,
          {
            transform: [
              {
                translateY: float.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-4, 4],
                }),
              },
              { rotate: "-12deg" },
            ],
          },
        ]}
      >
        <Wave motion={motion} large />
      </Animated.View>
      <View style={d.orbitDot} />
      <Text style={d.spark}>✦</Text>
    </View>
  );
}

const d = StyleSheet.create({
  touch: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    minHeight: 44,
    padding: 12,
    borderRadius: 18,
  },
  wave: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 28,
    gap: 3,
  },
  brand: { flexDirection: "row", alignItems: "center", gap: 9 },
  brandMark: {
    width: 35,
    height: 35,
    backgroundColor: palette.coral,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  wordmark: {
    fontSize: 35,
    letterSpacing: -1.7,
    fontWeight: "800",
    color: palette.ink,
  },
  document: {
    width: 23,
    height: 29,
    borderWidth: 1.8,
    borderRadius: 4,
    padding: 4,
    gap: 3,
    justifyContent: "center",
  },
  docLine: { width: 12, height: 1.8, borderRadius: 1 },
  video: {
    width: 31,
    height: 24,
    borderWidth: 1.8,
    borderRadius: 7,
    justifyContent: "center",
    alignItems: "center",
  },
  bell: {
    width: 20,
    height: 22,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  bellBody: {
    width: 17,
    height: 16,
    borderWidth: 1.7,
    borderRadius: 9,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  bellClapper: { width: 5, height: 3, borderRadius: 3, marginTop: 1 },
  orbit: {
    width: 164,
    height: 164,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitRing: {
    position: "absolute",
    width: 164,
    height: 164,
    borderWidth: 1,
    borderColor: palette.orbitRing,
    borderRadius: 100,
  },
  orbitCore: {
    width: 112,
    height: 112,
    backgroundColor: palette.coral,
    borderRadius: 43,
    alignItems: "center",
    justifyContent: "center",
  },
  orbitDot: {
    width: 18,
    height: 18,
    backgroundColor: palette.lime,
    borderRadius: 9,
    position: "absolute",
    top: 11,
    right: 20,
  },
  spark: {
    color: palette.lavender,
    fontSize: 27,
    position: "absolute",
    bottom: 0,
    left: 9,
  },
});
