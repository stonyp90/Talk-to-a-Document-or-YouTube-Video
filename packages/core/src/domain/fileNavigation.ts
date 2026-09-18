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
      currentId = node.parentId ?? null;
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
          state = { ...state, loading: true };
          notify();
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
