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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LanguageProvider } from "../i18n/LanguageProvider";
import { SenseControls } from "./SenseControls";
import type { MotionCameraEvent } from "@/apps/web/src/lib/motionCamera";

class SpeechEngine {
  static instances: SpeechEngine[] = [];
  static startImmediately = true;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  constructor() {
    SpeechEngine.instances.push(this);
  }
  start = vi.fn(() => {
    if (SpeechEngine.startImmediately) this.onstart?.();
  });
  stop = vi.fn(() => this.onend?.());
}

function fixture({ pending = false, voiceBusy = false } = {}) {
  let emit: (event: MotionCameraEvent) => void = () => {};
  let finish: (() => void) | undefined;
  const stop = vi.fn(() => emit({ type: "ended" }));
  const start = vi.fn(() => {
    if (pending)
      return new Promise<void>((resolve) => {
        finish = resolve;
      });
    emit({ type: "ready" });
    return Promise.resolve();
  });
  const createCamera = vi.fn((options: { onEvent: typeof emit }) => {
    emit = options.onEvent;
    return { start, stop };
  });
  const onActivityChange = vi.fn();
  const onStop = vi.fn();
  const view = render(
    <div>
      <div id="sense-command-settings" />
      <LanguageProvider language="en" dictionary={{}}>
        <SenseControls
          voice={{
            onAction: vi.fn(),
            onDictate: vi.fn(),
            canStartVoice: true,
            voiceBusy,
          }}
          motion={{
            prompts: ["Summarize the key ideas"],
            onAsk: vi.fn(),
            onAction: vi.fn(),
            canAsk: true,
            createCamera,
          }}
          onActivityChange={onActivityChange}
          onStop={onStop}
        />
      </LanguageProvider>
    </div>,
  );
  return {
    ...view,
    createCamera,
    start,
    stop,
    send: (event: MotionCameraEvent) => emit(event),
    finish: () => finish?.(),
    onActivityChange,
    onStop,
  };
}

