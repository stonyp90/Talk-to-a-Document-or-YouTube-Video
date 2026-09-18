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
