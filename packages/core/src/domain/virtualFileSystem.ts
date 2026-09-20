import type { FileNode, FileSystemListing, FileType } from "./fileSystem";

const MAX_DEPTH = 10;

type AddFileInput = {
  name: string;
  kind: "file";
  fileType: FileType;
  sizeBytes: number;
  parentId?: string;
};

export function createVirtualFileSystem() {
  const nodes = new Map<string, FileNode>();
  let nextId = 100;

  function makeId(): string {
    return `vfs-${nextId++}`;
  }

  const root: FileNode = {
    id: "root",
    name: "Root",
    kind: "directory",
    children: ["documents", "uploads", "recent"],
    parentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  nodes.set("root", root);

  const documents: FileNode = {
    id: "documents",
    name: "Documents",
    kind: "directory",
    children: [],
    parentId: "root",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  nodes.set("documents", documents);

  const uploads: FileNode = {
    id: "uploads",
    name: "Uploads",
    kind: "directory",
    children: [],
    parentId: "root",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  nodes.set("uploads", uploads);

  const recent: FileNode = {
    id: "recent",
    name: "Recent",
    kind: "directory",
    children: [],
    parentId: "root",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  nodes.set("recent", recent);

  function getDepth(nodeId: string): number {
    let depth = 0;
    let current = nodes.get(nodeId);
    while (current?.parentId) {
      depth++;
      current = nodes.get(current.parentId);
    }
    return depth;
  }

  return {
    list(directoryId: string): FileSystemListing {
      const dir = nodes.get(directoryId);
      if (!dir || dir.kind !== "directory") return [];
      return dir.children.map((id) => nodes.get(id)!).filter(Boolean);
    },

    addFile(input: AddFileInput): FileNode {
      const id = makeId();
      const parentId = input.parentId || "uploads";
      const node: FileNode = {
        id,
        name: input.name,
        kind: "file",
        fileType: input.fileType,
        sizeBytes: input.sizeBytes,
        parentId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      nodes.set(id, node);

      const parent = nodes.get(parentId);
      if (parent && parent.kind === "directory") {
        parent.children.push(id);
        parent.updatedAt = new Date();
      }

      const recentDir = nodes.get("recent");
      if (recentDir && recentDir.kind === "directory") {
        recentDir.children.unshift(id);
      }

      return node;
    },

    createDirectory(name: string, parentId: string): string {
      if (getDepth(parentId) >= MAX_DEPTH) {
        throw new Error(`Maximum folder depth (${MAX_DEPTH}) exceeded`);
      }
      const id = makeId();
      const node: FileNode = {
        id,
        name,
        kind: "directory",
        children: [],
        parentId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      nodes.set(id, node);

      const parent = nodes.get(parentId);
      if (parent && parent.kind === "directory") {
        parent.children.push(id);
      }
      return id;
    },

    getNode(nodeId: string): FileNode | null {
      return nodes.get(nodeId) || null;
    },
  };
}
