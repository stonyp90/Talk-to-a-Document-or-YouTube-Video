// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MotionCamera,
  cameraSupported,
  describeCameraFailure,
  type MotionCameraEvent,
} from "./motionCamera";

/** A camera the test owns: a stream whose tracks report being stopped. */
function fakeStream() {
  const stopped: string[] = [];
  const track = {
    kind: "video",
    stop: () => stopped.push("video"),
  } as unknown as MediaStreamTrack;
  return {
    stopped,
    stream: { getTracks: () => [track] } as unknown as MediaStream,
  };
}

function fakeVideo(): HTMLVideoElement {
  const element = document.createElement("video");
  Object.defineProperty(element, "play", { value: () => Promise.resolve() });
  return element;
}

/** Drives the camera frame by frame, under the test's clock. */
function harness(
  options: {
    cells?: (tick: number) => ArrayLike<number>;
    openCamera?: () => Promise<MediaStream>;
  } = {},
) {
  const events: MotionCameraEvent[] = [];
  const pending: Array<() => void> = [];
  let at = 0;
  const video = fakeVideo();
  const camera = new MotionCamera({
    video,
    onEvent: (event) => events.push(event),
    columns: 4,
    rows: 3,
    intervalMs: 50,
    openCamera: options.openCamera ?? (async () => fakeStream().stream),
    capture: () => options.cells?.(at) ?? new Array(12).fill(30),
    schedule: (run) => pending.push(run) as unknown as number,
    cancel: () => pending.splice(0, pending.length),
    now: () => at,
  });
  return {
    camera,
    events,
    video,
    /** Advances the clock and runs the frame the camera asked for. */
    tick(ms = 50) {
      at += ms;
      const next = pending.shift();
      next?.();
    },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe("asking for a camera", () => {
  it("says the browser will not share one outside a secure context", () => {
    vi.stubGlobal("window", { isSecureContext: false });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => {} } });
    vi.stubGlobal("location", { hostname: "example.com" });
    expect(cameraSupported()).toBe(false);
  });

  it("accepts development on the loopback name", () => {
    vi.stubGlobal("window", { isSecureContext: false });
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia: () => {} } });
    vi.stubGlobal("location", { hostname: "localhost" });
    expect(cameraSupported()).toBe(true);
  });

  it("tells a reader who refused the camera what to do next", () => {
    const refusal = Object.assign(new Error("no"), { name: "NotAllowedError" });
    expect(describeCameraFailure(refusal)).toEqual({
      code: "DENIED",
      message: expect.stringContaining("Allow it"),
    });
  });

  it("tells a reader with no camera that there is none", () => {
    const missing = Object.assign(new Error("no"), { name: "NotFoundError" });
    expect(describeCameraFailure(missing).code).toBe("UNAVAILABLE");
  });

  it("reports a refusal rather than throwing it at the caller", async () => {
    const { camera, events } = harness({
      openCamera: async () => {
        throw Object.assign(new Error("no"), { name: "NotAllowedError" });
      },
    });
    await camera.start();
    expect(events).toEqual([
      { type: "error", code: "DENIED", message: expect.any(String) },
    ]);
  });
});

describe("reading frames", () => {
  it("says it is ready once the camera is attached", async () => {
    const { camera, events, video } = harness();
    await camera.start();
    expect(events).toEqual([{ type: "ready" }]);
    expect(video.srcObject).toBeTruthy();
  });

  it("reads at the configured rate rather than at every animation frame", async () => {
    const { camera, events, tick } = harness();
    await camera.start();
    tick(10);
    tick(10);
    tick(10);
    expect(events.filter((event) => event.type === "reading")).toHaveLength(0);
    tick(50);
    expect(events.filter((event) => event.type === "reading")).toHaveLength(1);
  });

  it("passes a movement through to a gesture", async () => {
    // A bright column that travels from left to right across a four-wide grid.
    const frames = [0, 0, 0.1, 0.4, 0.7, 0.95, 0.95, 0.95, 0.95, 0.95];
    let index = 0;
    const { camera, events, tick } = harness({
      cells: () => {
        const position = frames[Math.min(index++, frames.length - 1)];
        const column = Math.round(position * 3);
        return Array.from({ length: 12 }, (_, cell) =>
          cell % 4 === column ? 240 : 20,
        );
      },
    });
    await camera.start();
    for (let step = 0; step < 12; step++) tick(60);
    expect(
      events.some(
        (event) => event.type === "gesture" && event.gesture === "right",
      ),
    ).toBe(true);
  });

  it("stops the camera and says so", async () => {
    const camera = fakeStream();
    const { camera: subject, events } = harness({
      openCamera: async () => camera.stream,
    });
    await subject.start();
    subject.stop();
    expect(camera.stopped).toEqual(["video"]);
    expect(events.at(-1)).toEqual({ type: "ended" });
  });

  it("reads nothing more once it has been stopped", async () => {
    const { camera, events, tick } = harness();
    await camera.start();
    camera.stop();
    const before = events.length;
    tick(200);
    tick(200);
    expect(events).toHaveLength(before);
  });

  it("releases a camera that arrived after the reader had already stopped", async () => {
    const opened = fakeStream();
    let release: (stream: MediaStream) => void = () => {};
    const { camera } = harness({
      openCamera: () =>
        new Promise<MediaStream>((resolve) => {
          release = resolve;
        }),
    });
    const starting = camera.start();
    camera.stop();
    release(opened.stream);
    await starting;
    expect(opened.stopped).toEqual(["video"]);
  });
});
