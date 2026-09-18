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
    expect(nav.snapshot().selectedIndex).toBe(-1);
    nav.dispatch({ type: "next" });
    expect(nav.snapshot().selectedIndex).toBe(0);
    nav.dispatch({ type: "next" });
    expect(nav.snapshot().selectedIndex).toBe(1);
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
