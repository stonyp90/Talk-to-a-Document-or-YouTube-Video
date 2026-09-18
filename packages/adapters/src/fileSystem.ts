import type { FileNode, FileSystemPort, FileSystemListing } from "../../core/src/domain/fileSystem";

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
