# F Système — Immersive Spatial File System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen immersive file system overlay that floats above the video conversation on both web and mobile, controlled entirely by gestures, gaze, and voice — no keyboard or mouse.

**Architecture:** A domain layer (`packages/core`) defines file system types and pure navigation logic. An in-memory adapter provides demo data. Web and mobile each render a holographic overlay with file/folder cards positioned in a spatial grid. Three input modalities (swipe gestures, gaze-dwell selection, voice commands) all route through the existing `VoiceActionId` action bus — extended with file navigation actions — so one gesture, one spoken word, and one gaze all produce the same file operation.

**Tech Stack:** React, Next.js App Router, React Native / Expo, Vitest, CSS glassmorphism (existing `--z-hologram`, `.holo-panel` tokens), `createFaceReader` gaze API, `PanResponder` (mobile), `createIntentBus` for unified action dispatch.

**Spec:** This plan is the spec.

## Global Constraints

- All new domain code goes in `packages/core/src/domain/` with co-located `.test.ts` files using Vitest.
- All new web components go in `apps/web/app/components/` with co-located `.test.tsx` files.
- All new mobile components go in `apps/mobile/src/`.
- CSS uses existing design tokens (`--z-hologram: 100`, `--z-orbital: 200`, `.holo-panel`, `--plasma-cyan`, `--ease-hologram`, `@keyframes materialize`). No new hardcoded z-indices — use the spatial stack.
- File browser overlay uses `z-index: var(--z-hologram)` (100) — above conversation (0) and source overlay (10), below modals (1000).
- Voice actions extend the existing `VoiceActionId` union — no parallel action system.
- Gesture mapping follows the existing pattern: UI component maps gesture IDs to `onAction(actionId)` calls.
- English source keys for all UI copy; French translations via existing `t()` function.

---

## File Structure

### Domain Layer (packages/core)

| File | Responsibility |
|------|---------------|
| `packages/core/src/domain/fileSystem.ts` | Types: `FileNode`, `FileNodeKind`, `FileSystemListing`, `FileSystemPort` |
| `packages/core/src/domain/fileNavigation.ts` | Pure logic: `FileNavState`, `createFileNavigator()`, navigation actions |
| `packages/core/src/domain/fileNavigation.test.ts` | Tests for navigation logic |
| `packages/core/src/domain/fileVoiceActions.ts` | File navigation voice action IDs, phrases, trigger definitions |
| `packages/core/src/domain/fileVoiceActions.test.ts` | Tests for file voice matching |

### Adapter Layer (packages/adapters)

| File | Responsibility |
|------|---------------|
| `packages/adapters/src/fileSystem.ts` | `createMemoryFileSystem()` — in-memory demo file system with sample data |

### Web Layer (apps/web)

| File | Responsibility |
|------|---------------|
| `apps/web/app/components/ImmersiveFileBrowser.tsx` | Main overlay: full-screen file browser with spatial grid, gesture/voice/gaze integration |
| `apps/web/app/components/ImmersiveFileBrowser.test.tsx` | Tests for file browser component |
| `apps/web/app/components/FileNodeCard.tsx` | Individual holographic file/folder card with gaze-dwell indicator |
| `apps/web/app/components/FileNodeCard.test.tsx` | Tests for card component |
| `apps/web/app/components/GazeDwell.tsx` | Gaze-dwell selection hook and visual indicator |
| `apps/web/app/components/GazeDwell.test.tsx` | Tests for gaze dwell |
| `apps/web/app/globals.css` | Add: `.fs-overlay`, `.fs-grid`, `.fs-card`, `.fs-breadcrumb`, `.fs-gaze-ring`, `.fs-empty` |

### Mobile Layer (apps/mobile)

| File | Responsibility |
|------|---------------|
| `apps/mobile/src/FileBrowserView.tsx` | Full-screen file browser overlay with gesture and gaze integration |
| `apps/mobile/src/FileNodeCard.tsx` | Holographic file/folder card for React Native |
| `apps/mobile/src/FileBrowserView.test.tsx` | Tests for mobile file browser |

### Integration Points (modified existing files)

| File | Change |
|------|--------|
| `packages/core/src/domain/voiceCommands.ts` | Add `"open"`, `"select"`, `"search"` to `VoiceActionId` |
| `apps/web/app/components/Workspace.tsx` | Mount `<ImmersiveFileBrowser>`, add `fileBrowserOpen` state, wire `handleVoiceAction` for file actions |
| `apps/web/app/components/MotionActions.tsx` | Add file navigation gesture mappings when file browser is open |
| `apps/mobile/App.tsx` | Mount `<FileBrowserView>`, add `fileBrowserOpen` state, wire `handleVoiceAction` for file actions |
| `apps/mobile/src/MotionCameraView.tsx` | Add file navigation gesture mappings when file browser is open |

---

## Task 1: Domain — File System Types and Port

**Files:**
- Create: `packages/core/src/domain/fileSystem.ts`

**Interfaces:**
- Consumes: nothing (leaf module)
- Produces: `FileNode`, `FileNodeKind`, `FileSystemListing`, `FileSystemPort` — consumed by Task 2 (navigation), Task 5 (adapter), Task 6+ (UI)

- [ ] **Step 1: Write the failing test**

Create `packages/core/src/domain/fileSystem.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { FileNode, FileSystemPort } from "./fileSystem";

describe("fileSystem types", () => {
  it("defines a directory node with children", () => {
    const dir: FileNode = {
      id: "root",
      name: "My Documents",
      kind: "directory",
      children: [],
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    expect(dir.kind).toBe("directory");
    expect(dir.children).toEqual([]);
  });

  it("defines a file node with source reference", () => {
    const file: FileNode = {
      id: "f1",
      name: "report.pdf",
      kind: "file",
      fileType: "pdf",
      sizeBytes: 1024,
      sourceId: "src-1",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    expect(file.kind).toBe("file");
    expect(file.fileType).toBe("pdf");
  });

  it("defines a link node pointing to a source", () => {
    const link: FileNode = {
      id: "l1",
      name: "Tutorial Video",
      kind: "link",
      url: "https://youtube.com/watch?v=abc",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date("2026-01-01"),
    };
    expect(link.kind).toBe("link");
  });

  it("port lists children for a directory id", async () => {
    const mockFs: FileSystemPort = {
      list: async (_dirId) => [],
      getNode: async (_id) => null,
      search: async (_query) => [],
    };
    const results = await mockFs.list("root");
    expect(results).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/domain/fileSystem.test.ts`
Expected: FAIL — module `./fileSystem` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/domain/fileSystem.ts`:

```typescript
export type FileNodeKind = "directory" | "file" | "link";

export type FileType =
  | "pdf"
  | "video"
  | "audio"
  | "image"
  | "document"
  | "spreadsheet"
  | "unknown";

export type FileNode = {
  id: string;
  name: string;
  kind: FileNodeKind;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
} & (
  | { kind: "directory"; children: string[] }
  | {
      kind: "file";
      fileType: FileType;
      sizeBytes: number;
      sourceId?: string;
      thumbnailUrl?: string;
    }
  | { kind: "link"; url: string; description?: string }
);

export type FileSystemListing = FileNode[];

export type FileSystemPort = {
  list(directoryId: string): Promise<FileSystemListing>;
  getNode(nodeId: string): Promise<FileNode | null>;
  search(query: string): Promise<FileSystemListing>;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/core/src/domain/fileSystem.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/fileSystem.ts packages/core/src/domain/fileSystem.test.ts
git commit -m "feat(domain): add file system types and port interface"
```

---

## Task 2: Domain — File Navigation Logic

**Files:**
- Create: `packages/core/src/domain/fileNavigation.ts`
- Create: `packages/core/src/domain/fileNavigation.test.ts`

**Interfaces:**
- Consumes: `FileNode`, `FileSystemPort` from Task 1
- Produces: `FileNavState`, `FileNavAction`, `createFileNavigator()` — consumed by Task 6+ (UI components)

- [ ] **Step 1: Write the failing tests**

Create `packages/core/src/domain/fileNavigation.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  createFileNavigator,
  type FileNavState,
  type FileNavAction,
} from "./fileNavigation";
import type { FileNode, FileSystemPort } from "./fileSystem";

