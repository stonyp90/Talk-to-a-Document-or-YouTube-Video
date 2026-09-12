// @vitest-environment jsdom
import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/apps/web/src/lib/realtimeClient", () => ({
  RealtimeClient: class {
    connect = vi.fn();
    stop = vi.fn();
    sendText = vi.fn();
    setMuted = vi.fn();
  },
}));
import HomePage from "./HomePage";

beforeEach(() => {
  localStorage.setItem("ursly-intro-v1", "seen");
});
afterEach(() => {
  cleanup();
  localStorage.clear();
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

const encoder = new TextEncoder();

/** An event-stream response whose frames arrive in the given pieces. */
function sse(...frames: unknown[]): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      frames.forEach((frame) =>
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(frame)}\n\n`),
        ),
      );
      controller.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

type Handler = (url: string, init?: RequestInit) => Promise<Response>;

async function withSource(handler: Handler) {
  const fetchMock = vi.fn(handler);
  vi.stubGlobal("fetch", fetchMock);
  render(<HomePage />);
  fireEvent.click(screen.getByRole("tab", { name: "YouTube video" }));
  fireEvent.change(screen.getByLabelText("YouTube URL"), {
    target: { value: "https://youtu.be/dQw4w9WgXcQ" },
  });
  fireEvent.click(
    screen.getByRole("button", { name: "Continue to questions" }),
  );
  await screen.findAllByText("Fixture");
  return fetchMock;
}

const baseline: Handler = async (url) => {
  if (url === "/api/auth/session")
    return Response.json({ email: "reader@example.com" });
  if (url === "/api/health") return Response.json({ directUpload: false });
  if (url === "/api/ingest") return Response.json(envelope);
  return Response.json({});
};

function ask(question: string) {
  fireEvent.change(screen.getByLabelText("Ask a question"), {
    target: { value: question },
  });
  fireEvent.click(screen.getByRole("button", { name: /Send/ }));
}

describe("the conversation", () => {
  it("shows an answer word by word as it is written", async () => {
    await withSource(async (url) => {
      if (url === "/api/text-chat/stream")
        return sse(
          { type: "delta", text: "The key " },
          { type: "delta", text: "idea." },
          {
            type: "done",
            answer: "The key idea.",
            sourceId: envelope.sourceId,
          },
        );
      return baseline(url);
    });
    ask("What is this about?");
    await screen.findByText("The key idea.");
  });

  it("renders the answer's structure rather than printing its marks", async () => {
    await withSource(async (url) => {
      if (url === "/api/text-chat/stream")
        return sse({
          type: "done",
          answer: "**Bold** and\n\n- one\n- two",
          sourceId: envelope.sourceId,
        });
      return baseline(url);
    });
    ask("Summarize");
    const bold = await screen.findByText("Bold");
    expect(bold.tagName).toBe("STRONG");
    const answer = bold.closest(".markdown");
    expect(answer?.querySelectorAll("li")).toHaveLength(2);
    // The marks themselves never reach the reader.
    expect(answer?.textContent).not.toContain("**");
  });

  it("falls back to the plain endpoint when the connection cannot stream", async () => {
    const calls: string[] = [];
    await withSource(async (url) => {
      calls.push(url);
      if (url === "/api/text-chat/stream") {
        const response = new Response(null, { status: 200 });
        Object.defineProperty(response, "body", { value: null });
        return response;
      }
      if (url === "/api/text-chat")
        return Response.json({
          answer: "Plain answer.",
          sourceId: envelope.sourceId,
        });
      return baseline(url);
    });
    ask("What is this about?");
    await screen.findByText("Plain answer.");
    expect(calls).toContain("/api/text-chat");
  });

  it("keeps the words already written when the reader stops the answer", async () => {
    let release: (() => void) | undefined;
    await withSource(async (url) => {
      if (url === "/api/text-chat/stream")
        return new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: "delta", text: "Half an answer" })}\n\n`,
                ),
              );
              release = () => controller.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        );
      return baseline(url);
    });
    ask("Tell me everything");
    await screen.findByText("Half an answer");
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    release?.();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Send/ })).toBeInTheDocument(),
    );
    expect(screen.getByText("Half an answer")).toBeInTheDocument();
  });

  it("sends on Enter and keeps Shift + Enter for a new line", async () => {
    const fetchMock = await withSource(async (url) => {
      if (url === "/api/text-chat/stream")
        return sse({
          type: "done",
          answer: "Yes.",
          sourceId: envelope.sourceId,
        });
      return baseline(url);
    });
    const box = screen.getByLabelText("Ask a question");
    fireEvent.change(box, { target: { value: "Line one" } });
    fireEvent.keyDown(box, { key: "Enter", shiftKey: true });
    expect(
      fetchMock.mock.calls.some(([url]) => url === "/api/text-chat/stream"),
    ).toBe(false);
    fireEvent.keyDown(box, { key: "Enter" });
    await screen.findByText("Yes.");
  });
});

describe("voice to action", () => {
  it("stays available once a source is ready, where the questions are", async () => {
    await withSource(baseline);
    expect(screen.getByRole("button", { name: /Speak/ })).toBeInTheDocument();
  });

  it("offers voice to action before a source exists too", () => {
    vi.stubGlobal("fetch", vi.fn(baseline));
    render(<HomePage />);
    expect(screen.getByRole("button", { name: /Speak/ })).toBeInTheDocument();
  });
});
