"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FileNode, FileSystemPort } from "@/packages/core/src/domain/fileSystem";
import {
  createFileNavigator,
  type FileNavState,
} from "@/packages/core/src/domain/fileNavigation";
import FileNodeCard from "./FileNodeCard";
import { useGazeDwell } from "./GazeDwell";

type ImmersiveFileBrowserProps = {
  open: boolean;
  fs: FileSystemPort;
  rootId: string;
  onClose: () => void;
  onFileSelect: (node: FileNode) => void;
  gaze?: { x: number; y: number } | null;
  columns?: number;
  dwellMs?: number;
};

export default function ImmersiveFileBrowser({
  open,
  fs,
  rootId,
  onClose,
  onFileSelect,
  gaze = null,
  columns = 4,
  dwellMs = 1200,
}: ImmersiveFileBrowserProps): JSX.Element | null {
  const navigatorRef = useRef<ReturnType<typeof createFileNavigator> | null>(
    null,
  );
  const [navState, setNavState] = useState<FileNavState | null>(null);

  useEffect(() => {
    if (!open) return;
    const nav = createFileNavigator({ fs, rootId });
    navigatorRef.current = nav;
    nav.subscribe(() => setNavState({ ...nav.snapshot() }));
    nav.load();
    return () => {
      navigatorRef.current = null;
    };
  }, [open, fs, rootId]);

  const items = navState?.isSearchMode
    ? navState.searchResults
    : navState?.nodes ?? [];

  const handleDwell = useCallback(
    (index: number) => {
      const item = items[index];
      if (!item) return;
      if (item.kind === "directory" && navigatorRef.current) {
        navigatorRef.current.dispatch({ type: "navigate", directoryId: item.id });
      } else if (item.kind !== "directory") {
        onFileSelect(item);
      }
    },
    [items, onFileSelect],
  );

  const { hoveredIndex, progress } = useGazeDwell({
    gaze,
    itemCount: items.length,
    columns,
    dwellMs,
    onDwell: handleDwell,
  });

  const handleCardSelect = useCallback(
    (index: number) => {
      navigatorRef.current?.dispatch({ type: "select", index });
    },
    [],
  );

  const handleCardOpen = useCallback(
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const nav = navigatorRef.current;
      if (!nav) return;
      switch (e.key) {
        case "ArrowRight":
          nav.dispatch({ type: "next" });
          break;
        case "ArrowLeft":
          nav.dispatch({ type: "prev" });
          break;
        case "ArrowUp":
          nav.dispatch({
            type: "select",
            index: Math.max(0, (nav.snapshot().selectedIndex ?? 0) - columns),
          });
          break;
        case "ArrowDown":
          nav.dispatch({
            type: "select",
            index: Math.min(
              items.length - 1,
              (nav.snapshot().selectedIndex ?? -1) + columns,
            ),
          });
          break;
        case "Enter":
          handleCardOpen(nav.snapshot().selectedIndex);
          break;
        case "Backspace":
          if (!nav.snapshot().isSearchMode) {
            nav.dispatch({ type: "navigateUp" });
          }
          break;
        case "Escape":
          if (nav.snapshot().isSearchMode) {
            nav.dispatch({ type: "exitSearch" });
          } else {
            onClose();
          }
          break;
      }
    }
    if (open) {
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [open, items.length, columns, handleCardOpen, onClose]);

  if (!open || !navState) return null;

  const selectedIndex = navState.selectedIndex;

  return (
    <div className="fs-overlay" role="dialog" aria-label="File browser">
      <div className="fs-overlay-backdrop" onClick={onClose} />
      <div className="fs-overlay-content">
        <header className="fs-header">
          <nav className="fs-breadcrumb" aria-label="File path">
            {navState.breadcrumb.map((entry, i) => (
              <span key={entry.id} className="fs-breadcrumb-item">
                {i > 0 && <span className="fs-breadcrumb-sep">/</span>}
                <button
                  type="button"
                  className="fs-breadcrumb-link"
                  onClick={() =>
                    navigatorRef.current?.dispatch({
                      type: "navigate",
                      directoryId: entry.id,
                    })
                  }
                >
                  {entry.name}
                </button>
              </span>
            ))}
          </nav>
          <button
            type="button"
            className="fs-close"
            onClick={onClose}
            aria-label="Close file browser"
          >
            ✕
          </button>
        </header>

        <div
          className="fs-grid"
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {items.map((item, i) => (
            <FileNodeCard
              key={item.id}
              node={item}
              selected={i === selectedIndex}
              index={i}
              gazeProgress={i === hoveredIndex ? progress : 0}
              onSelect={() => handleCardSelect(i)}
              onOpen={() => handleCardOpen(i)}
            />
          ))}
        </div>

        {items.length === 0 && !navState.loading && (
          <div className="fs-empty">
            <span className="fs-empty-icon">📂</span>
            <span className="fs-empty-text">
              {navState.isSearchMode
                ? `No results for "${navState.searchQuery}"`
                : "This folder is empty"}
            </span>
          </div>
        )}

        {navState.loading && (
          <div className="fs-loading">
            <div className="fs-loading-spinner" />
          </div>
        )}
      </div>
    </div>
  );
}
