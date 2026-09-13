// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppLoader, LOADER_MAX_MS, LOADER_MIN_MS, useAppReady } from "./AppLoader";

function Harness({ reduced = false }: { reduced?: boolean }) {
  const ready = useAppReady({ reduced });
  return (
    <>
      <AppLoader ready={ready} />
      <p>{ready ? "ready" : "loading"}</p>
    </>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("AppLoader", () => {
  it("shows an accessible opening status from the first paint", () => {
    render(<Harness />);
    const status = screen.getByRole("status", { name: "Ursly is opening" });
    expect(status).toBeInTheDocument();
    expect(status).not.toHaveAttribute("data-done", "true");
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("stays at least the minimum time so the animation can be read", () => {
    render(<Harness />);
    act(() => void vi.advanceTimersByTime(LOADER_MIN_MS - 50));
    expect(screen.getByText("loading")).toBeInTheDocument();
    act(() => void vi.advanceTimersByTime(60));
    expect(screen.getByText("ready")).toBeInTheDocument();
  });

  it("never blocks longer than the maximum, even if fonts never settle", () => {
    render(<Harness />);
    act(() => void vi.advanceTimersByTime(LOADER_MAX_MS + 10));
    expect(screen.getByText("ready")).toBeInTheDocument();
  });

  it("dissolves, then leaves the page entirely", () => {
    render(<Harness />);
    act(() => void vi.advanceTimersByTime(LOADER_MIN_MS + 10));
    const status = screen.getByRole("status", { name: "Ursly is opening" });
    expect(status).toHaveAttribute("data-done", "true");
    fireEvent.transitionEnd(status);
    expect(screen.queryByRole("status", { name: "Ursly is opening" })).toBeNull();
  });

  it("is over at once for people who ask for less motion", () => {
    render(<Harness reduced />);
    act(() => void vi.advanceTimersByTime(0));
    expect(screen.getByText("ready")).toBeInTheDocument();
  });
});
