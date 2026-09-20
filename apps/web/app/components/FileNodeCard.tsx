"use client";

import type { FileNode } from "@/packages/core/src/domain/fileSystem";

type FileNodeCardProps = {
  node: FileNode;
  selected: boolean;
  index: number;
  gazeProgress?: number;
  onSelect?: () => void;
  onOpen?: () => void;
};

function formatSize(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`;
  if (bytes < 1000 * 1000) return `${(bytes / 1000).toFixed(0)} KB`;
  if (bytes < 1000 * 1000 * 1000)
    return `${(bytes / (1000 * 1000)).toFixed(1)} MB`;
  return `${(bytes / (1000 * 1000 * 1000)).toFixed(1)} GB`;
}

function fileIcon(fileType: string): string {
  switch (fileType) {
    case "pdf":
      return "📄";
    case "video":
      return "🎬";
    case "audio":
      return "🎵";
    case "image":
      return "🖼";
    case "document":
      return "📝";
    case "spreadsheet":
      return "📊";
    default:
      return "📎";
  }
}

export default function FileNodeCard({
  node,
  selected,
  index,
  gazeProgress = 0,
  onSelect,
  onOpen,
}: FileNodeCardProps) {
  const classes = [
    "fs-card",
    "holo-panel",
    selected ? "fs-card-selected" : "",
    node.kind === "directory" ? "fs-card-directory" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const subtitle =
    node.kind === "directory"
      ? `${node.children.length} item${node.children.length !== 1 ? "s" : ""}`
      : node.kind === "file"
        ? formatSize(node.sizeBytes)
        : "Link";

  return (
    <button
      type="button"
      className={classes}
      data-index={index}
      data-kind={node.kind}
      onClick={onSelect}
      onDoubleClick={onOpen}
      aria-selected={selected}
    >
      {gazeProgress > 0 && (
        <svg className="fs-gaze-ring" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke="var(--plasma-cyan)"
            strokeWidth="3"
            strokeDasharray={`${gazeProgress * 289} 289`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
        </svg>
      )}
      <span className="fs-card-icon" aria-hidden="true">
        {node.kind === "directory"
          ? "📁"
          : node.kind === "link"
            ? "🔗"
            : fileIcon(node.fileType)}
      </span>
      <span className="fs-card-name">{node.name}</span>
      <span className="fs-card-subtitle">{subtitle}</span>
    </button>
  );
}
