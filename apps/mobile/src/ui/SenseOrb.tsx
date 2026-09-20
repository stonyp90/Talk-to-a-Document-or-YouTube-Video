import React, { useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { palette as c, Wave } from "../design";

export type SenseVisualActivity = "idle" | "listening" | "motion" | "thinking";

export function SenseField({ motion }: { motion: boolean }) {
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
          duration: 12000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(phase, {
          toValue: 0,
          duration: 12000,
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
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={s.field}
    >
      <Animated.View
        style={[
          s.fieldCenter,
          {
            transform: [
              {
                scale: phase.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.95, 1.05],
                }),
              },
              {
                translateY: phase.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-8, 8],
                }),
              },
            ],
          },
        ]}
      >
        <View style={s.glow} />
        {[320, 450, 620].map((size) => (
          <View
            key={size}
            style={[
              s.fieldRing,
              { width: size, height: size, borderRadius: size / 2 },
            ]}
          />
        ))}
        <View style={[s.particle, s.particleOne]} />
        <View style={[s.particle, s.particleTwo]} />
        <View style={[s.particle, s.particleThree]} />
      </Animated.View>
    </View>
  );
}

export function SenseOrb({
  motion,
  activity,
  compact = false,
}: {
  motion: boolean;
  activity: SenseVisualActivity;
  compact?: boolean;
}) {
  const [rotation] = useState(() => new Animated.Value(0));
  const [pulse] = useState(() => new Animated.Value(0));
  const sensing = activity !== "idle";
  useEffect(() => {
    rotation.setValue(0);
    pulse.setValue(0);
    if (!motion) return;
    const orbit = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: activity === "thinking" ? 7000 : sensing ? 12000 : 22000,
        easing: Easing.linear,
        useNativeDriver: true,
        isInteraction: false,
      }),
    );
    const breathing = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: sensing ? 1500 : 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: sensing ? 1500 : 2500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ]),
    );
    orbit.start();
    breathing.start();
    return () => {
      orbit.stop();
      breathing.stop();
    };
  }, [motion, activity, sensing, rotation, pulse]);
  return (
    <View
      pointerEvents="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[s.orb, compact && s.orbCompact]}
    >
      <Animated.View
        style={[
          s.halo,
          {
            opacity: pulse.interpolate({
              inputRange: [0, 1],
              outputRange: [0.4, 0.05],
            }),
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.9, 1.2],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          s.orbit,
          {
            transform: [
              {
                rotate: rotation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["-30deg", "330deg"],
                }),
              },
              { scaleX: 0.6 },
            ],
          },
        ]}
      >
        <View style={s.dot} />
      </Animated.View>
      <Animated.View
        style={[
          s.orbit,
          {
            transform: [
              {
                rotate: rotation.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["35deg", "-325deg"],
                }),
              },
              { scaleX: 0.7 },
            ],
          },
        ]}
      >
        <View style={s.dot} />
      </Animated.View>
      <Animated.View
        style={[
          s.core,
          sensing && s.coreActive,
          {
            transform: [
              {
                scale: pulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.97, 1.03],
                }),
              },
            ],
          },
        ]}
      >
        <Wave motion={motion} color={c.accent} />
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  field: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  fieldCenter: {
    position: "absolute",
    top: "43%",
    left: "50%",
    alignItems: "center",
    justifyContent: "center",
  },
  fieldRing: {
    position: "absolute",
    borderWidth: 1,
    borderColor: c.peach,
    opacity: 0.4,
  },
  glow: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: c.peach,
    opacity: 0.2,
  },
  particle: {
    position: "absolute",
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: c.coral,
    opacity: 0.45,
  },
  particleOne: { left: -115, top: -100 },
  particleTwo: { left: 145, top: 70 },
  particleThree: { left: -95, top: 165 },
  orb: {
    width: 190,
    height: 190,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  orbCompact: { width: 110, height: 110, marginBottom: 6 },
  halo: {
    ...StyleSheet.absoluteFill,
    borderWidth: 1,
    borderColor: c.peach,
    borderRadius: 150,
  },
  orbit: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderWidth: 1,
    borderColor: c.strongLine,
    borderRadius: 150,
  },
  dot: {
    position: "absolute",
    top: "50%",
    left: -2,
    width: 4,
    height: 4,
    borderRadius: 3,
    backgroundColor: c.coral,
  },
  core: {
    width: "68%",
    height: "68%",
    borderRadius: 100,
    borderWidth: 1,
    borderColor: c.strongLine,
    backgroundColor: c.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: c.coral,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 25,
    elevation: 2,
  },
  coreActive: { backgroundColor: c.peach },
});
