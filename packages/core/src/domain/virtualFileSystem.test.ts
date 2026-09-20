import { describe, it, expect } from "vitest";
import { createVirtualFileSystem } from "./virtualFileSystem";

describe("VirtualFileSystem", () => {
  it("creates with default folders", async () => {
    const vfs = createVirtualFileSystem();
    const root = await vfs.list("root");
    const names = root.map((n) => n.name);
    expect(names).toContain("Documents");
    expect(names).toContain("Uploads");
    expect(names).toContain("Recent");
  });

  it("adds file to Uploads folder", async () => {
    const vfs = createVirtualFileSystem();
    await vfs.addFile({
      name: "test.txt",
      kind: "file",
      fileType: "document",
      sizeBytes: 100,
      parentId: "uploads",
    });
    const uploads = await vfs.list("uploads");
    expect(uploads.some((n) => n.name === "test.txt")).toBe(true);
  });

  it("enforces 10-level nesting cap", async () => {
    const vfs = createVirtualFileSystem();
    let parentId = "root";
    for (let i = 0; i < 10; i++) {
      parentId = await vfs.createDirectory(`level${i}`, parentId);
    }
    await expect(vfs.createDirectory("level10", parentId)).rejects.toThrow();
  });

  it("getNode returns the correct node", async () => {
    const vfs = createVirtualFileSystem();
    const root = await vfs.getNode("root");
    expect(root).not.toBeNull();
    expect(root!.name).toBe("Root");
    expect(root!.kind).toBe("directory");
  });

  it("getNode returns null for unknown ID", async () => {
    const vfs = createVirtualFileSystem();
    const result = await vfs.getNode("nonexistent");
    expect(result).toBeNull();
  });

  it("list returns empty array for non-existent directory", async () => {
    const vfs = createVirtualFileSystem();
    const result = await vfs.list("nonexistent");
    expect(result).toEqual([]);
  });

  it("addFile defaults to uploads when no parentId given", async () => {
    const vfs = createVirtualFileSystem();
    await vfs.addFile({
      name: "orphan.txt",
      kind: "file",
      fileType: "document",
      sizeBytes: 50,
    });
    const uploads = await vfs.list("uploads");
    expect(uploads.some((n) => n.name === "orphan.txt")).toBe(true);
  });

  it("files appear in recent folder after addFile", async () => {
    const vfs = createVirtualFileSystem();
    await vfs.addFile({
      name: "newfile.pdf",
      kind: "file",
      fileType: "pdf",
      sizeBytes: 200,
      parentId: "documents",
    });
    const recent = await vfs.list("recent");
    expect(recent.some((n) => n.name === "newfile.pdf")).toBe(true);
  });

  it("search finds files by name (case-insensitive)", async () => {
    const vfs = createVirtualFileSystem();
    await vfs.addFile({
      name: "Report.pdf",
      kind: "file",
      fileType: "pdf",
      sizeBytes: 300,
      parentId: "documents",
    });
    await vfs.addFile({
      name: "Notes.txt",
      kind: "file",
      fileType: "document",
      sizeBytes: 100,
      parentId: "documents",
    });
    const results = await vfs.search("report");
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe("Report.pdf");
  });

  it("search returns empty for no matches", async () => {
    const vfs = createVirtualFileSystem();
    const results = await vfs.search("zzz-no-match");
    expect(results).toEqual([]);
  });

  it("search returns empty for empty query", async () => {
    const vfs = createVirtualFileSystem();
    const results = await vfs.search("");
    expect(results).toEqual([]);
  });

  it("search excludes directories", async () => {
    const vfs = createVirtualFileSystem();
    const results = await vfs.search("documents");
    expect(results.every((n) => n.kind !== "directory")).toBe(true);
  });

  it("list methods return Promises (async contract)", () => {
    const vfs = createVirtualFileSystem();
    expect(vfs.list("root")).toBeInstanceOf(Promise);
    expect(vfs.getNode("root")).toBeInstanceOf(Promise);
    expect(vfs.search("test")).toBeInstanceOf(Promise);
    expect(
      vfs.addFile({
        name: "x.txt",
        kind: "file",
        fileType: "document",
        sizeBytes: 1,
      }),
    ).toBeInstanceOf(Promise);
    expect(vfs.createDirectory("sub", "root")).toBeInstanceOf(Promise);
  });
});
