import React from "react";
import { View, StyleSheet } from "react-native";
import type { GazePosition } from "../input/useGazeInput";

export function GazeCursor({ position }: { position: GazePosition | null }) {
  if (!position) return null;

  return (
    <View
      style={[
        styles.cursor,
        {
          left: `${position.x * 100}%`,
          top: `${position.y * 100}%`,
        },
      ]}
      pointerEvents="none"
    >
      <View style={styles.dot} />
      <View style={styles.ring} />
    </View>
  );
}

const styles = StyleSheet.create({
  cursor: {
    position: "absolute",
    width: 0,
    height: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(244,119,98,0.8)",
  },
  ring: {
    position: "absolute",
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "rgba(244,119,98,0.4)",
  },
});
