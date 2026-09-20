// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { DistanceRing } from "./DistanceRing";

describe("DistanceRing", () => {
  it("renders nothing when no estimate", () => {
    const { container } = render(<DistanceRing estimate={null} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders ring with close class", () => {
    const { container } = render(<DistanceRing estimate="close" />);
    expect(container.firstChild).toHaveClass(/close/);
  });

  it("renders ring with far class", () => {
    const { container } = render(<DistanceRing estimate="far" />);
    expect(container.firstChild).toHaveClass(/far/);
  });
});
