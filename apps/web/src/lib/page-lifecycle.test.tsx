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
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const connect = vi.hoisted(() => vi.fn());
vi.mock("./realtimeClient", () => ({
  RealtimeClient: class {
    connect = connect;
    stop = vi.fn();
  },
}));
import Workspace from "../../app/components/Workspace";

beforeEach(() => {
  // The app route carries no introduction; the key is set only because the
  // mode switcher and the workspace share this browser with the landing page.
  localStorage.setItem("ursly-intro-v1", "seen");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const envelope = {
  source: {
    kind: "youtube",
    sourceName: "Fixture",
    text: "Evidence",
    characters: 8,
  },
  sourceId: "3f1a2b3c-4d5e-4f70-8192-a3b4c5d6e7f8",
  context: { usedCharacters: 8, totalCharacters: 8, truncated: false },
};

async function ingestFixture(request: ReturnType<typeof vi.fn>): Promise<void> {
  vi.stubGlobal("fetch", request);
  render(<Workspace />);
  // The picker is on screen from the start: no disclosure to open first.
  fireEvent.click(screen.getByRole("tab", { name: "YouTube video" }));
  fireEvent.change(screen.getByLabelText("YouTube URL"), {
    target: { value: "https://youtu.be/dQw4w9WgXcQ" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Continue to questions" }),
  );
}

it("offers voice without hiding it behind a disclosure", async () => {
  await ingestFixture(
    vi.fn(async (url: string) => {
      if (url === "/api/health") return Response.json({ directUpload: false });
      if (url === "/api/ingest") return Response.json(envelope);
      throw new Error(`Unexpected request ${url}`);
    }),
  );
  // The brief makes voice the product; it must be reachable without hunting.
  const start = await screen.findByRole("button", { name: "Start Voice Chat" });
  await waitFor(() => expect(start).toBeEnabled());
  expect(start.closest("details")).toBeNull();
  expect(screen.getByLabelText("Ask a question")).toBeEnabled();
});

it("unmount aborts session setup and ignores its eventual response", async () => {
  let resolveSession!: (response: Response) => void;
  let sessionSignal: AbortSignal | undefined;
  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/health") return Response.json({ directUpload: false });
    if (url === "/api/ingest") return Response.json(envelope);
    if (url === "/api/realtime/session") {
      sessionSignal = options?.signal as AbortSignal;
      return new Promise<Response>((resolve) => {
        resolveSession = resolve;
      });
    }
    throw new Error(`Unexpected request ${url}`);
  });
  vi.stubGlobal("fetch", request);
  const view = render(<Workspace />);
  fireEvent.click(screen.getByRole("tab", { name: "YouTube video" }));
  fireEvent.change(screen.getByLabelText("YouTube URL"), {
    target: { value: "https://youtu.be/dQw4w9WgXcQ" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Continue to questions" }),
  );

  const start = await screen.findByRole("button", { name: "Start Voice Chat" });
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
