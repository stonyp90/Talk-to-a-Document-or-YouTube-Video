import { describe, it, expect } from "vitest";
import { createVirtualFileSystem } from "./virtualFileSystem";

describe("VirtualFileSystem", () => {
  it("creates with default folders", () => {
    const vfs = createVirtualFileSystem();
    const root = vfs.list("root");
    const names = root.map((n) => n.name);
    expect(names).toContain("Documents");
    expect(names).toContain("Uploads");
    expect(names).toContain("Recent");
  });

  it("adds file to Uploads folder", () => {
    const vfs = createVirtualFileSystem();
    vfs.addFile({
      name: "test.txt",
      kind: "file",
      fileType: "document",
      sizeBytes: 100,
      parentId: "uploads",
    });
    const uploads = vfs.list("uploads");
    expect(uploads.some((n) => n.name === "test.txt")).toBe(true);
  });

  it("enforces 10-level nesting cap", () => {
    const vfs = createVirtualFileSystem();
    let parentId = "root";
    for (let i = 0; i < 10; i++) {
      parentId = vfs.createDirectory(`level${i}`, parentId);
    }
    expect(() => vfs.createDirectory("level10", parentId)).toThrow();
  });
});
