// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedbackOverlay } from "./FeedbackOverlay";
import { FeedbackType } from "@talk/core/domain/feedbackBus";

const state = vi.hoisted(() => ({
  events: [] as { type: FeedbackType; message: string; timestamp: Date; duration: number; action?: string }[],
}));

vi.mock("./useFeedback", () => ({
  useFeedback: () => ({
    get events() { return state.events; },
    dismissEvent: vi.fn(),
  }),
}));

describe("FeedbackOverlay", () => {
  beforeEach(() => {
    state.events = [];
  });

  it("renders nothing when no events", () => {
    const { container } = render(<FeedbackOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it("renders toasts with correct roles and action button", () => {
    state.events = [
      { type: FeedbackType.INFO, message: "Listening...", timestamp: new Date(Date.now() - 2000), duration: 3000 },
      { type: FeedbackType.SUCCESS, message: "File uploaded", timestamp: new Date(Date.now() - 1000), duration: 1200 },
      { type: FeedbackType.ERROR, message: "Upload failed", timestamp: new Date(), duration: 6000, action: "Retry" },
    ];
    render(<FeedbackOverlay />);
    const infoToast = screen.getByText("Listening...").parentElement!;
    const successToast = screen.getByText("File uploaded").parentElement!;
    const errorToast = screen.getByText("Upload failed").parentElement!;
    expect(infoToast).toHaveAttribute("role", "status");
    expect(successToast).toHaveAttribute("role", "status");
    expect(errorToast).toHaveAttribute("role", "alert");
    expect(screen.getByText("Retry")).toBeInTheDocument();
  });
});
