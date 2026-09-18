// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { dictionaryFor } from "../i18n/dictionaries";

// ---- hoisted mock references ------------------------------------------------
// vi.mock factories are hoisted above imports, so the mock functions must be
// created in a hoisted block for the tests to share references.
const mocks = vi.hoisted(() => {
  const requestJson = vi.fn();
  const uploadWithProgress = vi.fn();
  const readSession = vi.fn();
  const signOut = vi.fn();
  const streamAnswer = vi.fn();
  return { requestJson, uploadWithProgress, readSession, signOut, streamAnswer };
});

// ---- module mocks -----------------------------------------------------------
// Heavy components that reach for browser APIs (camera, speech, Bluetooth,
// WebRTC) are replaced with plain elements so the workspace can be tested in
// isolation from the devices it orchestrates.
vi.mock("./VoiceActions", () => ({
  VoiceActions: (props: { canStartVoice: boolean }) => (
    <div data-testid="voice-actions" data-can-voice={String(props.canStartVoice)} />
  ),
}));
vi.mock("./MotionActions", () => ({
  MotionActions: (props: { canAsk: boolean }) => (
    <div data-testid="motion-actions" data-can-ask={String(props.canAsk)} />
  ),
}));
vi.mock("./DeviceConnect", () => ({
  DeviceConnect: () => <div data-testid="device-connect" />,
}));
vi.mock("./VoiceLending", () => ({
  VoiceLending: () => <div data-testid="voice-lending" />,
}));
vi.mock("./TopNav", () => ({
  TopNav: (props: { mode: string }) => (
    <nav data-testid="top-nav" data-mode={props.mode} />
  ),
}));
vi.mock("./SiteFooter", () => ({
  SiteFooter: () => <footer data-testid="site-footer" />,
}));
vi.mock("./SignInGate", () => ({
  SignInGate: () => <div data-testid="sign-in-gate" />,
}));
vi.mock("@/apps/web/src/lib/api", () => ({
  ApiError: class ApiError extends Error {
    code: string;
    status: number;
    constructor(message: string, code: string, status: number) {
      super(message);
      this.code = code;
      this.status = status;
    }
  },
  requestJson: mocks.requestJson,
  uploadWithProgress: mocks.uploadWithProgress,
}));
vi.mock("@/apps/web/src/lib/account", () => ({
  readSession: mocks.readSession,
  signOut: mocks.signOut,
}));
vi.mock("@/apps/web/src/lib/streamAnswer", () => ({
  streamAnswer: mocks.streamAnswer,
}));

import Workspace from "./Workspace";

// ---- helpers ----------------------------------------------------------------

function mount() {
  return render(
    <LanguageProvider language="en" dictionary={dictionaryFor("en")}>
      <Workspace />
    </LanguageProvider>,
  );
}

// ---- test body --------------------------------------------------------------

afterEach(cleanup);

/**
 * The workspace is the whole application shell: source ingestion, conversation,
 * voice and motion controls, and the sign-in gate. Each test below opens one
 * window into it, checking one behaviour without reaching for implementation
 * details such as the reducer or the ref layout.
 */
