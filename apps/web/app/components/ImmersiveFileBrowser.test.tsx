// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
  afterEach(() => cleanup());

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
    expect(breadcrumb).toBeInTheDocument();
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
    expect(await screen.findByText("Projects")).toBeInTheDocument();
    expect(await screen.findByText("Report.pdf")).toBeInTheDocument();
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
    expect(screen.getByLabelText("Close file browser")).toBeInTheDocument();
  });
});
