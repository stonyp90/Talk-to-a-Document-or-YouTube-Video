// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
  afterEach(() => cleanup());

  it("renders file name", () => {
    render(<FileNodeCard node={pdfFile} selected={false} index={0} />);
    expect(screen.getByText("Annual Report.pdf")).toBeInTheDocument();
  });

  it("renders directory with child count", () => {
    render(<FileNodeCard node={directory} selected={false} index={0} />);
    expect(screen.getByText("Projects")).toBeInTheDocument();
    expect(screen.getByText("1 item")).toBeInTheDocument();
  });

  it("renders link with description", () => {
    render(<FileNodeCard node={videoLink} selected={false} index={0} />);
    expect(screen.getByText("Demo Video")).toBeInTheDocument();
  });

  it("applies selected class when selected", () => {
    const { container } = render(
      <FileNodeCard node={pdfFile} selected={true} index={0} />,
    );
    expect(container.firstChild).toHaveClass("fs-card-selected");
  });

  it("shows file size for files", () => {
    render(<FileNodeCard node={pdfFile} selected={false} index={0} />);
    expect(screen.getByText("2.4 MB")).toBeInTheDocument();
  });

  it("renders gaze dwell ring container", () => {
    const { container } = render(
      <FileNodeCard node={pdfFile} selected={false} index={0} gazeProgress={0.5} />,
    );
    const ring = container.querySelector(".fs-gaze-ring");
    expect(ring).not.toBeNull();
  });
});
