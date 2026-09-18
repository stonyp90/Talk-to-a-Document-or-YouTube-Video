// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useGazeDwell } from "./GazeDwell";

describe("useGazeDwell", () => {
  it("returns no progress when gaze is absent", () => {
    const { result } = renderHook(() =>
      useGazeDwell({
        gaze: null,
        itemCount: 6,
        columns: 3,
        dwellMs: 500,
      }),
    );
    expect(result.current.hoveredIndex).toBe(-1);
    expect(result.current.progress).toBe(0);
  });

  it("maps gaze position to grid index", () => {
    const { result } = renderHook(() =>
      useGazeDwell({
        gaze: { x: 0.5, y: 0.5 },
        itemCount: 6,
        columns: 3,
        dwellMs: 500,
      }),
    );
    expect(result.current.hoveredIndex).toBe(4);
  });

  it("returns -1 for out-of-range index", () => {
    const { result } = renderHook(() =>
      useGazeDwell({
        gaze: { x: 0.99, y: 0.99 },
        itemCount: 2,
        columns: 3,
        dwellMs: 500,
      }),
    );
    expect(result.current.hoveredIndex).toBe(-1);
  });

  it("fires onDwell when gaze holds on same item for dwellMs", async () => {
    vi.useFakeTimers();
    const onDwell = vi.fn();
    renderHook(() =>
      useGazeDwell({
        gaze: { x: 0.17, y: 0.17 },
        itemCount: 6,
        columns: 3,
        dwellMs: 500,
        onDwell,
      }),
    );
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(onDwell).toHaveBeenCalledWith(0);
    vi.useRealTimers();
  });

  it("resets progress when gaze moves to different item", () => {
    vi.useFakeTimers();
    const onDwell = vi.fn();
    const { rerender } = renderHook(
      ({ gaze }) =>
        useGazeDwell({
          gaze,
          itemCount: 6,
          columns: 3,
          dwellMs: 500,
          onDwell,
        }),
      { initialProps: { gaze: { x: 0.17, y: 0.17 } as { x: number; y: number } | null } },
    );
    act(() => {
      vi.advanceTimersByTime(300);
    });
    rerender({ gaze: { x: 0.83, y: 0.17 } });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(onDwell).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
