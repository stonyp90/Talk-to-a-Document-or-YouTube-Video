// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import {
  GestureFileBrowser,
  mirrorGesture,
  gestureToNavAction,
  isGestureAccepted,
  GESTURE_DEBOUNCE_MS,
} from "./GestureFileBrowser";
import type { FileSystemPort } from "@/packages/core/src/domain/fileSystem";

function createMockFs(): FileSystemPort {
  return {
    list: vi.fn().mockResolvedValue([]),
    getNode: vi.fn().mockResolvedValue(null),
    search: vi.fn().mockResolvedValue([]),
  };
}

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

  it("does not mirror hold gesture", () => {
    expect(mirrorGesture("hold", "left")).toBe("hold");
    expect(mirrorGesture("hold", "right")).toBe("hold");
  });
});

describe("gestureToNavAction", () => {
  it("maps up to navigateUp", () => {
    expect(gestureToNavAction("up", "right")).toEqual({ type: "navigateUp" });
  });

  it("maps down to openSelected", () => {
    expect(gestureToNavAction("down", "right")).toEqual({ type: "openSelected" });
  });

  it("maps right to next", () => {
    expect(gestureToNavAction("right", "right")).toEqual({ type: "next" });
  });

  it("maps left to prev", () => {
    expect(gestureToNavAction("left", "right")).toEqual({ type: "prev" });
  });

  it("maps hold to openSelected", () => {
    expect(gestureToNavAction("hold", "right")).toEqual({ type: "openSelected" });
  });

  it("mirrors horizontal gestures for left hand before mapping", () => {
    // left hand: "left" gesture mirrors to "right" -> next
    expect(gestureToNavAction("left", "left")).toEqual({ type: "next" });
    // left hand: "right" gesture mirrors to "left" -> prev
    expect(gestureToNavAction("right", "left")).toEqual({ type: "prev" });
  });

  it("does not mirror vertical gestures for left hand", () => {
    expect(gestureToNavAction("up", "left")).toEqual({ type: "navigateUp" });
    expect(gestureToNavAction("down", "left")).toEqual({ type: "openSelected" });
  });
});

describe("isGestureAccepted (debounce)", () => {
  it("accepts first gesture (lastAcceptedAt = 0)", () => {
    expect(isGestureAccepted(1000, 0)).toBe(true);
  });

  it("rejects gesture within debounce window", () => {
    const lastAccepted = 1000;
    expect(isGestureAccepted(lastAccepted + GESTURE_DEBOUNCE_MS - 1, lastAccepted)).toBe(false);
  });

  it("accepts gesture at exactly debounce boundary", () => {
    const lastAccepted = 1000;
    expect(isGestureAccepted(lastAccepted + GESTURE_DEBOUNCE_MS, lastAccepted)).toBe(true);
  });

  it("accepts gesture after debounce window", () => {
    const lastAccepted = 1000;
    expect(isGestureAccepted(lastAccepted + GESTURE_DEBOUNCE_MS + 100, lastAccepted)).toBe(true);
  });

  it("exports GESTURE_DEBOUNCE_MS as 300", () => {
    expect(GESTURE_DEBOUNCE_MS).toBe(300);
  });
});

describe("GestureFileBrowser", () => {
  it("renders nothing when not open", () => {
    const { container } = render(
      <GestureFileBrowser
        open={false}
        fs={createMockFs()}
        rootId="root"
        handPreference="right"
        onClose={vi.fn()}
        onFileSelect={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders wrapper div when open", () => {
    const { container } = render(
      <GestureFileBrowser
        open={true}
        fs={createMockFs()}
        rootId="root"
        handPreference="right"
        onClose={vi.fn()}
        onFileSelect={vi.fn()}
      />,
    );
    // Should render the gestureBrowser wrapper div
    expect(container.firstChild).not.toBeNull();
    // CSS module hashes class names, so check the wrapper exists
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.tagName).toBe("DIV");
  });

  it("renders when motionGesture prop is provided", () => {
    const { container } = render(
      <GestureFileBrowser
        open={true}
        fs={createMockFs()}
        rootId="root"
        handPreference="right"
        onClose={vi.fn()}
        onFileSelect={vi.fn()}
        motionGesture="up"
      />,
    );
    expect(container.firstChild).not.toBeNull();
  });

  it("renders when motionGesture is null", () => {
    const { container } = render(
      <GestureFileBrowser
        open={true}
        fs={createMockFs()}
        rootId="root"
        handPreference="left"
        onClose={vi.fn()}
        onFileSelect={vi.fn()}
        motionGesture={null}
      />,
    );
    expect(container.firstChild).not.toBeNull();
  });
});
