import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { palette } from "../design";

export function ARToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.button, active && styles.activeButton]}
    >
      <Text style={[styles.label, active && styles.activeLabel]}>
        {active ? "3D" : "AR"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  activeButton: {
    backgroundColor: palette.coral,
    borderColor: palette.coral,
  },
  label: { color: "#FFFDF9", fontSize: 14, fontWeight: "600" },
  activeLabel: { color: "#FFFDF9" },
});
