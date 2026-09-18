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
  parentId?: string | null;
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