describe("Workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // A signed-in reader: the gate stands open, the workspace is reachable.
    mocks.readSession.mockResolvedValue({ email: "reader@example.com" });
    // Every API call fails by default: the session request inside the
    // component fails gracefully, and no ingestion is started.
    mocks.requestJson.mockRejectedValue(new Error("no server"));
    mocks.uploadWithProgress.mockRejectedValue(new Error("no server"));
  });

  describe("rendering", () => {
    it("renders without crashing and shows the main heading", async () => {
      mount();
      expect(
        await screen.findByText("Your source.", { exact: false }),
      ).toBeInTheDocument();
    });

    it("shows the source overlay with its heading", async () => {
      mount();
      expect(
        await screen.findByRole("heading", { name: /^Add a source$/ }),
      ).toBeInTheDocument();
    });

    it("shows the conversation area with its heading", async () => {
      mount();
      expect(
        await screen.findByRole("heading", { name: "Conversation" }),
      ).toBeInTheDocument();
    });

    it("renders the skip link for keyboard readers", async () => {
      mount();
      expect(
        await screen.findByText("Skip to workspace"),
      ).toHaveAttribute("href", "#workspace");
    });
  });

  describe("source ingestion", () => {
    it("shows the PDF dropzone on the PDF tab", async () => {
      mount();
      expect(await screen.findByText("Drop a PDF here")).toBeInTheDocument();
    });

    it("shows a file input that accepts PDF files", async () => {
      mount();
      const input = await screen.findByLabelText("PDF file");
      expect(input).toHaveAttribute("accept", "application/pdf,.pdf");
    });

    it("switches to the YouTube tab and shows the URL input", async () => {
      mount();
      const youtubeTab = await screen.findByRole("tab", {
        name: "YouTube video",
      });
      youtubeTab.click();
      expect(
        await screen.findByLabelText("YouTube URL"),
      ).toBeInTheDocument();
    });

    it("renders the video background when a YouTube source is loaded", async () => {
      // Mock a successful health check and ingestion response.
      mocks.requestJson.mockImplementation(async (url: string) => {
        if (url === "/api/health") {
          return { mode: "mock" };
        }
        if (url === "/api/ingest") {
          return {
            source: {
              kind: "youtube",
              sourceName: "Test Video",
              text: "Test content",
              characters: 12,
            },
            sourceId: "test-source-id",
            context: {
              usedCharacters: 12,
              totalCharacters: 12,
              truncated: false,
            },
          };
        }
        throw new Error("Unexpected request");
      });

      mount();
      const youtubeTab = await screen.findByRole("tab", {
        name: "YouTube video",
      });
      youtubeTab.click();

      const urlInput = await screen.findByLabelText("YouTube URL");
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        window.HTMLInputElement.prototype,
        "value",
      )?.set;
      nativeInputValueSetter?.call(
        urlInput,
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      );
      urlInput.dispatchEvent(new Event("input", { bubbles: true }));

      const button = await screen.findByRole("button", {
        name: /^Continue$/i,
      });
      button.click();

      // The video background should render with the extracted video ID.
      await waitFor(() => {
        const videoBg = document.querySelector(".immersive-video-background");
        expect(videoBg).toBeInTheDocument();
        const iframe = videoBg?.querySelector("iframe");
        expect(iframe).toBeInTheDocument();
        expect(iframe?.src).toContain("dQw4w9WgXcQ");
      });
    });

    it("disables the continue button until a source is provided", async () => {
      mount();
      const button = await screen.findByRole("button", {
        name: /^Continue$/i,
      });
      expect(button).toBeDisabled();
    });
  });

  describe("empty state", () => {
    it("tells the reader to add a source before asking", async () => {
      mount();
      expect(
        await screen.findByText(
          /Add a PDF or YouTube source before sending so answers stay grounded/,
        ),
      ).toBeInTheDocument();
    });

    it("shows the immersive header lede for the default voice mode", async () => {
      mount();
      expect(
        await screen.findByText(
          /Speak to add a source, speak to ask a question/,
        ),
      ).toBeInTheDocument();
    });

    it("shows the empty-chat heading for the default voice mode", async () => {
      mount();
      expect(
        await screen.findByText("Your voice is the shortcut."),
      ).toBeInTheDocument();
    });

    it("disables the send button when no source is loaded", async () => {
      mount();
      const send = await screen.findByRole("button", { name: /Send/i });
      expect(send).toBeDisabled();
    });
  });

  describe("mode switching", () => {
    it("renders the top nav in voice mode by default", async () => {
      mount();
      const nav = await screen.findByTestId("top-nav");
      expect(nav).toHaveAttribute("data-mode", "voice");
    });

    it("includes the voice chat button in the page (hidden until a source)", async () => {
      mount();
      const button = await screen.findByText(/Start Voice Chat/);
      expect(button.closest("button")).toHaveAttribute("hidden");
    });

    it("renders both voice and motion action controls", async () => {
      mount();
      expect(await screen.findByTestId("voice-actions")).toBeInTheDocument();
      expect(await screen.findByTestId("motion-actions")).toBeInTheDocument();
    });

    it("tells the voice actions whether a source is loaded", async () => {
      mount();
      const voice = await screen.findByTestId("voice-actions");
      // No source has been loaded yet, so voice should not be available.
      expect(voice).toHaveAttribute("data-can-voice", "false");
    });
  });

  describe("conversation display", () => {
    it("shows the question input labelled for when no source is loaded", async () => {
      mount();
      const textarea = await screen.findByRole("textbox", {
        name: "Ask a question",
      });
      expect(textarea).toBeInTheDocument();
      expect(textarea).toHaveAttribute(
        "placeholder",
        "Type what you want to understand…",
      );
    });

    it("tells the reader when the browser cannot share a microphone", async () => {
      mount();
      // jsdom does not implement navigator.mediaDevices.getUserMedia, so the
      // workspace warns that voice is unavailable and typing is the fallback.
      expect(
        await screen.findByText(
          /This browser will not share a microphone here/,
        ),
      ).toBeInTheDocument();
    });
  });

  describe("error states", () => {
    it("shows the offline banner when the network is gone", async () => {
      const onlineSpy = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
      mount();
      expect(
        await screen.findByText(/You are offline/, { exact: false }),
      ).toBeInTheDocument();
      onlineSpy.mockRestore();
    });

    it("shows the source status as Ready when no source is loaded", async () => {
      mount();
      const statuses = await screen.findAllByText("Ready");
      expect(statuses.length).toBeGreaterThanOrEqual(1);
    });

    it("shows the add-source toggle in the immersive header", async () => {
      mount();
      expect(
        await screen.findByRole("button", { name: /Add a source/i }),
      ).toBeInTheDocument();
    });
  });

  describe("loading states", () => {
    it("shows the extracting status while ingestion is in progress", async () => {
      // A health response that never resolves keeps the component in the busy
      // state long enough to observe the loading indicator.
      mocks.requestJson.mockImplementation(
        () => new Promise(() => {}),
      );
      mount();
      // Choose a file to enable the continue button.
      const file = new File(["content"], "test.pdf", {
        type: "application/pdf",
      });
      const input = (await screen.findByLabelText(
        "PDF file",
      )) as HTMLInputElement;
      // Simulate a file selection through the change event.
      Object.defineProperty(input, "files", {
        value: [file],
        writable: false,
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));

      const button = await screen.findByRole("button", {
        name: /^Continue$/i,
      });
      button.click();

      // The status label switches to "Extracting" while the upload runs.
      await waitFor(() => {
        expect(screen.getByText("Extracting")).toBeInTheDocument();
      });
    });
  });

  describe("signed-out state", () => {
    it("shows the sign-in gate when the reader is not signed in", async () => {
      mocks.readSession.mockResolvedValue(null);
      mount();
      expect(await screen.findByTestId("sign-in-gate")).toBeInTheDocument();
    });
  });
});
