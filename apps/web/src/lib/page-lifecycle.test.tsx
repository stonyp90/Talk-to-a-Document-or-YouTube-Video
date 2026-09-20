// @vitest-environment jsdom
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
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

const originalMediaDevices = Object.getOwnPropertyDescriptor(
  navigator,
  "mediaDevices",
);

beforeEach(() => {
  // Session lifecycle tests run in a browser that can request a microphone.
  // The realtime client remains injected; no device is actually opened.
  vi.stubGlobal("isSecureContext", true);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: vi.fn() },
  });
  // The app route carries no introduction; the key is set only because the
  // mode switcher and the workspace share this browser with the landing page.
  localStorage.setItem("ursly-intro-v1", "seen");
});

afterEach(() => {
  cleanup();
  if (originalMediaDevices)
    Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  else delete (navigator as { mediaDevices?: MediaDevices }).mediaDevices;
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
  fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
  fireEvent.click(screen.getByRole("tab", { name: "YouTube video" }));
  fireEvent.change(screen.getByLabelText("YouTube URL"), {
    target: { value: "https://youtu.be/dQw4w9WgXcQ" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
}

it("offers advanced live voice controls in workspace settings", async () => {
  await ingestFixture(
    vi.fn(async (url: string) => {
      if (url === "/api/auth/session")
        return Response.json({ email: "reader@example.com" });
      if (url === "/api/health") return Response.json({ directUpload: false });
      if (url === "/api/ingest") return Response.json(envelope);
      throw new Error(`Unexpected request ${url}`);
    }),
  );
  await screen.findByLabelText("Ask a question");
  fireEvent.click(screen.getByRole("button", { name: "Workspace settings" }));
  const start = await screen.findByRole("button", { name: "Start Voice Chat" });
  await waitFor(() => expect(start).toBeEnabled());
  expect(start.closest("details")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
  expect(screen.getByLabelText("Ask a question")).toBeEnabled();
});

it("reports voice setup failures inside open settings and restores feedback after closing", async () => {
  await ingestFixture(
    vi.fn(async (url: string) => {
      if (url === "/api/auth/session")
        return Response.json({ email: "reader@example.com" });
      if (url === "/api/health") return Response.json({ directUpload: false });
      if (url === "/api/ingest") return Response.json(envelope);
      if (url === "/api/realtime/session")
        return Response.json(
          { error: "Synthetic voice setup failed" },
          { status: 400 },
        );
      throw new Error(`Unexpected request ${url}`);
    }),
  );
  await screen.findByLabelText("Ask a question");
  fireEvent.click(screen.getByRole("button", { name: "Workspace settings" }));
  const settings = screen.getByRole("dialog", { name: "Workspace settings" });
  fireEvent.click(
    within(settings).getByRole("button", { name: "Start Voice Chat" }),
  );
  const problem = await within(settings).findByRole("alert");
  expect(problem).toHaveTextContent("Synthetic voice setup failed");
  expect(screen.getAllByRole("alert", { hidden: true })).toHaveLength(1);
  fireEvent.click(
    within(settings).getByRole("button", { name: "Close settings" }),
  );
  const feedback = screen.getByRole("alert");
  expect(feedback).toHaveTextContent("Synthetic voice setup failed");
  expect(feedback.closest("dialog")).toBeNull();
  expect(screen.getAllByRole("alert", { hidden: true })).toHaveLength(1);
});

it("shows session preparation inside settings without a duplicate behind the modal", async () => {
  await ingestFixture(
    vi.fn(async (url: string) => {
      if (url === "/api/auth/session")
        return Response.json({ email: "reader@example.com" });
      if (url === "/api/health") return Response.json({ directUpload: false });
      if (url === "/api/ingest") return Response.json(envelope);
      if (url === "/api/realtime/session")
        return new Promise<Response>(() => {});
      throw new Error(`Unexpected request ${url}`);
    }),
  );
  await screen.findByLabelText("Ask a question");
  fireEvent.click(screen.getByRole("button", { name: "Workspace settings" }));
  const settings = screen.getByRole("dialog", { name: "Workspace settings" });
  fireEvent.click(
    within(settings).getByRole("button", { name: "Start Voice Chat" }),
  );
  expect(await within(settings).findByRole("status")).toHaveTextContent(
    "Preparing",
  );
  expect(screen.getAllByText("Preparing")).toHaveLength(1);
  fireEvent.click(
    within(settings).getByRole("button", { name: "Close settings" }),
  );
  expect(screen.getByText("Preparing").closest("dialog")).toBeNull();
  expect(screen.getAllByText("Preparing")).toHaveLength(1);
});

it("unmount aborts session setup and ignores its eventual response", async () => {
  let resolveSession!: (response: Response) => void;
  let sessionSignal: AbortSignal | undefined;
  const request = vi.fn(async (url: string, options?: RequestInit) => {
    if (url === "/api/auth/session")
      return Response.json({ email: "reader@example.com" });
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
  fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
  fireEvent.click(screen.getByRole("tab", { name: "YouTube video" }));
  fireEvent.change(screen.getByLabelText("YouTube URL"), {
    target: { value: "https://youtu.be/dQw4w9WgXcQ" },
  });
  fireEvent.click(screen.getByRole("button", { name: /^Continue$/i }));
  await screen.findByLabelText("Ask a question");
  fireEvent.click(screen.getByRole("button", { name: "Workspace settings" }));

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

it("keeps typing available when the browser cannot request a microphone", async () => {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: undefined,
  });
  const request = vi.fn(async (url: string) => {
    if (url === "/api/auth/session")
      return Response.json({ email: "reader@example.com" });
    if (url === "/api/health") return Response.json({ directUpload: false });
    if (url === "/api/ingest") return Response.json(envelope);
    throw new Error(`Unexpected request ${url}`);
  });
  await ingestFixture(request);
  await screen.findByLabelText("Ask a question");
  fireEvent.click(screen.getByRole("button", { name: "Workspace settings" }));
  const start = await screen.findByRole("button", { name: "Start Voice Chat" });
  expect(start).toBeDisabled();
  fireEvent.click(start);
  fireEvent.click(screen.getByRole("button", { name: "Close settings" }));
  expect(screen.getByLabelText("Ask a question")).toBeEnabled();
  expect(
    request.mock.calls.some(([url]) => url === "/api/realtime/session"),
  ).toBe(false);
  expect(connect).not.toHaveBeenCalled();
});
