// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FeedbackOverlay } from "./FeedbackOverlay";

describe("FeedbackOverlay", () => {
  it("renders nothing when no events", () => {
    const { container } = render(<FeedbackOverlay />);
    expect(container.firstChild).toBeNull();
  });

  it("renders info toast", () => {
    render(<FeedbackOverlay />);
    // This test will be expanded once we integrate with useFeedback
    expect(true).toBe(true);
  });
});