beforeEach(() => {
  SpeechEngine.instances = [];
  SpeechEngine.startImmediately = true;
  vi.stubGlobal("SpeechRecognition", SpeechEngine);
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ commandSpeech: "browser" })),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("one human-sense experience", () => {
  it("offers one start control without activating either input on mount", () => {
    const camera = fixture();
    expect(
      screen.getByRole("button", { name: "Start experience" }),
    ).toHaveAttribute("aria-pressed", "false");
    expect(
      screen.queryByRole("button", { name: "Speak" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Start motion" }),
    ).not.toBeInTheDocument();
    expect(camera.createCamera).not.toHaveBeenCalled();
    expect(SpeechEngine.instances).toHaveLength(0);
  });

  it("places command customization inside workspace settings without a second dock menu", () => {
    const view = fixture();
    const settings = view.container.querySelector(
      "#sense-command-settings",
    ) as HTMLElement;
    expect(within(settings).getByText("Customize commands")).toBeVisible();
    expect(
      screen.getByRole("region", { name: "Speak" }).querySelector("details"),
    ).toBeNull();
    fireEvent.click(within(settings).getByText("Customize commands"));
    expect(
      within(settings).getByLabelText("Trigger word or phrase"),
    ).toBeVisible();
    expect(view.createCamera).not.toHaveBeenCalled();
    expect(SpeechEngine.instances).toHaveLength(0);
  });

  it("keeps command validation and save confirmation inside the settings editor", () => {
    const view = fixture();
    const settings = view.container.querySelector(
      "#sense-command-settings",
    ) as HTMLElement;
    fireEvent.click(within(settings).getByText("Customize commands"));
    const field = within(settings).getByLabelText("Trigger word or phrase");
    fireEvent.change(field, { target: { value: "youtube" } });
    fireEvent.click(
      within(settings).getByRole("button", { name: "Save trigger" }),
    );
    expect(within(settings).getByRole("alert")).toHaveTextContent(
      "“youtube” is already saved.",
    );
    fireEvent.change(field, { target: { value: "bookmark the idea" } });
    fireEvent.click(
      within(settings).getByRole("button", { name: "Save trigger" }),
    );
    expect(within(settings).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(settings).getByRole("status")).toHaveTextContent(
      "Saved “bookmark the idea”. Say it during the experience.",
    );
  });

  it("starts both inputs from one press and stops both from the same control", async () => {
    const camera = fixture();
    fireEvent.click(screen.getByRole("button", { name: "Start experience" }));
    expect(camera.start).toHaveBeenCalledOnce();
    expect(SpeechEngine.instances.at(-1)?.start).toHaveBeenCalledOnce();
    expect(
      await screen.findByRole("button", { name: "Stop experience" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(camera.onActivityChange).toHaveBeenLastCalledWith({
      listening: true,
      motion: true,
      connecting: false,
    });
    fireEvent.click(screen.getByRole("button", { name: "Stop experience" }));
    expect(camera.stop).toHaveBeenCalledOnce();
    expect(SpeechEngine.instances.at(-1)?.stop).toHaveBeenCalledOnce();
    expect(camera.onStop).toHaveBeenCalledOnce();
    expect(
      screen.getByRole("button", { name: "Start experience" }),
    ).toBeEnabled();
  });

  it("keeps speech running after a camera refusal and exposes the camera error", () => {
    const camera = fixture();
    fireEvent.click(screen.getByRole("button", { name: "Start experience" }));
    act(() =>
      camera.send({
        type: "error",
        code: "DENIED",
        message:
          "The camera was not allowed. Allow it in your browser, then start motion again.",
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Camera access was denied.",
    );
    expect(
      screen.getByRole("button", { name: "Stop experience" }),
    ).toBeEnabled();
    expect(camera.onActivityChange).toHaveBeenLastCalledWith({
      listening: true,
      motion: false,
      connecting: false,
    });
    expect(SpeechEngine.instances.at(-1)?.stop).not.toHaveBeenCalled();
  });

  it("keeps motion running after microphone refusal and offers retry when neither input remains active", () => {
    const camera = fixture();
    fireEvent.click(screen.getByRole("button", { name: "Start experience" }));
    act(() =>
      SpeechEngine.instances
        .at(-1)
        ?.onerror?.(
          Object.assign(new Event("error"), { error: "not-allowed" }),
        ),
    );
    expect(
      screen.getByRole("button", { name: "Stop experience" }),
    ).toBeEnabled();
    expect(camera.onActivityChange).toHaveBeenLastCalledWith({
      listening: false,
      motion: true,
      connecting: false,
    });
    act(() =>
      camera.send({
        type: "error",
        code: "DENIED",
        message: "Camera unavailable",
      }),
    );
    expect(
      screen.getByRole("button", { name: "Start experience" }),
    ).toBeEnabled();
    expect(screen.getAllByRole("alert")).toHaveLength(2);
  });

  it("cancels a pending camera request and ignores a late ready event", async () => {
    const camera = fixture({ pending: true });
    fireEvent.click(screen.getByRole("button", { name: "Start experience" }));
    expect(camera.onActivityChange).toHaveBeenLastCalledWith({
      listening: true,
      motion: false,
      connecting: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Stop experience" }));
    await act(async () => {
      camera.send({ type: "ready" });
      camera.finish();
    });
    expect(
      screen.getByRole("button", { name: "Start experience" }),
    ).toBeEnabled();
    expect(screen.getByLabelText("Motion preview")).not.toBeVisible();
    expect(camera.onActivityChange).toHaveBeenLastCalledWith({
      listening: false,
      motion: false,
      connecting: false,
    });
  });

  it("cancels pending speech permission and ignores its late start", async () => {
    SpeechEngine.startImmediately = false;
    const camera = fixture({ pending: true });
    fireEvent.click(screen.getByRole("button", { name: "Start experience" }));
    expect(camera.onActivityChange).toHaveBeenLastCalledWith({
      listening: false,
      motion: false,
      connecting: true,
    });
    fireEvent.click(screen.getByRole("button", { name: "Stop experience" }));
    await act(async () => {
      SpeechEngine.instances.at(-1)?.onstart?.();
      camera.finish();
    });
    expect(
      screen.getByRole("button", { name: "Start experience" }),
    ).toBeEnabled();
    expect(camera.onActivityChange).toHaveBeenLastCalledWith({
      listening: false,
      motion: false,
      connecting: false,
    });
  });

  it("also stops an existing live voice session through the shared control", () => {
    const camera = fixture({ voiceBusy: true });
    fireEvent.click(screen.getByRole("button", { name: "Stop experience" }));
    expect(camera.onStop).toHaveBeenCalledOnce();
    expect(camera.createCamera).not.toHaveBeenCalled();
  });

  it("releases both devices when the experience unmounts", async () => {
    const camera = fixture();
    fireEvent.click(screen.getByRole("button", { name: "Start experience" }));
    await waitFor(() => expect(camera.start).toHaveBeenCalledOnce());
    camera.unmount();
    expect(camera.stop).toHaveBeenCalledOnce();
    expect(SpeechEngine.instances.at(-1)?.stop).toHaveBeenCalledOnce();
  });
});
