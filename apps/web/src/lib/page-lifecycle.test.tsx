// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const connect = vi.hoisted(() => vi.fn());
vi.mock("./realtimeClient", () => ({
  RealtimeClient: class {
    connect = connect;
    stop = vi.fn();
  },
}));
import HomePage from "../../app/page";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});
it("unmount aborts session setup and ignores its eventual response", async () => {
  let resolveSession!: (response: Response) => void;
  let sessionSignal: AbortSignal | undefined;
  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/health") return Response.json({ directUpload: false });
    if (url === "/api/ingest")
      return Response.json({
        source: {
          kind: "youtube",
          sourceName: "Fixture",
          text: "Evidence",
          characters: 8,
        },
      });
    if (url === "/api/realtime/session") {
      sessionSignal = options?.signal as AbortSignal;
      return new Promise<Response>((resolve) => {
        resolveSession = resolve;
      });
    }
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", request);
  const view = render(<HomePage />);
  fireEvent.click(screen.getByRole("tab", { name: "YouTube video" }));
  fireEvent.change(screen.getByLabelText("YouTube URL"), {
    target: { value: "https://youtu.be/dQw4w9WgXcQ" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Continue to questions" }),
  );
  await waitFor(() =>
    expect(screen.getByText("Prefer to talk? Try voice chat")).toBeVisible(),
  );
  fireEvent.click(screen.getByText("Prefer to talk? Try voice chat"));
  const start = screen.getByRole("button", { name: "Start Voice Chat" });
  await waitFor(() => expect(start).toBeEnabled());
  fireEvent.click(start);
  await waitFor(() => expect(sessionSignal).toBeDefined());
  view.unmount();
  expect(sessionSignal?.aborted).toBe(true);
  await act(async () => {
    resolveSession(Response.json({ mode: "mock", clientSecret: "late" }));
  });
  expect(connect).not.toHaveBeenCalled();
});
