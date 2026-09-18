import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { serif } from "./design";
import type {
  FileNode,
  FileSystemPort,
} from "../../../packages/core/src/domain/fileSystem";
import {
  createFileNavigator,
  type FileNavState,
} from "../../../packages/core/src/domain/fileNavigation";
import FileNodeCard from "./FileNodeCard";

type FileBrowserViewProps = {
  fs: FileSystemPort;
  rootId: string;
  onClose: () => void;
  onFileSelect: (node: FileNode) => void;
};

const COLUMNS = 3;

export default function FileBrowserView({
  fs,
  rootId,
  onClose,
  onFileSelect,
}: FileBrowserViewProps): React.ReactElement {
  const navigatorRef = useRef<ReturnType<typeof createFileNavigator> | null>(
    null,
  );
  const [navState, setNavState] = useState<FileNavState | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    const nav = createFileNavigator({ fs, rootId });
    navigatorRef.current = nav;
    nav.subscribe(() => {
      const snap = nav.snapshot();
      setNavState({ ...snap });
      setSelectedIndex(snap.selectedIndex);
    });
    nav.load();
    return () => {
      navigatorRef.current = null;
    };
  }, [fs, rootId]);

  const items = navState?.isSearchMode
    ? navState.searchResults
    : navState?.nodes ?? [];

  const handleOpen = useCallback(
    (index: number) => {
      const nav = navigatorRef.current;
      if (!nav) return;
      nav.dispatch({ type: "select", index });
      const intent = nav.dispatch({ type: "openSelected" });
      if (intent?.type === "selectFile") {
        onFileSelect(intent.node);
      }
    },
    [onFileSelect],
  );

  const handleSelect = useCallback((index: number) => {
    navigatorRef.current?.dispatch({ type: "select", index });
  }, []);

  const cardWidth =
    (Dimensions.get("window").width - 32 - (COLUMNS - 1) * 12) / COLUMNS;

  if (!navState) {
    return (
      <View style={s.container}>
        <Text style={s.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <SafeAreaView style={s.safe} edges={["top"]}>
        <View style={s.header}>
          <View style={s.breadcrumb}>
            {navState.breadcrumb.map((entry, i) => (
              <Pressable
                key={entry.id}
                onPress={() =>
                  navigatorRef.current?.dispatch({
                    type: "navigate",
                    directoryId: entry.id,
                  })
                }
              >
                <Text
                  style={[
                    s.breadcrumbText,
                    i === navState.breadcrumb.length - 1 && s.breadcrumbActive,
                  ]}
                >
                  {i > 0 ? " / " : ""}
                  {entry.name}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={s.closeBtn} onPress={onClose}>
            <Text style={s.closeText}>{"\u2715"}</Text>
          </Pressable>
        </View>

        <FlatList
          data={items}
          numColumns={COLUMNS}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.grid}
          columnWrapperStyle={s.row}
          renderItem={({ item, index }) => (
            <View style={{ width: cardWidth }}>
              <FileNodeCard
                node={item}
                selected={index === selectedIndex}
                index={index}
                onSelect={() => handleSelect(index)}
                onOpen={() => handleOpen(index)}
              />
            </View>
          )}
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyIcon}>{"\u{1F4C2}"}</Text>
              <Text style={s.emptyText}>
                {navState.isSearchMode
                  ? `No results for "${navState.searchQuery}"`
                  : "Empty folder"}
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    zIndex: 9999,
    backgroundColor: "rgba(10, 10, 18, 0.95)",
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  breadcrumb: {
    flexDirection: "row",
    flex: 1,
    flexWrap: "wrap",
  },
  breadcrumbText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    fontFamily: serif,
  },
  breadcrumbActive: {
    color: "#fff",
    fontWeight: "600",
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  closeText: {
    color: "#fff",
    fontSize: 16,
  },
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    gap: 12,
    marginBottom: 12,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyIcon: {
    fontSize: 48,
  },
  emptyText: {
    fontSize: 16,
    color: "rgba(255,255,255,0.5)",
  },
  loadingText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 16,
    textAlign: "center",
    marginTop: 80,
  },
});
