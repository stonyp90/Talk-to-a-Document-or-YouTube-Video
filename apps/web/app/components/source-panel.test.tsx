// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../../src/lib/realtimeClient", () => ({
  RealtimeClient: class {
    connect = vi.fn();
    stop = vi.fn();
  },
}));
import Workspace from "./Workspace";

beforeEach(() => localStorage.setItem("ursly-intro-v1", "seen"));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("the source panel", () => {
  it("puts no lone icon beside the YouTube field", () => {
    render(<Workspace />);
    fireEvent.click(screen.getByRole("tab", { name: /youtube/i }));
    expect(screen.getByLabelText(/youtube url/i)).toBeDefined();
    // `.upload-icon` is the drop target's bordered square. Beside a plain
    // text field it reads as a detached button that does nothing.
    const panel = screen.getByRole("tabpanel");
    expect(panel.querySelectorAll(".upload-icon")).toHaveLength(0);
  });

  it("keeps that icon where it means something, on the drop target", () => {
    render(<Workspace />);
    const panel = screen.getByRole("tabpanel");
    expect(panel.querySelectorAll(".upload-icon").length).toBeGreaterThan(0);
  });
});
