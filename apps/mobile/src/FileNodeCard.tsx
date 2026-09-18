import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { serif } from "./design";
import type { FileNode } from "../../../packages/core/src/domain/fileSystem";

const CYAN = "#00F0FF";

type FileNodeCardProps = {
  node: FileNode;
  selected: boolean;
  index: number;
  gazeProgress?: number;
  onSelect: () => void;
  onOpen: () => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export default function FileNodeCard({
  node,
  selected,
  gazeProgress = 0,
  onSelect,
  onOpen,
}: FileNodeCardProps): React.ReactElement {
  const subtitle =
    node.kind === "directory"
      ? `${node.children.length} item${node.children.length !== 1 ? "s" : ""}`
      : node.kind === "file"
        ? formatSize(node.sizeBytes)
        : "Link";

  const icon =
    node.kind === "directory"
      ? "\u{1F4C1}"
      : node.kind === "link"
        ? "\u{1F517}"
        : "\u{1F4C4}";

  return (
    <Pressable
      style={[s.card, selected && s.cardSelected]}
      onPress={onSelect}
      onLongPress={onOpen}
    >
      {gazeProgress > 0 && (
        <View style={[s.gazeBar, { width: `${gazeProgress * 100}%` }]} />
      )}
      <Text style={s.icon}>{icon}</Text>
      <Text style={s.name} numberOfLines={2}>
        {node.name}
      </Text>
      <Text style={s.subtitle}>{subtitle}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: "rgba(26, 25, 38, 0.85)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0, 240, 255, 0.12)",
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    overflow: "hidden",
  },
  cardSelected: {
    borderColor: CYAN,
    shadowColor: CYAN,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  gazeBar: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 3,
    backgroundColor: CYAN,
    borderRadius: 2,
  },
  icon: {
    fontSize: 32,
  },
  name: {
    fontSize: 13,
    fontWeight: "500",
    color: "#fff",
    textAlign: "center",
    fontFamily: serif,
  },
  subtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
  },
});
