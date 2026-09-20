// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SettingsPanel } from "./SettingsPanel";

afterEach(() => {
  cleanup();
});

const defaultSettings = {
  language: "en",
  theme: "light",
  assistantName: "Ursly",
  voiceOutput: true,
  voiceSpeed: 1,
  cameraEnabled: false,
  videoPreviewOpacity: 0.15,
  handPreference: "right" as const,
  keyboardEnabled: false,
  nonVerbalTracking: false,
};

describe("SettingsPanel", () => {
  it("renders nothing when not open", () => {
    const { container } = render(
      <SettingsPanel
        open={false}
        onClose={vi.fn()}
        settings={defaultSettings}
        onUpdate={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders all settings sections when open", () => {
    render(
      <SettingsPanel
        open={true}
        onClose={vi.fn()}
        settings={defaultSettings}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("Voice & Audio")).toBeInTheDocument();
    expect(screen.getByText("Camera & Motion")).toBeInTheDocument();
    expect(screen.getByText("Keyboard")).toBeInTheDocument();
  });

  it("shows keyboard toggle", () => {
    render(
      <SettingsPanel
        open={true}
        onClose={vi.fn()}
        settings={defaultSettings}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText(/Enable keyboard input/i)).toBeInTheDocument();
  });

  it("shows hand preference toggle", () => {
    render(
      <SettingsPanel
        open={true}
        onClose={vi.fn()}
        settings={defaultSettings}
        onUpdate={vi.fn()}
      />,
    );
    expect(screen.getByText(/Hand preference/i)).toBeInTheDocument();
  });
});