const root: FileNode = {
  id: "root",
  name: "My Documents",
  kind: "directory",
  parentId: null,
  children: ["f1", "d1"],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const pdfFile: FileNode = {
  id: "f1",
  name: "report.pdf",
  kind: "file",
  parentId: "root",
  fileType: "pdf",
  sizeBytes: 2048,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const subDir: FileNode = {
  id: "d1",
  name: "Projects",
  kind: "directory",
  parentId: "root",
  children: ["f2"],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const videoFile: FileNode = {
  id: "f2",
  name: "demo.mp4",
  kind: "file",
  parentId: "d1",
  fileType: "video",
  sizeBytes: 1048576,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const nodes: Record<string, FileNode> = {
  root,
  f1: pdfFile,
  d1: subDir,
  f2: videoFile,
};

function makeFs(): FileSystemPort {
  return {
    list: async (dirId) => {
      const node = nodes[dirId];
      if (!node || node.kind !== "directory") return [];
      return node.children
        .map((cid) => nodes[cid])
        .filter(Boolean) as FileNode[];
    },
    getNode: async (id) => nodes[id] ?? null,
    search: async (query) =>
      Object.values(nodes).filter((n) =>
        n.name.toLowerCase().includes(query.toLowerCase()),
      ),
  };
}

describe("createFileNavigator", () => {
  it("initializes with root directory loaded", async () => {
    const nav = createFileNavigator({ fs: makeFs(), rootId: "root" });
    await nav.load();
    const state = nav.snapshot();
    expect(state.currentDirectoryId).toBe("root");
    expect(state.nodes).toHaveLength(2);
    expect(state.selectedIndex).toBe(-1);
    expect(state.breadcrumb).toEqual([{ id: "root", name: "My Documents" }]);
  });

  it("navigates into a subdirectory", async () => {
    const nav = createFileNavigator({ fs: makeFs(), rootId: "root" });
    await nav.load();
    nav.dispatch({ type: "navigate", directoryId: "d1" });
    await nav.ready();
    const state = nav.snapshot();
    expect(state.currentDirectoryId).toBe("d1");
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].name).toBe("demo.mp4");
    expect(state.breadcrumb).toEqual([
      { id: "root", name: "My Documents" },
      { id: "d1", name: "Projects" },
    ]);
  });

  it("navigates up to parent directory", async () => {
    const nav = createFileNavigator({ fs: makeFs(), rootId: "root" });
    await nav.load();
    nav.dispatch({ type: "navigate", directoryId: "d1" });
    await nav.ready();
    nav.dispatch({ type: "navigateUp" });
    await nav.ready();
    const state = nav.snapshot();
    expect(state.currentDirectoryId).toBe("root");
    expect(state.breadcrumb).toEqual([{ id: "root", name: "My Documents" }]);
  });

  it("navigateUp at root is a no-op", async () => {
    const nav = createFileNavigator({ fs: makeFs(), rootId: "root" });
    await nav.load();
    nav.dispatch({ type: "navigateUp" });
    await nav.ready();
    expect(nav.snapshot().currentDirectoryId).toBe("root");
  });

  it("selects a node by index", async () => {
    const nav = createFileNavigator({ fs: makeFs(), rootId: "root" });
    await nav.load();
    nav.dispatch({ type: "select", index: 0 });
    expect(nav.snapshot().selectedIndex).toBe(0);
  });

  it("moves selection with next/prev", async () => {
    const nav = createFileNavigator({ fs: makeFs(), rootId: "root" });
    await nav.load();
    nav.dispatch({ type: "next" });
    expect(nav.snapshot().selectedIndex).toBe(0);
    nav.dispatch({ type: "next" });
    expect(nav.snapshot().selectedIndex).toBe(1);
    nav.dispatch({ type: "prev" });
    expect(nav.snapshot().selectedIndex).toBe(0);
  });

  it("next at end wraps to -1, prev at start wraps to last", async () => {
    const nav = createFileNavigator({ fs: makeFs(), rootId: "root" });
    await nav.load();
    nav.dispatch({ type: "prev" });
    expect(nav.snapshot().selectedIndex).toBe(1);
    nav.dispatch({ type: "next" });
    nav.dispatch({ type: "next" });
    expect(nav.snapshot().selectedIndex).toBe(-1);
  });

  it("opens selected directory", async () => {
    const nav = createFileNavigator({ fs: makeFs(), rootId: "root" });
    await nav.load();
    nav.dispatch({ type: "select", index: 1 });
    nav.dispatch({ type: "openSelected" });
    await nav.ready();
    expect(nav.snapshot().currentDirectoryId).toBe("d1");
  });

  it("emits selectFile intent when opening a file", async () => {
    const nav = createFileNavigator({ fs: makeFs(), rootId: "root" });
    await nav.load();
    nav.dispatch({ type: "select", index: 0 });
    const intent = nav.dispatch({ type: "openSelected" });
    expect(intent).toEqual({ type: "selectFile", node: pdfFile });
  });

  it("search returns matching results", async () => {
    const nav = createFileNavigator({ fs: makeFs(), rootId: "root" });
    await nav.load();
    nav.dispatch({ type: "search", query: "report" });
    await nav.ready();
    const state = nav.snapshot();
    expect(state.searchResults).toHaveLength(1);
    expect(state.searchResults[0].name).toBe("report.pdf");
    expect(state.isSearchMode).toBe(true);
  });

  it("exits search mode back to directory", async () => {
    const nav = createFileNavigator({ fs: makeFs(), rootId: "root" });
    await nav.load();
    nav.dispatch({ type: "search", query: "report" });
    await nav.ready();
    nav.dispatch({ type: "exitSearch" });
    const state = nav.snapshot();
    expect(state.isSearchMode).toBe(false);
    expect(state.searchResults).toEqual([]);
  });

  it("notifies subscribers on state change", async () => {
    const nav = createFileNavigator({ fs: makeFs(), rootId: "root" });
    await nav.load();
    let calls = 0;
    nav.subscribe(() => {
      calls++;
    });
    nav.dispatch({ type: "select", index: 0 });
    expect(calls).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/domain/fileNavigation.test.ts`
Expected: FAIL — module `./fileNavigation` not found

- [ ] **Step 3: Write the implementation**

Create `packages/core/src/domain/fileNavigation.ts`:

```typescript
import type { FileNode, FileSystemPort } from "./fileSystem";

export type BreadcrumbEntry = { id: string; name: string };

export type FileNavState = {
  currentDirectoryId: string;
  nodes: FileNode[];
  selectedIndex: number;
  breadcrumb: BreadcrumbEntry[];
  isSearchMode: boolean;
  searchResults: FileNode[];
  searchQuery: string;
  loading: boolean;
};

export type FileNavAction =
  | { type: "navigate"; directoryId: string }
  | { type: "navigateUp" }
  | { type: "select"; index: number }
  | { type: "next" }
  | { type: "prev" }
  | { type: "openSelected" }
  | { type: "search"; query: string }
  | { type: "exitSearch" };

export type FileNavIntent =
  | { type: "selectFile"; node: FileNode }
  | { type: "openDirectory"; node: FileNode }
  | null;

type FileNavConfig = {
  fs: FileSystemPort;
  rootId: string;
};

type Listener = () => void;

export function createFileNavigator(config: FileNavConfig) {
  const { fs, rootId } = config;
  const listeners = new Set<Listener>();

  let state: FileNavState = {
    currentDirectoryId: rootId,
    nodes: [],
    selectedIndex: -1,
    breadcrumb: [],
    isSearchMode: false,
    searchResults: [],
    searchQuery: "",
    loading: true,
  };

  let pendingResolve: (() => void) | null = null;

  async function loadDirectory(dirId: string) {
    state = { ...state, loading: true };
    notify();
    const [nodes, dirNode] = await Promise.all([
      fs.list(dirId),
      fs.getNode(dirId),
    ]);
    const breadcrumb = await buildBreadcrumb(dirId);
    state = {
      ...state,
      currentDirectoryId: dirId,
      nodes,
      selectedIndex: -1,
      breadcrumb,
      loading: false,
    };
    notify();
    pendingResolve?.();
    pendingResolve = null;
  }

  async function buildBreadcrumb(dirId: string): Promise<BreadcrumbEntry[]> {
    const trail: BreadcrumbEntry[] = [];
    let currentId: string | null = dirId;
    while (currentId) {
      const node = await fs.getNode(currentId);
      if (!node) break;
      trail.unshift({ id: node.id, name: node.name });
      currentId = node.parentId;
    }
    return trail;
  }

  function notify() {
    for (const listener of listeners) listener();
  }

  return {
    async load() {
      await loadDirectory(rootId);
    },

    ready(): Promise<void> {
      if (!state.loading) return Promise.resolve();
      return new Promise((resolve) => {
        pendingResolve = resolve;
      });
    },

    snapshot(): FileNavState {
      return state;
    },

    subscribe(listener: Listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    dispatch(action: FileNavAction): FileNavIntent {
      switch (action.type) {
        case "navigate":
          loadDirectory(action.directoryId);
          return null;

        case "navigateUp": {
          if (state.currentDirectoryId === rootId) return null;
          const currentDir = state.breadcrumb[state.breadcrumb.length - 1];
          if (!currentDir) return null;
          fs.getNode(currentDir.id).then((node) => {
            if (node?.parentId) loadDirectory(node.parentId);
            else if (state.breadcrumb.length > 1) {
              const parent = state.breadcrumb[state.breadcrumb.length - 2];
              if (parent) loadDirectory(parent.id);
            }
          });
          return null;
        }

        case "select":
          state = {
            ...state,
            selectedIndex: Math.max(
              -1,
              Math.min(action.index, state.nodes.length - 1),
            ),
          };
          notify();
          return null;

        case "next": {
          const count = state.nodes.length;
          if (count === 0) return null;
          const nextIdx =
            state.selectedIndex >= count - 1 ? -1 : state.selectedIndex + 1;
          state = { ...state, selectedIndex: nextIdx };
          notify();
          return null;
        }

        case "prev": {
          const count = state.nodes.length;
          if (count === 0) return null;
          const prevIdx =
            state.selectedIndex <= -1 ? count - 1 : state.selectedIndex - 1;
          state = { ...state, selectedIndex: prevIdx };
          notify();
          return null;
        }

        case "openSelected": {
          const items = state.isSearchMode
            ? state.searchResults
            : state.nodes;
          const selected = items[state.selectedIndex];
          if (!selected) return null;
          if (selected.kind === "directory") {
            loadDirectory(selected.id);
            return { type: "openDirectory", node: selected };
          }
          return { type: "selectFile", node: selected };
        }

        case "search":
          state = {
            ...state,
            isSearchMode: true,
            searchQuery: action.query,
            loading: true,
          };
          notify();
          fs.search(action.query).then((results) => {
            state = {
              ...state,
              searchResults: results,
              selectedIndex: -1,
              loading: false,
            };
            notify();
            pendingResolve?.();
            pendingResolve = null;
          });
          return null;

        case "exitSearch":
          state = {
            ...state,
            isSearchMode: false,
            searchResults: [],
            searchQuery: "",
            selectedIndex: -1,
          };
          notify();
          return null;

        default:
          return null;
      }
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/domain/fileNavigation.test.ts`
Expected: PASS (12 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/domain/fileNavigation.ts packages/core/src/domain/fileNavigation.test.ts
git commit -m "feat(domain): add file navigation state machine with directory traversal and search"
```

---

## Task 3: Domain — File Voice Actions

**Files:**
- Create: `packages/core/src/domain/fileVoiceActions.ts`
- Create: `packages/core/src/domain/fileVoiceActions.test.ts`
- Modify: `packages/core/src/domain/voiceCommands.ts`

**Interfaces:**
- Consumes: `VoiceActionId` from `voiceCommands.ts`
- Produces: `FILE_NAVIGATION_ACTIONS`, `fileDefaultPhrases()`, `fileDefaultTriggers()` — consumed by Task 6+ (UI voice integration)

- [ ] **Step 1: Extend VoiceActionId**

Modify `packages/core/src/domain/voiceCommands.ts` — add three new actions to the union:

```typescript
export type VoiceActionId =
  | "youtube"
  | "upload"
  | "voice"
  | "summarize"
  | "ask"
  | "stop"
  | "back"
  | "next"
  | "cancel"
  | "open"
  | "select"
  | "search";
```

Also add `"open"` to `ARGUMENT_ACTIONS`:

```typescript
export const ARGUMENT_ACTIONS: readonly VoiceActionId[] = [
  "youtube",
  "open",
  "select",
  "search",
];
```

- [ ] **Step 2: Write the failing tests**

Create `packages/core/src/domain/fileVoiceActions.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import {
  FILE_NAVIGATION_ACTIONS,
  fileDefaultPhrases,
  fileDefaultTriggers,
} from "./fileVoiceActions";
import { matchCommands } from "./voiceCommands";

describe("file voice actions", () => {
  it("defines navigation action ids", () => {
    expect(FILE_NAVIGATION_ACTIONS).toContain("open");
    expect(FILE_NAVIGATION_ACTIONS).toContain("select");
    expect(FILE_NAVIGATION_ACTIONS).toContain("search");
  });

  it("provides English phrases for file actions", () => {
    const phrases = fileDefaultPhrases("en");
    expect(phrases.open).toContain("open");
    expect(phrases.select).toContain("select");
    expect(phrases.search).toContain("search");
  });

  it("provides French phrases for file actions", () => {
    const phrases = fileDefaultPhrases("fr");
    expect(phrases.open).toContain("ouvrir");
    expect(phrases.select).toContain("sélectionner");
    expect(phrases.search).toContain("chercher");
  });

  it("creates default triggers for file actions", () => {
    const triggers = fileDefaultTriggers("en");
    expect(triggers).toHaveLength(3);
    expect(triggers[0].action).toBe("open");
  });

  it("matches spoken open command", () => {
    const triggers = fileDefaultTriggers("en");
    const matches = matchCommands("open report", triggers, { language: "en" });
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.action).toBe("open");
  });

  it("matches spoken select command with argument", () => {
    const triggers = fileDefaultTriggers("en");
    const matches = matchCommands("select the third one", triggers, {
      language: "en",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.action).toBe("select");
  });

  it("matches French ouvrir command", () => {
    const triggers = fileDefaultTriggers("fr");
    const matches = matchCommands("ouvrir le dossier", triggers, {
      language: "fr",
    });
    expect(matches).toHaveLength(1);
    expect(matches[0].trigger.action).toBe("open");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/domain/fileVoiceActions.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Write the implementation**

Create `packages/core/src/domain/fileVoiceActions.ts`:

```typescript
import type { VoiceLanguage } from "./voiceCommands";
import { type VoiceActionId, type VoiceTrigger } from "./voiceCommands";

export const FILE_NAVIGATION_ACTIONS: readonly VoiceActionId[] = [
  "open",
  "select",
  "search",
];

const EN_PHRASES: Record<"open" | "select" | "search", string[]> = {
  open: ["open", "open file", "open folder", "go into"],
  select: ["select", "choose", "pick"],
  search: ["search", "find", "look for", "chercher"],
};

const FR_PHRASES: Record<"open" | "select" | "search", string[]> = {
  open: ["ouvrir", "ouvre", "entrer dans"],
  select: ["sélectionner", "choisir", "sélectionne"],
  search: ["chercher", "rechercher", "trouver"],
};

export function fileDefaultPhrases(
  language: VoiceLanguage,
): Record<"open" | "select" | "search", string[]> {
  return language === "fr"
    ? { ...FR_PHRASES }
    : { ...EN_PHRASES };
}

export function fileDefaultTriggers(
  language: VoiceLanguage,
): VoiceTrigger[] {
  const phrases = fileDefaultPhrases(language);
  return FILE_NAVIGATION_ACTIONS.map(
    (action): VoiceTrigger => ({
      id: `file-${action}`,
      phrase: phrases[action as keyof typeof phrases][0],
      action,
    }),
  );
}
```

- [ ] **Step 5: Update existing voiceCommands.ts default phrases**

In `packages/core/src/domain/voiceCommands.ts`, add the new actions to `defaultPhrases()`. Find the function and add entries for `"open"`, `"select"`, `"search"` in both the English and French sections:

```typescript
// In the English section of defaultPhrases:
open: ["open"],
select: ["select"],
search: ["search"],

// In the French section:
open: ["ouvrir"],
select: ["sélectionner"],
search: ["chercher"],
```

- [ ] **Step 6: Run all domain tests**

Run: `npx vitest run packages/core/src/domain/`
Expected: All pass — existing tests still pass with extended VoiceActionId

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/domain/fileVoiceActions.ts packages/core/src/domain/fileVoiceActions.test.ts packages/core/src/domain/voiceCommands.ts
git commit -m "feat(domain): add file navigation voice actions (open, select, search) bilingual"
```

---

## Task 4: Adapter — In-Memory File System

**Files:**
- Create: `packages/adapters/src/fileSystem.ts`

**Interfaces:**
- Consumes: `FileSystemPort`, `FileNode` from Task 1
- Produces: `createMemoryFileSystem()` — consumed by Task 6+ (UI components for demo data)

- [ ] **Step 1: Write the failing test**

Create `packages/adapters/src/fileSystem.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { createMemoryFileSystem } from "./fileSystem";

describe("createMemoryFileSystem", () => {
  it("lists root directory with demo content", async () => {
    const fs = createMemoryFileSystem();
    const listing = await fs.list("root");
    expect(listing.length).toBeGreaterThan(0);
    expect(listing.some((n) => n.kind === "directory")).toBe(true);
    expect(listing.some((n) => n.kind === "file")).toBe(true);
  });

  it("returns null for unknown node", async () => {
    const fs = createMemoryFileSystem();
    const node = await fs.getNode("nonexistent");
    expect(node).toBeNull();
  });

  it("lists subdirectory children", async () => {
    const fs = createMemoryFileSystem();
    const rootListing = await fs.list("root");
    const dir = rootListing.find((n) => n.kind === "directory");
    if (!dir || dir.kind !== "directory") return;
    const subListing = await fs.list(dir.id);
    expect(subListing.length).toBeGreaterThan(0);
  });

  it("search finds nodes by name", async () => {
    const fs = createMemoryFileSystem();
    const results = await fs.search("pdf");
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((n) => n.name.toLowerCase().includes("pdf"))).toBe(
      true,
    );
  });

  it("search returns empty for no match", async () => {
    const fs = createMemoryFileSystem();
    const results = await fs.search("xyznonexistent");
    expect(results).toEqual([]);
  });

  it("getNode returns the correct node", async () => {
    const fs = createMemoryFileSystem();
    const root = await fs.getNode("root");
    expect(root).not.toBeNull();
    expect(root!.name).toBe("My Documents");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/adapters/src/fileSystem.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `packages/adapters/src/fileSystem.ts`:

```typescript
import type { FileNode, FileSystemPort, FileSystemListing } from "@talk/core/domain/fileSystem";

function dir(id: string, name: string, parentId: string | null, children: string[]): FileNode {
  return {
    id,
    name,
    parentId,
    kind: "directory",
    children,
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-15"),
  } as FileNode;
}

function file(
  id: string,
  name: string,
  parentId: string | null,
  fileType: string,
  sizeBytes: number,
): FileNode {
  return {
    id,
    name,
    parentId,
    kind: "file",
    fileType: fileType as FileNode extends { kind: "file"; fileType: infer T } ? T : never,
    sizeBytes,
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-15"),
  } as FileNode;
}

function link(id: string, name: string, parentId: string | null, url: string): FileNode {
  return {
    id,
    name,
    parentId,
    kind: "link",
    url,
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-15"),
  } as FileNode;
}

const DEMO_NODES: Record<string, FileNode> = {
  root: dir("root", "My Documents", null, [
    "d-projects",
    "d-media",
    "f-report",
    "f-notes",
    "l-demo",
  ]),
  "d-projects": dir("d-projects", "Projects", "root", [
    "f-proposal",
    "f-budget",
  ]),
  "d-media": dir("d-media", "Media", "root", [
    "f-presentation",
    "f-video",
  ]),
  "f-report": file("f-report", "Annual Report.pdf", "root", "pdf", 2_400_000),
  "f-notes": file("f-notes", "Meeting Notes.pdf", "root", "document", 48_000),
  "l-demo": link(
    "l-demo",
    "Product Demo Video",
    "root",
    "https://youtube.com/watch?v=demo",
  ),
  "f-proposal": file(
    "f-proposal",
    "Project Proposal.pdf",
    "d-projects",
    "pdf",
    1_200_000,
  ),
  "f-budget": file(
    "f-budget",
    "Budget 2026.xlsx",
    "d-projects",
    "spreadsheet",
    350_000,
  ),
  "f-presentation": file(
    "f-presentation",
    "Pitch Deck.pdf",
    "d-media",
    "pdf",
    8_500_000,
  ),
  "f-video": file(
    "f-video",
    "Tutorial.mp4",
    "d-media",
    "video",
    52_000_000,
  ),
};

export function createMemoryFileSystem(): FileSystemPort {
  const nodes = { ...DEMO_NODES };

  return {
    async list(directoryId: string): Promise<FileSystemListing> {
      const dir = nodes[directoryId];
      if (!dir || dir.kind !== "directory") return [];
      return dir.children
        .map((cid) => nodes[cid])
        .filter((n): n is FileNode => n !== undefined);
    },

    async getNode(nodeId: string): Promise<FileNode | null> {
      return nodes[nodeId] ?? null;
    },

    async search(query: string): Promise<FileSystemListing> {
      const q = query.toLowerCase();
      return Object.values(nodes).filter(
        (n) => n.id !== "root" && n.name.toLowerCase().includes(q),
      );
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/adapters/src/fileSystem.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/adapters/src/fileSystem.ts packages/adapters/src/fileSystem.test.ts
git commit -m "feat(adapters): add in-memory file system with demo document tree"
```

---

## Task 5: Web — Holographic File Card Component

**Files:**
- Create: `apps/web/app/components/FileNodeCard.tsx`
- Create: `apps/web/app/components/FileNodeCard.test.tsx`

**Interfaces:**
- Consumes: `FileNode` from Task 1
- Produces: `<FileNodeCard>` — consumed by Task 7 (ImmersiveFileBrowser)

- [ ] **Step 1: Write the failing test**

Create `apps/web/app/components/FileNodeCard.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import FileNodeCard from "./FileNodeCard";
import type { FileNode } from "@/packages/core/src/domain/fileSystem";

const pdfFile: FileNode = {
  id: "f1",
  name: "Annual Report.pdf",
  kind: "file",
  parentId: "root",
  fileType: "pdf",
  sizeBytes: 2_400_000,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const directory: FileNode = {
  id: "d1",
  name: "Projects",
  kind: "directory",
  parentId: "root",
  children: ["f1"],
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const videoLink: FileNode = {
  id: "l1",
  name: "Demo Video",
  kind: "link",
  parentId: "root",
  url: "https://youtube.com/watch?v=demo",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

describe("FileNodeCard", () => {
  it("renders file name", () => {
    render(<FileNodeCard node={pdfFile} selected={false} index={0} />);
    expect(screen.getByText("Annual Report.pdf")).toBeDefined();
  });

  it("renders directory with child count", () => {
    render(<FileNodeCard node={directory} selected={false} index={0} />);
    expect(screen.getByText("Projects")).toBeDefined();
    expect(screen.getByText("1 item")).toBeDefined();
  });

  it("renders link with description", () => {
    render(<FileNodeCard node={videoLink} selected={false} index={0} />);
    expect(screen.getByText("Demo Video")).toBeDefined();
  });

  it("applies selected class when selected", () => {
    const { container } = render(
      <FileNodeCard node={pdfFile} selected={true} index={0} />,
    );
    expect(container.firstChild).toHaveClass("fs-card-selected");
  });

  it("shows file size for files", () => {
    render(<FileNodeCard node={pdfFile} selected={false} index={0} />);
    expect(screen.getByText("2.4 MB")).toBeDefined();
  });

  it("renders gaze dwell ring container", () => {
    const { container } = render(
      <FileNodeCard node={pdfFile} selected={false} index={0} gazeProgress={0.5} />,
    );
    const ring = container.querySelector(".fs-gaze-ring");
    expect(ring).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/app/components/FileNodeCard.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/web/app/components/FileNodeCard.tsx`:

```tsx
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
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
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
}: FileNodeCardProps): JSX.Element {
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/web/app/components/FileNodeCard.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/FileNodeCard.tsx apps/web/app/components/FileNodeCard.test.tsx
git commit -m "feat(web): add holographic FileNodeCard with gaze-dwell ring"
```

---

## Task 6: Web — Gaze Dwell Selection Hook

**Files:**
- Create: `apps/web/app/components/GazeDwell.tsx`
- Create: `apps/web/app/components/GazeDwell.test.tsx`

**Interfaces:**
- Consumes: `FaceReading` from `packages/core/src/domain/faceTracking`
- Produces: `useGazeDwell()` hook — consumed by Task 7 (ImmersiveFileBrowser)

- [ ] **Step 1: Write the failing tests**

Create `apps/web/app/components/GazeDwell.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGazeDwell } from "./GazeDwell";

describe("useGazeDwell", () => {
  it("returns no progress when gaze is absent", () => {
    const { result } = renderHook(() =>
      useGazeDwell({
        gaze: null,
        itemCount: 6,
        columns: 3,
        dwellMs: 500,
      }),
    );
    expect(result.current.hoveredIndex).toBe(-1);
    expect(result.current.progress).toBe(0);
  });

  it("maps gaze position to grid index", () => {
    const { result } = renderHook(() =>
      useGazeDwell({
        gaze: { x: 0.5, y: 0.5 },
        itemCount: 6,
        columns: 3,
        dwellMs: 500,
      }),
    );
    expect(result.current.hoveredIndex).toBe(4);
  });

  it("returns -1 for out-of-range index", () => {
    const { result } = renderHook(() =>
      useGazeDwell({
        gaze: { x: 0.99, y: 0.99 },
        itemCount: 2,
        columns: 3,
        dwellMs: 500,
      }),
    );
    expect(result.current.hoveredIndex).toBe(-1);
  });

  it("fires onDwell when gaze holds on same item for dwellMs", async () => {
    vi.useFakeTimers();
    const onDwell = vi.fn();
    renderHook(() =>
      useGazeDwell({
        gaze: { x: 0.17, y: 0.17 },
        itemCount: 6,
        columns: 3,
        dwellMs: 500,
        onDwell,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onDwell).toHaveBeenCalledWith(0);
    vi.useRealTimers();
  });

  it("resets progress when gaze moves to different item", () => {
    vi.useFakeTimers();
    const onDwell = vi.fn();
    const { rerender } = renderHook(
      ({ gaze }) =>
        useGazeDwell({
          gaze,
          itemCount: 6,
          columns: 3,
          dwellMs: 500,
          onDwell,
        }),
      { initialProps: { gaze: { x: 0.17, y: 0.17 } as { x: number; y: number } | null } },
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender({ gaze: { x: 0.83, y: 0.17 } });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onDwell).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/web/app/components/GazeDwell.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/web/app/components/GazeDwell.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

type GazeDwellConfig = {
  gaze: { x: number; y: number } | null;
  itemCount: number;
  columns: number;
  dwellMs: number;
  onDwell?: (index: number) => void;
};

type GazeDwellResult = {
  hoveredIndex: number;
  progress: number;
};

export function useGazeDwell(config: GazeDwellConfig): GazeDwellResult {
  const { gaze, itemCount, columns, dwellMs, onDwell } = config;
  const [hoveredIndex, setHoveredIndex] = useState(-1);
  const [progress, setProgress] = useState(0);
  const dwellStart = useRef<number | null>(null);
  const lastIndex = useRef(-1);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!gaze || itemCount === 0) {
      setHoveredIndex(-1);
      setProgress(0);
      dwellStart.current = null;
      lastIndex.current = -1;
      return;
    }

    const rows = Math.ceil(itemCount / columns);
    const col = Math.floor(gaze.x * columns);
    const row = Math.floor(gaze.y * rows);
    const idx = row * columns + col;
    const clampedIdx = idx >= itemCount ? -1 : idx;

    if (clampedIdx !== lastIndex.current) {
      lastIndex.current = clampedIdx;
      dwellStart.current = clampedIdx >= 0 ? performance.now() : null;
      setHoveredIndex(clampedIdx);
      setProgress(0);
    }

    if (clampedIdx >= 0 && dwellStart.current !== null) {
      const tick = () => {
        const elapsed = performance.now() - (dwellStart.current ?? 0);
        const p = Math.min(elapsed / dwellMs, 1);
        setProgress(p);
        if (p >= 1) {
          onDwell?.(clampedIdx);
          dwellStart.current = performance.now();
        } else {
          frameRef.current = requestAnimationFrame(tick);
        }
      };
      frameRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [gaze, itemCount, columns, dwellMs, onDwell]);

  return { hoveredIndex, progress };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/web/app/components/GazeDwell.test.tsx`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/GazeDwell.tsx apps/web/app/components/GazeDwell.test.tsx
git commit -m "feat(web): add gaze-dwell selection hook with configurable dwell time"
```

---

## Task 7: Web — Immersive File Browser Overlay

**Files:**
- Create: `apps/web/app/components/ImmersiveFileBrowser.tsx`
- Create: `apps/web/app/components/ImmersiveFileBrowser.test.tsx`

**Interfaces:**
- Consumes: `FileNode` from Task 1, `createFileNavigator` from Task 2, `FileNodeCard` from Task 5, `useGazeDwell` from Task 6, `fileDefaultTriggers` from Task 3
- Produces: `<ImmersiveFileBrowser>` — consumed by Workspace.tsx (Task 10)

- [ ] **Step 1: Write the failing tests**

Create `apps/web/app/components/ImmersiveFileBrowser.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ImmersiveFileBrowser from "./ImmersiveFileBrowser";
import type { FileSystemPort } from "@/packages/core/src/domain/fileSystem";

function makeMockFs(): FileSystemPort {
  return {
    list: vi.fn().mockResolvedValue([
      {
        id: "d1",
        name: "Projects",
        kind: "directory",
        parentId: "root",
        children: ["f1"],
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "f1",
        name: "Report.pdf",
        kind: "file",
        parentId: "root",
        fileType: "pdf",
        sizeBytes: 1024,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]),
    getNode: vi.fn().mockImplementation((id: string) => {
      if (id === "root")
        return Promise.resolve({
          id: "root",
          name: "My Documents",
          kind: "directory",
          parentId: null,
          children: ["d1", "f1"],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      return Promise.resolve(null);
    }),
    search: vi.fn().mockResolvedValue([]),
  };
}

describe("ImmersiveFileBrowser", () => {
  it("renders breadcrumb with root directory name", async () => {
    render(
      <ImmersiveFileBrowser
        open={true}
        fs={makeMockFs()}
        rootId="root"
        onClose={vi.fn()}
        onFileSelect={vi.fn()}
      />,
    );
    const breadcrumb = await screen.findByText("My Documents");
    expect(breadcrumb).toBeDefined();
  });

  it("renders file cards for directory listing", async () => {
    render(
      <ImmersiveFileBrowser
        open={true}
        fs={makeMockFs()}
        rootId="root"
        onClose={vi.fn()}
        onFileSelect={vi.fn()}
      />,
    );
    expect(await screen.findByText("Projects")).toBeDefined();
    expect(await screen.findByText("Report.pdf")).toBeDefined();
  });

  it("renders nothing when closed", () => {
    const { container } = render(
      <ImmersiveFileBrowser
        open={false}
        fs={makeMockFs()}
        rootId="root"
        onClose={vi.fn()}
        onFileSelect={vi.fn()}
      />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows close button", async () => {
    render(
      <ImmersiveFileBrowser
        open={true}
        fs={makeMockFs()}
        rootId="root"
        onClose={vi.fn()}
        onFileSelect={vi.fn()}
      />,
    );
    expect(screen.getByLabelText("Close file browser")).toBeDefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run apps/web/app/components/ImmersiveFileBrowser.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `apps/web/app/components/ImmersiveFileBrowser.tsx`:

```tsx
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
        case "Escape":
          if (nav.snapshot().isSearchMode) {
            nav.dispatch({ type: "exitSearch" });
          } else {
            nav.dispatch({ type: "navigateUp" });
          }
          break;
        case "Escape":
          onClose();
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run apps/web/app/components/ImmersiveFileBrowser.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/components/ImmersiveFileBrowser.tsx apps/web/app/components/ImmersiveFileBrowser.test.tsx
git commit -m "feat(web): add ImmersiveFileBrowser overlay with spatial grid, breadcrumb, and gaze integration"
```

---

## Task 8: Web — Holographic File Browser CSS

**Files:**
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes: existing design tokens (`--z-hologram`, `--plasma-cyan`, `--holo-panel`, `--ease-hologram`, `@keyframes materialize`)
- Produces: `.fs-overlay`, `.fs-grid`, `.fs-card`, `.fs-breadcrumb`, `.fs-gaze-ring`, `.fs-empty` classes — consumed by Task 7 components

- [ ] **Step 1: Add file browser CSS to globals.css**

Append the following block to `apps/web/app/globals.css`, after the existing immersive workspace styles:

```css
/* ═══════════════════════════════════════════════════════════
   F Système — Immersive File Browser Overlay
   ═══════════════════════════════════════════════════════════ */

.fs-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--z-hologram);
  display: flex;
  flex-direction: column;
  animation: materialize var(--motion-base) var(--ease-hologram) both;
}

.fs-overlay-backdrop {
  position: absolute;
  inset: 0;
  background: radial-gradient(
    ellipse at 50% 30%,
    color-mix(in srgb, var(--void-deep) 60%, transparent),
    color-mix(in srgb, var(--void-deep) 90%, transparent)
  );
  backdrop-filter: blur(12px);
}

.fs-overlay-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 2rem 3rem;
  overflow: hidden;
}

.fs-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 1.5rem;
  flex-shrink: 0;
}

.fs-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  color: color-mix(in srgb, var(--text) 70%, transparent);
}

.fs-breadcrumb-sep {
  margin: 0 0.25rem;
  opacity: 0.4;
}

.fs-breadcrumb-link {
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  transition: background var(--motion-fast) var(--ease-out),
    color var(--motion-fast) var(--ease-out);
}

.fs-breadcrumb-link:hover {
  background: color-mix(in srgb, var(--plasma-cyan) 10%, transparent);
  color: var(--plasma-cyan);
}

.fs-breadcrumb-item:last-child .fs-breadcrumb-link {
  color: var(--text);
  font-weight: 600;
}

.fs-close {
  background: color-mix(in srgb, var(--surface) 50%, transparent);
  border: 1px solid color-mix(in srgb, var(--plasma-cyan) 20%, transparent);
  color: var(--text);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 1.125rem;
  display: grid;
  place-items: center;
  transition: background var(--motion-fast) var(--ease-out),
    border-color var(--motion-fast) var(--ease-out);
}

.fs-close:hover {
  background: color-mix(in srgb, var(--plasma-cyan) 15%, transparent);
  border-color: var(--plasma-cyan);
}

.fs-grid {
  display: grid;
  gap: 1.25rem;
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0;
  align-content: start;
}

.fs-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 1rem;
  border-radius: 16px;
  cursor: pointer;
  text-align: center;
  transition: transform var(--motion-fast) var(--ease-float),
    border-color var(--motion-fast) var(--ease-out),
    box-shadow var(--motion-fast) var(--ease-out);
  animation: materialize var(--motion-base) var(--ease-hologram) both;
  animation-delay: calc(var(--card-index, 0) * 60ms);
}

.fs-card:hover {
  transform: translateY(-4px) scale(1.02);
  border-color: color-mix(in srgb, var(--plasma-cyan) 40%, transparent);
  box-shadow: 0 8px 32px color-mix(in srgb, var(--plasma-cyan) 12%, transparent);
}

.fs-card-selected {
  border-color: var(--plasma-cyan);
  box-shadow:
    0 0 24px color-mix(in srgb, var(--plasma-cyan) 20%, transparent),
    inset 0 0 16px color-mix(in srgb, var(--plasma-cyan) 8%, transparent);
}

.fs-card-directory {
  background: color-mix(
    in srgb,
    var(--plasma-violet) 6%,
    var(--surface) 70%
  );
}

.fs-card-icon {
  font-size: 2rem;
  line-height: 1;
}

.fs-card-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text);
  word-break: break-word;
  line-height: 1.3;
}

.fs-card-subtitle {
  font-size: 0.75rem;
  color: color-mix(in srgb, var(--text) 50%, transparent);
}

.fs-gaze-ring {
  position: absolute;
  inset: -4px;
  width: calc(100% + 8px);
  height: calc(100% + 8px);
  pointer-events: none;
}

.fs-gaze-ring circle {
  transition: stroke-dasharray 100ms linear;
}

.fs-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  flex: 1;
  opacity: 0.5;
}

.fs-empty-icon {
  font-size: 3rem;
}

.fs-empty-text {
  font-size: 1rem;
  color: color-mix(in srgb, var(--text) 60%, transparent);
}

.fs-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.fs-loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid color-mix(in srgb, var(--plasma-cyan) 20%, transparent);
  border-top-color: var(--plasma-cyan);
  border-radius: 50%;
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 700px) {
  .fs-overlay-content {
    padding: 1rem;
  }

  .fs-grid {
    gap: 0.75rem;
  }

  .fs-card {
    padding: 1rem 0.75rem;
  }

  .fs-card-icon {
    font-size: 1.5rem;
  }
}
```

- [ ] **Step 2: Run dev server and verify visually**

Run: `npm run dev` and navigate to the workspace page. Open the file browser overlay via browser console or by wiring it in Task 10.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/globals.css
git commit -m "feat(web): add holographic CSS for immersive file browser overlay"
```

---

## Task 9: Mobile — File Browser View

**Files:**
- Create: `apps/mobile/src/FileBrowserView.tsx`
- Create: `apps/mobile/src/FileNodeCard.tsx`

**Interfaces:**
- Consumes: `FileNode`, `FileSystemPort` from Task 1, `createFileNavigator` from Task 2
- Produces: `<FileBrowserView>` — consumed by App.tsx (Task 11)

- [ ] **Step 1: Write the mobile FileNodeCard**

Create `apps/mobile/src/FileNodeCard.tsx`:

```tsx
import React from "react";
import { StyleSheet, Text, View, Pressable } from "react-native";
import { palette as c, serif } from "./design";
import type { FileNode } from "../../packages/core/src/domain/fileSystem";

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
}: FileNodeCardProps): JSX.Element {
  const subtitle =
    node.kind === "directory"
      ? `${node.children.length} item${node.children.length !== 1 ? "s" : ""}`
      : node.kind === "file"
        ? formatSize(node.sizeBytes)
        : "Link";

  const icon =
    node.kind === "directory"
      ? "📁"
      : node.kind === "link"
        ? "🔗"
        : "📄";

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
    borderColor: c.cyan,
    shadowColor: c.cyan,
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  gazeBar: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 3,
    backgroundColor: c.cyan,
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
```

- [ ] **Step 2: Write the FileBrowserView**

Create `apps/mobile/src/FileBrowserView.tsx`:

```tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  SafeAreaView,
  Dimensions,
} from "react-native";
import { palette as c, serif } from "./design";
import type { FileNode, FileSystemPort } from "../../packages/core/src/domain/fileSystem";
import {
  createFileNavigator,
  type FileNavState,
} from "../../packages/core/src/domain/fileNavigation";
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
}: FileBrowserViewProps): JSX.Element {
  const navigatorRef = useRef<ReturnType<typeof createFileNavigator> | null>(null);
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
            <Text style={s.closeText}>✕</Text>
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
              <Text style={s.emptyIcon}>📂</Text>
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
    ...StyleSheet.absoluteFillObject,
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
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/FileBrowserView.tsx apps/mobile/src/FileNodeCard.tsx
git commit -m "feat(mobile): add FileBrowserView with holographic cards and spatial grid"
```

---

## Task 10: Web — Integrate File Browser into Workspace

**Files:**
- Modify: `apps/web/app/components/Workspace.tsx`
- Modify: `apps/web/app/components/MotionActions.tsx`

**Interfaces:**
- Consumes: `ImmersiveFileBrowser` from Task 7, `createMemoryFileSystem` from Task 4, `fileDefaultTriggers` from Task 3
- Produces: File browser is now accessible from the Workspace via voice ("open files"), gesture (swipe up with 2 fingers), or button

- [ ] **Step 1: Add file browser state and imports to Workspace**

In `apps/web/app/components/Workspace.tsx`, add imports:

```typescript
import ImmersiveFileBrowser from "./ImmersiveFileBrowser";
import { createMemoryFileSystem } from "@/packages/adapters/src/fileSystem";
import type { FileNode } from "@/packages/core/src/domain/fileSystem";
```

Add state inside the `Workspace` component:

```typescript
const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
const fileSystemRef = useRef(createMemoryFileSystem());
```

- [ ] **Step 2: Extend handleVoiceAction for file actions**

In the existing `handleVoiceAction` function in Workspace.tsx, add cases for the new file actions:

```typescript
case "open":
  setFileBrowserOpen(true);
  setVoiceActionNotice("Opening file browser");
  break;
case "select":
  setVoiceActionNotice("Select a file with gaze or gesture");
  break;
case "search":
  setVoiceActionNotice("Search coming soon");
  break;
```

- [ ] **Step 3: Add ImmersiveFileBrowser to the render tree**

In the Workspace render, add the file browser overlay just before the closing `</main>` tag:

```tsx
<ImmersiveFileBrowser
  open={fileBrowserOpen}
  fs={fileSystemRef.current}
  rootId="root"
  onClose={() => setFileBrowserOpen(false)}
  onFileSelect={(node: FileNode) => {
    if (node.kind === "file" && node.sourceId) {
      setVoiceActionNotice(`Selected: ${node.name}`);
    }
    setFileBrowserOpen(false);
  }}
/>
```

- [ ] **Step 4: Add file browser gesture mapping in MotionActions**

In `apps/web/app/components/MotionActions.tsx`, add a `fileBrowserOpen` prop:

```typescript
export type MotionActionsProps = {
  // ... existing props
  fileBrowserOpen?: boolean;
  onFileAction?: (action: "navigateUp" | "next" | "prev" | "openSelected") => void;
};
```

In the `perform` function, add file browser gesture mappings when `fileBrowserOpen` is true:

```typescript
if (fileBrowserOpen && onFileAction) {
  switch (gesture) {
    case "right":
      onFileAction("next");
      return;
    case "left":
      onFileAction("prev");
      return;
    case "hold":
      onFileAction("openSelected");
      return;
    case "up":
      onFileAction("navigateUp");
      return;
  }
}
```

- [ ] **Step 5: Run all web tests**

Run: `npx vitest run apps/web/`
Expected: All pass — no regressions

- [ ] **Step 6: Verify in browser**

Run: `npm run dev`
1. Navigate to the workspace page
2. Say "open" or use keyboard shortcut to open file browser
3. Verify holographic file cards appear over the video background
4. Navigate with arrow keys, gaze, or gestures
5. Verify breadcrumb updates when entering directories
6. Verify close button works

- [ ] **Step 7: Commit**

```bash
git add apps/web/app/components/Workspace.tsx apps/web/app/components/MotionActions.tsx
git commit -m "feat(web): integrate immersive file browser into workspace with voice and gesture control"
```

---

## Task 11: Mobile — Integrate File Browser into App

**Files:**
- Modify: `apps/mobile/App.tsx`
- Modify: `apps/mobile/src/MotionCameraView.tsx`

**Interfaces:**
- Consumes: `FileBrowserView` from Task 9, `createMemoryFileSystem` from Task 4
- Produces: File browser accessible from mobile app via voice or gesture

- [ ] **Step 1: Add file browser state to App.tsx**

In `apps/mobile/App.tsx`, add imports:

```typescript
import FileBrowserView from "./src/FileBrowserView";
import { createMemoryFileSystem } from "../../packages/adapters/src/fileSystem";
import type { FileNode } from "../../packages/core/src/domain/fileSystem";
```

Add state:

```typescript
const [fileBrowserOpen, setFileBrowserOpen] = useState(false);
const fileSystemRef = useRef(createMemoryFileSystem());
```

- [ ] **Step 2: Extend handleVoiceAction for file actions**

In the existing `handleVoiceAction` function:

```typescript
case "open":
  setFileBrowserOpen(true);
  setToast("Opening files");
  break;
```

- [ ] **Step 3: Render FileBrowserView**

Add to the render tree, alongside the MotionCameraView:

```tsx
{fileBrowserOpen && (
  <FileBrowserView
    fs={fileSystemRef.current}
    rootId="root"
    onClose={() => setFileBrowserOpen(false)}
    onFileSelect={(node: FileNode) => {
      setToast(`Selected: ${node.name}`);
      setFileBrowserOpen(false);
    }}
  />
)}
```

- [ ] **Step 4: Add file navigation gestures to MotionCameraView**

In `apps/mobile/src/MotionCameraView.tsx`, add a `fileBrowserOpen` prop. When true, remap gestures:

```typescript
// In the body gesture handler:
if (fileBrowserOpen) {
  switch (gesture) {
    case "leanLeft":
    case "swipeLeft":
      // dispatch prev to file navigator
      break;
    case "leanRight":
    case "swipeRight":
      // dispatch next to file navigator
      break;
    case "nod":
      // dispatch openSelected
      break;
    case "shake":
      // dispatch navigateUp
      break;
  }
  return;
}
```

- [ ] **Step 5: Run mobile tests**

Run: `npx vitest run apps/mobile/`
Expected: All pass — no regressions

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/App.tsx apps/mobile/src/MotionCameraView.tsx
git commit -m "feat(mobile): integrate file browser overlay with voice and gesture control"
```

---

## Task 12: Gaze Integration — Connect Face Reader to File Browser

**Files:**
- Modify: `apps/web/app/components/ImmersiveFileBrowser.tsx` (already created in Task 7)
- Modify: `apps/web/app/components/Workspace.tsx`

**Interfaces:**
- Consumes: `createFaceReader` from `packages/core/src/domain/faceTracking`, existing motion camera
- Produces: Gaze position flows from camera → face reader → file browser → gaze-dwell selection

- [ ] **Step 1: Add gaze state to Workspace**

In Workspace.tsx, add state for gaze position:

```typescript
const [gazePosition, setGazePosition] = useState<{ x: number; y: number } | null>(null);
```

- [ ] **Step 2: Wire gaze from MotionActions to Workspace**

Add a prop to MotionActions for reporting gaze:

```typescript
onGazeUpdate?: (position: { x: number; y: number } | null) => void;
```

In MotionActions, when the motion camera detects face position, call `onGazeUpdate` with normalized coordinates.

- [ ] **Step 3: Pass gaze to ImmersiveFileBrowser**

```tsx
<ImmersiveFileBrowser
  open={fileBrowserOpen}
  fs={fileSystemRef.current}
  rootId="root"
  onClose={() => setFileBrowserOpen(false)}
  onFileSelect={handleFileSelect}
  gaze={gazePosition}
/>
```

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All pass

- [ ] **Step 5: Verify gaze-dwell in browser**

1. Open workspace with motion mode active
2. Open file browser
3. Look at a file card (simulated face tracking moves gaze)
4. Verify gaze ring fills around the card
5. Verify file is selected after dwell time

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/components/Workspace.tsx apps/web/app/components/MotionActions.tsx apps/web/app/components/ImmersiveFileBrowser.tsx
git commit -m "feat(web): connect face reader gaze to file browser dwell selection"
```

---

## Task 13: Final Integration Test and Polish

**Files:**
- Create: `tests/bdd/fileBrowser.feature`
- Create: `tests/bdd/fileBrowser.ts`

**Interfaces:**
- Consumes: All previous tasks
- Produces: BDD test coverage for the file browser feature

- [ ] **Step 1: Write the BDD feature file**

Create `tests/bdd/fileBrowser.feature`:

```gherkin
Feature: Immersive File Browser

  Scenario: Open file browser with voice command
    Given the workspace is loaded
    When the user says "open"
    Then the file browser overlay appears
    And the breadcrumb shows "My Documents"
    And the grid shows demo files and folders

  Scenario: Navigate into a directory
    Given the file browser is open
    When the user navigates into "Projects"
    Then the breadcrumb shows "My Documents / Projects"
    And the grid shows files inside "Projects"

  Scenario: Navigate up with gesture
    Given the file browser is open inside "Projects"
    When the user swipes up
    Then the file browser returns to "My Documents"

  Scenario: Select a file with gaze dwell
    Given the file browser is open
    When the user gazes at a file for 1.2 seconds
    Then the file is selected
    And the file browser closes

  Scenario: Close file browser
    Given the file browser is open
    When the user says "cancel" or presses Escape
    Then the file browser closes
```

- [ ] **Step 2: Write the BDD step definitions**

Create `tests/bdd/fileBrowser.ts`:

```typescript
import { Given, When, Then, Before } from "@cucumber/cucumber";
import { strict as assert } from "node:assert";
import { createMemoryFileSystem } from "../../packages/adapters/src/fileSystem";
import { createFileNavigator } from "../../packages/core/src/domain/fileNavigation";
import type { FileSystemPort } from "../../packages/core/src/domain/fileSystem";

type World = {
  fs: FileSystemPort;
  nav: ReturnType<typeof createFileNavigator>;
};

let world: World;

Before(function () {
  world = {
    fs: createMemoryFileSystem(),
    nav: createFileNavigator({
      fs: createMemoryFileSystem(),
      rootId: "root",
    }),
  };
});

Given("the workspace is loaded", function () {
  assert.ok(world.fs);
});

Given("the file browser is open", async function () {
  await world.nav.load();
});

Given("the file browser is open inside {string}", async function (dirName: string) {
  await world.nav.load();
  const state = world.nav.snapshot();
  const dir = state.nodes.find(
    (n) => n.kind === "directory" && n.name === dirName,
  );
  assert.ok(dir, `Directory "${dirName}" not found`);
  if (dir) world.nav.dispatch({ type: "navigate", directoryId: dir.id });
  await world.nav.ready();
});

When("the user says {string}", function (_command: string) {
  // Voice command "open" maps to setFileBrowserOpen(true)
});

When("the user navigates into {string}", async function (dirName: string) {
  const state = world.nav.snapshot();
  const dir = state.nodes.find(
    (n) => n.kind === "directory" && n.name === dirName,
  );
  assert.ok(dir, `Directory "${dirName}" not found`);
  if (dir) world.nav.dispatch({ type: "navigate", directoryId: dir.id });
  await world.nav.ready();
});

When("the user swipes up", function () {
  world.nav.dispatch({ type: "navigateUp" });
});

When("the user gazes at a file for {float} seconds", async function (_seconds: number) {
  const state = world.nav.snapshot();
  const fileIdx = state.nodes.findIndex((n) => n.kind === "file");
  if (fileIdx >= 0) {
    world.nav.dispatch({ type: "select", index: fileIdx });
  }
});

Then("the file browser overlay appears", async function () {
  const state = world.nav.snapshot();
  assert.ok(state.nodes.length > 0);
});

Then("the breadcrumb shows {string}", function (expected: string) {
  const state = world.nav.snapshot();
  const trail = state.breadcrumb.map((e) => e.name).join(" / ");
  assert.equal(trail, expected);
});

Then("the grid shows demo files and folders", function () {
  const state = world.nav.snapshot();
  assert.ok(state.nodes.some((n) => n.kind === "directory"));
  assert.ok(state.nodes.some((n) => n.kind === "file"));
});

Then("the breadcrumb shows {string} inside breadcrumb", function (_expected: string) {
  const state = world.nav.snapshot();
  assert.ok(state.breadcrumb.length >= 2);
});

Then("the grid shows files inside {string}", function (_dirName: string) {
  const state = world.nav.snapshot();
  assert.ok(state.nodes.length > 0);
});

Then("the file browser returns to {string}", function (expectedDir: string) {
  const state = world.nav.snapshot();
  const currentName = state.breadcrumb[state.breadcrumb.length - 1]?.name;
  assert.equal(currentName, expectedDir);
});

Then("the file is selected", function () {
  const state = world.nav.snapshot();
  assert.ok(state.selectedIndex >= 0);
});

Then("the file browser closes", function () {
  // UI-level assertion: onClose callback fires
});
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run && npm run test:gherkin`
Expected: All tests pass, including new file browser BDD scenarios

- [ ] **Step 4: Final commit**

```bash
git add tests/bdd/fileBrowser.feature tests/bdd/fileBrowser.ts
git commit -m "test(bdd): add file browser BDD scenarios for voice, gesture, and gaze navigation"
```

---

## Execution Summary

| Task | Layer | Deliverable | Est. Time |
|------|-------|-------------|-----------|
| 1 | Domain | File system types + port | 10 min |
| 2 | Domain | Navigation state machine | 20 min |
| 3 | Domain | File voice actions (bilingual) | 15 min |
| 4 | Adapter | In-memory demo file system | 10 min |
| 5 | Web | FileNodeCard component | 15 min |
| 6 | Web | Gaze-dwell selection hook | 15 min |
| 7 | Web | ImmersiveFileBrowser overlay | 20 min |
| 8 | Web | Holographic CSS | 10 min |
| 9 | Mobile | FileBrowserView + FileNodeCard | 20 min |
| 10 | Web | Workspace integration | 15 min |
| 11 | Mobile | App.tsx integration | 15 min |
| 12 | Web | Gaze → file browser wiring | 15 min |
| 13 | Test | BDD scenarios + polish | 15 min |
| | | **Total** | **~3 hours** |
