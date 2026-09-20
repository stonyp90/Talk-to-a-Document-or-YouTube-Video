// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { GestureFileBrowser, mirrorGesture } from "./GestureFileBrowser";

describe("mirrorGesture", () => {
  it("mirrors horizontal gestures for left hand", () => {
    expect(mirrorGesture("left", "left")).toBe("right");
    expect(mirrorGesture("right", "left")).toBe("left");
  });

  it("does not mirror vertical gestures", () => {
    expect(mirrorGesture("up", "left")).toBe("up");
    expect(mirrorGesture("down", "left")).toBe("down");
  });

  it("does not mirror for right hand", () => {
    expect(mirrorGesture("left", "right")).toBe("left");
    expect(mirrorGesture("right", "right")).toBe("right");
  });
});

describe("GestureFileBrowser", () => {
  it("renders nothing when not open", () => {
    const { container } = render(
      <GestureFileBrowser
        open={false}
        fs={{} as any}
        rootId="root"
        handPreference="right"
        onClose={vi.fn()}
        onFileSelect={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
