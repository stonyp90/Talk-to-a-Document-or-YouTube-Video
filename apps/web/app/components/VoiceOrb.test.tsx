// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { VoiceOrb } from "./VoiceOrb";

afterEach(cleanup);

/* ------------------------------------------------------------------ */
/*  Minimal Web Audio mocks — jsdom has no AudioContext.               */
/* ------------------------------------------------------------------ */

const mockAnalyser = {
  fftSize: 0,
  smoothingTimeConstant: 0,
  frequencyBinCount: 128,
  getByteFrequencyData: vi.fn(),
  connect: vi.fn(),
};

const mockSource = {
  connect: vi.fn(),
};

class FakeAudioContext {
  createAnalyser = vi.fn(() => mockAnalyser);
  createMediaStreamSource = vi.fn(() => mockSource);
  close = vi.fn().mockResolvedValue(undefined);
}

beforeEach(() => {
  vi.stubGlobal("AudioContext", FakeAudioContext);

  // jsdom has no MediaStream — provide a minimal class the component can
  // instantiate and pass to createMediaStreamSource without throwing.
  class FakeMediaStream {
    getTracks() { return []; }
    getAudioTracks() { return []; }
    id = "fake-stream";
  }
  vi.stubGlobal("MediaStream", FakeMediaStream);

  // requestAnimationFrame is not available in jsdom by default in all setups.
  if (typeof globalThis.requestAnimationFrame === "undefined") {
    vi.stubGlobal("requestAnimationFrame", vi.fn((cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    }));
  }
  if (typeof globalThis.cancelAnimationFrame === "undefined") {
    vi.stubGlobal("cancelAnimationFrame", vi.fn());
  }
});

afterEach(() => {
  mockAnalyser.getByteFrequencyData.mockClear();
  mockSource.connect.mockClear();
  vi.restoreAllMocks();
});

/* ------------------------------------------------------------------ */
/*  Tests.                                                            */
/* ------------------------------------------------------------------ */

describe("VoiceOrb", () => {
  it("renders in idle state when not active", () => {
    render(<VoiceOrb active={false} />);
    const orb = screen.getByTestId("voice-orb");
    expect(orb).toBeInTheDocument();
    expect(orb.className).toContain("voice-orb--idle");
  });

  it("renders with the active prop and no stream as idle", () => {
    render(<VoiceOrb active={true} />);
    const orb = screen.getByTestId("voice-orb");
    expect(orb).toBeInTheDocument();
    // Without a stream the orb cannot analyse, so it stays idle.
    expect(orb.className).toContain("voice-orb--idle");
  });

  it("renders in listening state when active with a stream", () => {
    const fakeStream = new MediaStream();
    render(<VoiceOrb active={true} stream={fakeStream} />);
    const orb = screen.getByTestId("voice-orb");
    expect(orb.className).toContain("voice-orb--listening");
  });

  it("renders in speaking state when activity override says so", () => {
    render(<VoiceOrb active={true} activity="speaking" />);
    const orb = screen.getByTestId("voice-orb");
    expect(orb.className).toContain("voice-orb--speaking");
  });

  it("has role='status' for accessibility", () => {
    render(<VoiceOrb active={false} />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("has an aria-label describing the current voice state", () => {
    render(<VoiceOrb active={false} />);
    const orb = screen.getByTestId("voice-orb");
    expect(orb).toHaveAttribute("aria-label", "Voice idle");
  });

  it("updates aria-label when listening", () => {
    const fakeStream = new MediaStream();
    render(<VoiceOrb active={true} stream={fakeStream} />);
    const orb = screen.getByTestId("voice-orb");
    expect(orb).toHaveAttribute("aria-label", "Listening");
  });

  it("updates aria-label when speaking", () => {
    render(<VoiceOrb active={true} activity="speaking" />);
    const orb = screen.getByTestId("voice-orb");
    expect(orb).toHaveAttribute("aria-label", "Speaking");
  });

  it("includes a canvas for the waveform visualisation", () => {
    render(<VoiceOrb active={true} stream={new MediaStream()} />);
    const canvas = screen.getByTestId("voice-orb").querySelector("canvas");
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute("aria-hidden", "true");
  });

  it("sets initial CSS custom properties on the element", () => {
    render(<VoiceOrb active={false} />);
    const orb = screen.getByTestId("voice-orb");
    expect(orb.style.getPropertyValue("--orb-scale")).toBe("1");
    expect(orb.style.getPropertyValue("--orb-glow")).toBe("0px");
  });

  it("creates an AudioContext when given a stream", () => {
    const fakeStream = new MediaStream();
    render(<VoiceOrb active={true} stream={fakeStream} />);
    // The component should have set up an analyser with the stream.
    expect(mockSource.connect).toHaveBeenCalledWith(mockAnalyser);
  });

  it("transitions back to idle when deactivated", () => {
    const fakeStream = new MediaStream();
    const { rerender } = render(
      <VoiceOrb active={true} stream={fakeStream} />,
    );
    expect(screen.getByTestId("voice-orb").className).toContain(
      "voice-orb--listening",
    );
    rerender(<VoiceOrb active={false} />);
    expect(screen.getByTestId("voice-orb").className).toContain(
      "voice-orb--idle",
    );
  });
});
