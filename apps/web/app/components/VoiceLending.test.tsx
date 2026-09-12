// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceLending, type VoiceCapture } from "./VoiceLending";

function fakeCapture(overrides: Partial<VoiceCapture> = {}) {
  const capture = {
    open: vi.fn(async () => {}),
    close: vi.fn(async () => new Blob(["audio"], { type: "audio/webm" })),
    abandon: vi.fn(),
    ...overrides,
  };
  return capture as VoiceCapture & typeof capture;
}

function mount(capture = fakeCapture()) {
  render(<VoiceLending capture={() => capture} />);
  return capture;
}

const lend = () =>
  screen.getByRole("button", { name: /lend ursly your voice/i });
const toast = () => screen.queryByRole("alertdialog");
const keep = () => screen.getByRole("button", { name: /keep the recording/i });
const discard = () => screen.getByRole("button", { name: /discard it/i });

async function press(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function speakFor(seconds: number) {
  await act(async () => {
    vi.advanceTimersByTime(seconds * 1000);
  });
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/**
 * The consent is the feature. Every assertion below is about the order of two
 * things that are easy to get backwards: asking before recording, and keeping
 * only after being told to.
 */
describe("VoiceLending", () => {
  it("answers in the preset voice and records nobody until asked", () => {
    const capture = mount();
    expect(
      screen.getByRole("region", { name: /how ursly answers/i }),
    ).toHaveTextContent(/preset voice/i);
    expect(capture.open).not.toHaveBeenCalled();
    expect(toast()).toBeNull();
  });

  it("opens the microphone only when the control is pressed", async () => {
    const capture = mount();
    await press(lend());
    expect(capture.open).toHaveBeenCalledTimes(1);
    expect(toast()).toBeInTheDocument();
  });

  it("tells the speaker what is happening and offers both answers", async () => {
    mount();
    await press(lend());
    const dialog = toast()!;
    expect(dialog).toHaveAccessibleName(/recording your voice/i);
    expect(dialog).toHaveTextContent(/only if you approve/i);
    expect(dialog).toHaveTextContent(/has not been sent anywhere/i);
    expect(keep()).toBeInstanceOf(HTMLButtonElement);
    expect(discard()).toBeInstanceOf(HTMLButtonElement);
  });

  it("will not keep a sample too short for the provider, and says why", async () => {
    const capture = mount();
    await press(lend());
    await speakFor(2);
    // Refused, but still in the tab order: the reason is only useful to
    // someone who can reach the button it belongs to.
    expect(keep()).toHaveAttribute("aria-disabled", "true");
    expect(keep()).toBeEnabled();
    expect(toast()).toHaveTextContent(/keep talking/i);
    await press(keep());
    expect(capture.close).not.toHaveBeenCalled();
    expect(toast()).toBeInTheDocument();
    await speakFor(6);
    expect(keep()).not.toHaveAttribute("aria-disabled");
  });

  it("leaves the toast up and keeps nothing while the decision waits", async () => {
    const capture = mount();
    await press(lend());
    await speakFor(600);
    expect(toast()).toBeInTheDocument();
    expect(capture.close).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /delete the recording/i }),
    ).toBeNull();
  });

  it("keeps the sample when the speaker approves it", async () => {
    const capture = mount();
    await press(lend());
    await speakFor(12);
    await press(keep());
    expect(capture.close).toHaveBeenCalledTimes(1);
    expect(capture.abandon).not.toHaveBeenCalled();
    expect(toast()).toBeNull();
    expect(
      screen.getByRole("button", { name: /delete the recording/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("region", { name: /how ursly answers/i }),
    ).toHaveTextContent(/12 seconds/);
  });

  it("discards the recording the moment the speaker declines", async () => {
    const capture = mount();
    await press(lend());
    await speakFor(12);
    await press(discard());
    expect(capture.abandon).toHaveBeenCalledTimes(1);
    expect(capture.close).not.toHaveBeenCalled();
    expect(toast()).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/discarded/i);
    expect(
      screen.queryByRole("button", { name: /delete the recording/i }),
    ).toBeNull();
  });

  it("treats Escape as discarding, never as agreeing", async () => {
    const capture = mount();
    await press(lend());
    await speakFor(12);
    await act(async () => {
      fireEvent.keyDown(toast()!, { key: "Escape" });
    });
    expect(capture.abandon).toHaveBeenCalledTimes(1);
    expect(capture.close).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(/discarded/i);
  });

  it("moves focus into the toast so the decision cannot be missed", async () => {
    mount();
    await press(lend());
    expect(toast()!.contains(document.activeElement)).toBe(true);
  });

  it("deletes a kept sample in one press, back to the preset voice", async () => {
    mount();
    await press(lend());
    await speakFor(12);
    await press(keep());
    await press(screen.getByRole("button", { name: /delete the recording/i }));
    expect(screen.getByRole("status")).toHaveTextContent(/deleted/i);
    expect(
      screen.getByRole("region", { name: /how ursly answers/i }),
    ).toHaveTextContent(/preset voice/i);
    expect(
      screen.queryByRole("button", { name: /delete the recording/i }),
    ).toBeNull();
  });

  it("claims nothing was kept when the microphone hands back no audio", async () => {
    mount(fakeCapture({ close: vi.fn(async () => null) }));
    await press(lend());
    await speakFor(12);
    await press(keep());
    expect(
      screen.queryByRole("button", { name: /delete the recording/i }),
    ).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/no audio/i);
    expect(
      screen.getByRole("region", { name: /how ursly answers/i }),
    ).toHaveTextContent(/preset voice/i);
  });

  it("says so plainly when the microphone will not open", async () => {
    const capture = mount(
      fakeCapture({
        open: vi.fn(async () => {
          throw new Error("NotAllowedError");
        }),
      }),
    );
    await press(lend());
    expect(toast()).toBeNull();
    expect(screen.getByRole("status")).toHaveTextContent(/microphone/i);
    expect(capture.close).not.toHaveBeenCalled();
  });
});
