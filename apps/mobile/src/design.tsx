import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  AppState,
  Easing,
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
  paper: "#FAFAFA",
  ink: "#292735",
  muted: "#716C78",
  // Keep native surfaces on the same tokens as the web's light theme.
  coral: "#F47762",
  accent: "#A84332",
  stepLabel: "#A9513A",
  peach: "#FBE2D6",
  warmLilac: "#C8B6A3",
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

export const BRAND = {
  principles: {
    outlined: "Controls use borders only. No filled backgrounds on buttons or interactive elements.",
    fullScreen: "Stages occupy the full viewport. Content breathes against edges, not inside cards.",
    honest: "Indicators reflect real state. No decorative dots, pulses, or badges without data behind them.",
    noEmoji: "No emoji in UI copy. Use icons from the design system or text labels.",
  },
  activeState: {
    border: "accent",
    background: "transparent",
    text: "accent",
    borderWidth: 2,
  },
  inactiveState: {
    border: "line",
    background: "white",
    text: "ink",
    borderWidth: 1,
  },
} as const;

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
  contentStyle,
}: {
  children: React.ReactNode;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  motion: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
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
          ...(selected === undefined
            ? {}
            : accessibilityRole === "radio"
              ? { checked: selected }
              : { selected }),
        }}
        disabled={disabled}
        onPress={onPress}
        onPressIn={() => animate(0.97)}
        onPressOut={() => animate(1)}
        style={({ pressed }) => [
          d.touch,
          contentStyle,
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

const BAR_HEIGHTS = [14, 40, 30, 40, 22];
const BAR_DELAYS = [0, 150, 300, 100, 250];

function AnimatedBar({
  index,
  size,
}: {
  index: number;
  size: number;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(BAR_DELAYS[index]!),
        Animated.timing(scale, {
          toValue: 0.4,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: 600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [index, scale]);

  const barWidth = Math.max(3, size * 0.1);
  const gap = Math.max(2, size * 0.06);
  const maxH = size * 0.8;
  const h = (BAR_HEIGHTS[index]! / 40) * maxH;

  return (
    <Animated.View
      style={{
        width: barWidth,
        height: h,
        borderRadius: barWidth / 2,
        backgroundColor: palette.coral,
        transform: [{ scaleY: scale }],
        marginHorizontal: gap / 2,
      }}
    />
  );
}

export function Brand({ small = false }: { small?: boolean }) {
  const markSize = small ? 27 : 35;
  return (
    <View accessible accessibilityLabel="Action" style={d.brand}>
      <View
        accessible={false}
        style={[d.brandMark, { width: markSize, height: markSize }]}
      >
        {BAR_HEIGHTS.map((_, i) => (
          <AnimatedBar key={i} index={i} size={markSize} />
        ))}
      </View>
      <Text style={[d.wordmark, small && d.wordmarkSmall]} numberOfLines={1}>
        Action
      </Text>
    </View>
  );
}

export function KeyboardIcon({ color = palette.ink }: { color?: string }) {
  return (
    <View accessible={false} style={[d.keyboard, { borderColor: color }]}>
      {[0, 1].map((row) => (
        <View key={row} style={d.keyRow}>
          {[0, 1, 2, 3].map((key) => (
            <View key={key} style={[d.key, { backgroundColor: color }]} />
          ))}
        </View>
      ))}
      <View style={[d.spaceKey, { backgroundColor: color }]} />
    </View>
  );
}

export function BrainIcon({ color = palette.ink }: { color?: string }) {
  return (
    <View accessible={false} style={d.brain}>
      {[0, 1].map((side) => (
        <View key={side} style={[d.brainHalf, { borderColor: color }]}>
          <View style={[d.brainFold, { borderColor: color }]} />
          <View
            style={[d.brainFold, d.brainFoldRight, { borderColor: color }]}
          />
        </View>
      ))}
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
      <Animated.View
        style={{
          transform: [
            {
              translateY: float.interpolate({
                inputRange: [0, 1],
                outputRange: [-4, 4],
              }),
            },
            { rotate: "-12deg" },
          ],
        }}
      >
        <Wave motion={motion} large />
      </Animated.View>
    </View>
  );
}

const d = StyleSheet.create({
  touch: {
    flexGrow: 0,
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
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  wordmark: {
    fontSize: 26,
    letterSpacing: -0.9,
    fontWeight: "800",
    color: palette.ink,
  },
  wordmarkSmall: { fontSize: 20, letterSpacing: -0.7 },
  keyboard: {
    width: 20,
    height: 15,
    borderWidth: 1.5,
    borderRadius: 3,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  keyRow: { flexDirection: "row", gap: 2 },
  key: { width: 2, height: 2, borderRadius: 0.5 },
  spaceKey: { width: 10, height: 1.5, borderRadius: 1 },
  brain: {
    flexDirection: "row",
    width: 19,
    height: 20,
    gap: 1,
    alignItems: "center",
  },
  brainHalf: {
    width: 9,
    height: 17,
    borderWidth: 1.5,
    borderRadius: 5,
    justifyContent: "space-around",
    paddingVertical: 3,
  },
  brainFold: { width: 4, height: 4, borderWidth: 1, borderRadius: 2 },
  brainFoldRight: { alignSelf: "flex-end" },
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
});
