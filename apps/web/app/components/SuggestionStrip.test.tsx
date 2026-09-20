// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { SuggestionStrip } from "./SuggestionStrip";

afterEach(cleanup);

describe("SuggestionStrip", () => {
  it("renders nothing when no suggestions", () => {
    const { container } = render(<SuggestionStrip suggestions={[]} onAction={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders suggestion chips", () => {
    const suggestions = [
      { action: "upload" as const, label: "Upload file" },
      { action: "youtube" as const, label: "YouTube video" },
    ];
    render(<SuggestionStrip suggestions={suggestions} onAction={vi.fn()} />);
    expect(screen.getByText("Upload file")).toBeInTheDocument();
    expect(screen.getByText("YouTube video")).toBeInTheDocument();
  });

  it("calls onAction when chip clicked", () => {
    const onAction = vi.fn();
    const suggestions = [{ action: "upload" as const, label: "Upload file" }];
    render(<SuggestionStrip suggestions={suggestions} onAction={onAction} />);
    fireEvent.click(screen.getByText("Upload file"));
    expect(onAction).toHaveBeenCalledWith("upload");
  });
});
