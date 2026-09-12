import {
  createMotionReader,
  type MotionGestureId,
  type MotionSettings,
} from "@/packages/core/src/domain/motionGestures";

/**
 * The camera half of motion control.
 *
 * Everything that decides what a movement meant lives in the domain. This holds
 * the parts that only a browser can do: asking for the camera, reducing each
 * frame to a coarse grid of brightness, and stopping cleanly. The picture never
 * leaves the page — it is drawn into a canvas the size of a postage stamp and
 * thrown away — and nothing is recorded, uploaded or kept.
 */

export type MotionCameraEvent =
  | { type: "ready" }
  | { type: "reading"; moving: boolean; energy: number; at?: { x: number; y: number } }
  | { type: "gesture"; gesture: MotionGestureId }
  | { type: "error"; code: MotionErrorCode; message: string }
  | { type: "ended" };

export type MotionErrorCode = "UNSUPPORTED" | "DENIED" | "UNAVAILABLE";

/** Coarse enough to be cheap, fine enough to tell left from right. */
const COLUMNS = 20;
const ROWS = 15;
/** Twenty readings a second is plenty for a hand, and gentle on a laptop. */
const INTERVAL_MS = 50;

export type MotionCameraOptions = {
  video: HTMLVideoElement;
  onEvent: (event: MotionCameraEvent) => void;
  columns?: number;
  rows?: number;
  intervalMs?: number;
  settings?: MotionSettings;
  /** Injected so a test can drive this without a camera. */
  openCamera?: () => Promise<MediaStream>;
  capture?: (
    video: HTMLVideoElement,
    columns: number,
    rows: number,
  ) => ArrayLike<number> | undefined;
  schedule?: (run: () => void) => number;
  cancel?: (handle: number) => void;
  now?: () => number;
};

/**
 * Whether this browser will ever hand over a camera here. A camera needs a
 * secure context, so a reader on plain HTTP should be told before they switch
 * modes rather than after.
 */
export function cameraSupported(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined")
    return false;
  return (
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    (window.isSecureContext || location.hostname === "localhost")
  );
}

/** Turns whatever getUserMedia threw into something a reader can act on. */
export function describeCameraFailure(error: unknown): {
  code: MotionErrorCode;
  message: string;
} {
  const name = (error as { name?: string })?.name;
  if (name === "NotAllowedError" || name === "SecurityError")
    return {
      code: "DENIED",
      message:
        "The camera was not allowed. Allow it in your browser, then start motion again.",
    };
  if (name === "NotFoundError" || name === "OverconstrainedError")
    return {
      code: "UNAVAILABLE",
      message: "No camera was found on this device.",
    };
  return {
    code: "UNAVAILABLE",
    message: "The camera could not be started. Check it is not already in use.",
  };
}

/**
 * Draws the video into a canvas of a few hundred cells and reads the brightness
 * of each. The canvas does the downsampling, which is what makes this cheap:
 * the browser averages the pixels, and nothing here ever touches a full frame.
 * The draw is mirrored, so a hand moving to the reader's right moves towards
 * larger x, which is the direction the domain expects.
 */
function createCanvasCapture(): (
  video: HTMLVideoElement,
  columns: number,
  rows: number,
) => ArrayLike<number> | undefined {
  let canvas: HTMLCanvasElement | undefined;
  let context: CanvasRenderingContext2D | null = null;
  return (video, columns, rows) => {
    if (!video.videoWidth || !video.videoHeight) return undefined;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.width = columns;
      canvas.height = rows;
      context = canvas.getContext("2d", { willReadFrequently: true });
    }
    if (!context) return undefined;
    context.setTransform(-1, 0, 0, 1, columns, 0);
    context.drawImage(video, 0, 0, columns, rows);
    const { data } = context.getImageData(0, 0, columns, rows);
    const cells = new Uint8Array(columns * rows);
    for (let index = 0; index < cells.length; index++) {
      const pixel = index * 4;
      // Rec. 601 luma: a hand is read by its brightness, not its colour.
      cells[index] =
        (data[pixel] * 77 + data[pixel + 1] * 150 + data[pixel + 2] * 29) >> 8;
    }
    return cells;
  };
}

export class MotionCamera {
  private stream: MediaStream | null = null;
  private handle: number | null = null;
  private running = false;
  private readonly reader: ReturnType<typeof createMotionReader>;
  private readonly columns: number;
  private readonly rows: number;
  private readonly intervalMs: number;
  private readonly capture: NonNullable<MotionCameraOptions["capture"]>;
  private readonly now: () => number;
  private lastFrameAt = 0;

  constructor(private readonly options: MotionCameraOptions) {
    this.columns = options.columns ?? COLUMNS;
    this.rows = options.rows ?? ROWS;
    this.intervalMs = options.intervalMs ?? INTERVAL_MS;
    this.capture = options.capture ?? createCanvasCapture();
    this.now = options.now ?? (() => performance.now());
    this.reader = createMotionReader(options.settings);
  }

  async start(): Promise<void> {
    if (this.running) return;
    if (!this.options.openCamera && !cameraSupported()) {
      this.options.onEvent({
        type: "error",
        code: "UNSUPPORTED",
        message:
          "This browser will not share a camera here. Motion needs a secure connection.",
      });
      return;
    }
    this.running = true;
    try {
      const open =
        this.options.openCamera ??
        (() =>
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user", width: 320, height: 240 },
            audio: false,
          }));
      const stream = await open();
      if (!this.running) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      this.stream = stream;
      this.options.video.srcObject = stream;
      this.options.video.muted = true;
      await this.options.video.play?.().catch(() => {
        // A paused preview still delivers frames to the canvas on most
        // browsers, and the reader is told by the meter either way.
      });
      this.reader.reset();
      this.options.onEvent({ type: "ready" });
      this.tick();
    } catch (error) {
      this.running = false;
      this.options.onEvent({ type: "error", ...describeCameraFailure(error) });
    }
  }

  stop(): void {
    if (!this.running && !this.stream) return;
    this.running = false;
    const cancel = this.options.cancel ?? cancelAnimationFrame;
    if (this.handle !== null) cancel(this.handle);
    this.handle = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    this.options.video.srcObject = null;
    this.reader.reset();
    this.options.onEvent({ type: "ended" });
  }

  private tick = (): void => {
    if (!this.running) return;
    const schedule =
      this.options.schedule ??
      ((run: () => void) => requestAnimationFrame(run) as unknown as number);
    this.handle = schedule(this.tick);
    const at = this.now();
    if (at - this.lastFrameAt < this.intervalMs) return;
    this.lastFrameAt = at;
    // A hidden tab is not a reader waving at a camera.
    if (typeof document !== "undefined" && document.hidden) return;
    const cells = this.capture(this.options.video, this.columns, this.rows);
    if (!cells) return;
    const reading = this.reader.read({
      at,
      columns: this.columns,
      rows: this.rows,
      cells,
    });
    this.options.onEvent({
      type: "reading",
      moving: reading.moving,
      energy: reading.energy,
      ...(reading.at ? { at: reading.at } : {}),
    });
    if (reading.gesture)
      this.options.onEvent({ type: "gesture", gesture: reading.gesture });
  };
}
