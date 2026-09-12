// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotionActions } from "./MotionActions";
import { LanguageProvider } from "../i18n/LanguageProvider";
import type { MotionCameraEvent } from "@/apps/web/src/lib/motionCamera";
import type { MotionGestureId } from "@/packages/core/src/domain/motionGestures";

const PROMPTS = [
  "Summarize the key ideas",
  "Explain this simply",
  "What should I remember?",
];

/** A camera the test drives: it never touches a device, it just emits. */
function stubCamera() {
  let emit: (event: MotionCameraEvent) => void = () => {};
  let stopped = 0;
  return {
    get stopped() {
      return stopped;
    },
    send: (event: MotionCameraEvent) => emit(event),
    gesture: (gesture: MotionGestureId) => emit({ type: "gesture", gesture }),
    create: (options: { onEvent: (event: MotionCameraEvent) => void }) => {
      emit = options.onEvent;
      return {
        async start() {
          emit({ type: "ready" });
        },
        stop() {
          stopped += 1;
          emit({ type: "ended" });
        },
      };
    },
  };
}

function draw(
  over: Partial<React.ComponentProps<typeof MotionActions>> = {},
  camera = stubCamera(),
) {
  const onAsk = vi.fn();
  const onAction = vi.fn();
  render(
    <LanguageProvider language="en" dictionary={{}}>
      <MotionActions
        prompts={PROMPTS}
        canAsk
        onAsk={onAsk}
        onAction={onAction}
        createCamera={camera.create}
        {...over}
      />
    </LanguageProvider>,
  );
  return { onAsk, onAction, camera };
}

const start = () =>
  fireEvent.click(screen.getByRole("button", { name: /start motion/i }));

/** The question the reader has landed on, rather than the spoken notice. */
const chosen = (text: string) =>
  screen.findByText(text, { selector: ".motion-choice-prompt" });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("driving the application with a hand", () => {
  it("says the camera is off, and that nothing is recorded, before it starts", () => {
    draw();
    expect(screen.getByText(/nothing is recorded or sent/i)).toBeInTheDocument();
  });

  it("starts on a press, because a camera is never taken without one", async () => {
    draw();
    start();
    expect(
      await screen.findByRole("button", { name: /stop motion/i }),
    ).toBeInTheDocument();
  });

  it("moves through the questions with a swipe", async () => {
    const { camera } = draw();
    start();
    await screen.findByRole("button", { name: /stop motion/i });
    expect(await chosen(PROMPTS[0])).toBeInTheDocument();
    camera.gesture("right");
    expect(await chosen(PROMPTS[1])).toBeInTheDocument();
    camera.gesture("left");
    expect(await chosen(PROMPTS[0])).toBeInTheDocument();
  });

  it("wraps around rather than stopping at the end of the list", async () => {
    const { camera } = draw();
    start();
    await screen.findByRole("button", { name: /stop motion/i });
    camera.gesture("left");
    expect(await chosen(PROMPTS[2])).toBeInTheDocument();
  });

  it("asks the chosen question on a wave", async () => {
    const { camera, onAsk } = draw();
    start();
    await screen.findByRole("button", { name: /stop motion/i });
    camera.gesture("right");
    camera.gesture("hold");
    expect(onAsk).toHaveBeenCalledWith(PROMPTS[1]);
  });

  it("asks for nothing while there is no source, and says why", async () => {
    const { camera, onAsk } = draw({ canAsk: false });
    start();
    await screen.findByRole("button", { name: /stop motion/i });
    camera.gesture("hold");
    expect(onAsk).not.toHaveBeenCalled();
    expect(await screen.findByText(/add a source first/i)).toBeInTheDocument();
  });

  it("sends the summary and the stop through the same bus the voice uses", async () => {
    const { camera, onAction } = draw();
    start();
    await screen.findByRole("button", { name: /stop motion/i });
    camera.gesture("up");
    camera.gesture("down");
    expect(onAction.mock.calls.map(([action]) => action)).toEqual([
      "summarize",
      "stop",
    ]);
  });

  it("tells the reader what the camera saw", async () => {
    const { camera } = draw();
    start();
    await screen.findByRole("button", { name: /stop motion/i });
    camera.gesture("right");
    expect(
      await screen.findByText(PROMPTS[1], { selector: ".motion-notice" }),
    ).toBeInTheDocument();
  });

  it("explains a refused camera instead of failing silently", async () => {
    const camera = stubCamera();
    draw({}, camera);
    start();
    camera.send({
      type: "error",
      code: "DENIED",
      message: "The camera was not allowed. Allow it in your browser, then start motion again.",
    });
    expect(await screen.findByRole("alert")).toHaveTextContent(/not allowed/i);
    expect(
      screen.getByRole("button", { name: /start motion/i }),
    ).toBeInTheDocument();
  });

  it("releases the camera when the reader leaves motion behind", () => {
    const camera = stubCamera();
    const { unmount } = render(
      <LanguageProvider language="en" dictionary={{}}>
        <MotionActions
          prompts={PROMPTS}
          canAsk
          onAsk={vi.fn()}
          onAction={vi.fn()}
          createCamera={camera.create}
        />
      </LanguageProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: /start motion/i }));
    unmount();
    expect(camera.stopped).toBe(1);
  });

  it("writes out what every movement does, so nothing has to be guessed", () => {
    draw();
    for (const meaning of [
      /next question/i,
      /previous question/i,
      /ask it/i,
      /summarize the source/i,
      /stop/i,
    ])
      expect(screen.getByText(meaning)).toBeInTheDocument();
  });
});
