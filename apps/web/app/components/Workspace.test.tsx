// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { dictionaryFor } from "../i18n/dictionaries";

// ---- hoisted mock references ------------------------------------------------
const mocks = vi.hoisted(() => {
  const requestJson = vi.fn();
  const uploadWithProgress = vi.fn();
  const readSession = vi.fn();
  const signOut = vi.fn();
  const streamAnswer = vi.fn();
  return {
    requestJson,
    uploadWithProgress,
    readSession,
    signOut,
    streamAnswer,
  };
});

// ---- module mocks -----------------------------------------------------------
vi.mock("./VoiceActions", () => ({
  VoiceActions: (props: { canStartVoice: boolean }) => (
    <div
      data-testid="voice-actions"
      data-can-voice={String(props.canStartVoice)}
    />
  ),
}));
vi.mock("./SenseControls", () => ({
  SenseControls: (props: {
    voice: { canStartVoice: boolean };
    motion: { canAsk: boolean };
  }) => (
    <div>
      <div
        data-testid="voice-actions"
        data-can-voice={String(props.voice.canStartVoice)}
      />
      <div
        data-testid="motion-actions"
        data-can-ask={String(props.motion.canAsk)}
      />
      <button>Start experience</button>
    </div>
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
  AppPreferences: () => <div data-testid="app-preferences" />,
  TopNav: (props: {
    mode: string;
    onModeChange: (mode: "human" | "text") => void;
  }) => (
    <nav data-testid="top-nav" data-mode={props.mode}>
      <button onClick={() => props.onModeChange("text")}>
        Keyboard to action
      </button>
      <button onClick={() => props.onModeChange("human")}>
        Sense to Action
      </button>
    </nav>
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

describe("Workspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.readSession.mockResolvedValue({ email: "reader@example.com" });
    mocks.requestJson.mockRejectedValue(new Error("no server"));
    mocks.uploadWithProgress.mockRejectedValue(new Error("no server"));
  });

  describe("one immersive workspace", () => {
    it("offers one source entry point without the repeated sections or marketing footer", async () => {
      mount();
      expect(
        await screen.findByRole("heading", { name: "Sense to Action" }),
      ).toBeInTheDocument();
      expect(
        screen.getAllByRole("button", { name: "Add a source" }),
      ).toHaveLength(1);
      expect(screen.queryByTestId("site-footer")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Your source.", { exact: false }),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Bring your source")).not.toBeInTheDocument();
      expect(
        screen.queryByText("Speak. Move. Look. The interface listens."),
      ).not.toBeInTheDocument();
      expect(screen.getByText("Skip to workspace")).toHaveAttribute(
        "href",
        "#workspace",
      );
    });

    it("keeps both input channels mounted while switching keyboard preference", async () => {
      mount();
      const voice = await screen.findByTestId("voice-actions");
      const motion = screen.getByTestId("motion-actions");
      fireEvent.click(
        screen.getByRole("button", { name: "Keyboard to action" }),
      );
      expect(screen.getByTestId("top-nav")).toHaveAttribute(
        "data-mode",
        "text",
      );
      expect(screen.getByTestId("voice-actions")).toBe(voice);
      expect(screen.getByTestId("motion-actions")).toBe(motion);
      expect(voice).toHaveAttribute("data-can-voice", "false");
      expect(motion).toHaveAttribute("data-can-ask", "false");
    });

    it.each(["voice", "motion"])(
      "migrates a saved %s preference to human sense",
      async (mode) => {
        localStorage.setItem("ursly-mode-v1", mode);
        mount();
        expect(await screen.findByTestId("top-nav")).toHaveAttribute(
          "data-mode",
          "human",
        );
      },
    );

    it("opens source selection in place and returns to the same input controls", async () => {
      mount();
      const voice = await screen.findByTestId("voice-actions");
      fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
      const picker = screen.getByRole("dialog", { name: "Add a source" });
      expect(
        within(picker).getByRole("tab", { name: "PDF file" }),
      ).toBeInTheDocument();
      expect(
        within(picker).getByRole("tab", { name: "YouTube video" }),
      ).toBeInTheDocument();
      fireEvent.click(
        within(picker).getByRole("button", { name: "Close source picker" }),
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(screen.getByTestId("voice-actions")).toBe(voice);
    });

    it("reveals voice, device and account settings only when requested", async () => {
      mount();
      await screen.findByTestId("voice-actions");
      expect(screen.getByTestId("voice-lending")).not.toBeVisible();
      expect(screen.getByTestId("device-connect")).not.toBeVisible();
      fireEvent.click(
        screen.getByRole("button", { name: "Workspace settings" }),
      );
      const settings = screen.getByRole("dialog", {
        name: "Workspace settings",
      });
      expect(within(settings).getByTestId("voice-lending")).toBeInTheDocument();
      expect(
        within(settings).getByTestId("device-connect"),
      ).toBeInTheDocument();
      expect(
        within(settings).getByRole("button", { name: "Sign out" }),
      ).toBeInTheDocument();
      const voiceSettings = within(settings).getByTestId("voice-lending");
      fireEvent.click(
        within(settings).getByRole("button", { name: "Close settings" }),
      );
      expect(
        screen.queryByRole("dialog", { name: "Workspace settings" }),
      ).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole("button", { name: "Workspace settings" }),
      );
      expect(screen.getByTestId("voice-lending")).toBe(voiceSettings);
    });
  });

  describe("error states", () => {
    it("shows the offline banner when the network is gone", async () => {
      const onlineSpy = vi
        .spyOn(navigator, "onLine", "get")
        .mockReturnValue(false);
      mount();
      expect(
        await screen.findByText(/You are offline/, { exact: false }),
      ).toBeInTheDocument();
      onlineSpy.mockRestore();
    });

    it("moves generic errors into settings even before a source is loaded", async () => {
      mount();
      await screen.findByTestId("voice-actions");
      fireEvent.click(screen.getByRole("button", { name: "Add a source" }));
      fireEvent.click(screen.getByRole("tab", { name: "YouTube video" }));
      fireEvent.change(screen.getByLabelText("YouTube URL"), {
        target: { value: "https://youtu.be/fixture" },
      });
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
      await screen.findByRole("alert");
      fireEvent.click(
        screen.getByRole("button", { name: "Close source picker" }),
      );
      fireEvent.click(
        screen.getByRole("button", { name: "Workspace settings" }),
      );
      const settings = screen.getByRole("dialog", {
        name: "Workspace settings",
      });
      expect(within(settings).getByRole("alert")).toHaveTextContent(
        "no server",
      );
      expect(screen.getAllByRole("alert", { hidden: true })).toHaveLength(1);
      expect(
        screen.queryByRole("button", { name: "Start Voice Chat" }),
      ).toBeNull();
    });

    it("shows errors in the immersive source prompt", async () => {
      mount();
      const prompt = await screen.findByRole("button", {
        name: "Add a source",
      });
      expect(prompt).toBeInTheDocument();
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
