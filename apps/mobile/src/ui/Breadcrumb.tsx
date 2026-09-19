import React from "react";
import { Text, StyleSheet } from "react-native";
import { palette } from "../design";

export function Breadcrumb({ location }: { location: string }) {
  return <Text style={styles.text}>{location}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: palette.muted,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
