/**
 * Reading a hand in front of a camera, without a model.
 *
 * A gesture recogniser that needed a trained model would need megabytes of it,
 * a second origin to fetch it from and a policy that allows that origin. What a
 * reader actually needs is much smaller: whether something is moving, where it
 * is moving, and which way it went. That is arithmetic over two frames, and
 * arithmetic belongs here, where it can be tested against a sequence written by
 * hand rather than against a webcam nobody can put in a test.
 *
 * The adapter hands over each frame already reduced to a coarse grid of
 * brightness, and already mirrored, so that a hand moving to the reader's right
 * moves towards larger `x` here. Everything below is that grid and nothing else:
 * no pixels, no camera, no DOM.
 */

export type MotionFrame = {
  /** When the frame was taken, in milliseconds on a monotonic clock. */
  at: number;
  columns: number;
  rows: number;
  /** Brightness 0-255 per cell, row by row, `columns * rows` of them. */
  cells: ArrayLike<number>;
};

/** What a reader can do in front of the camera. */
export type MotionGestureId = "left" | "right" | "up" | "down" | "hold";

export const MOTION_GESTURES: readonly MotionGestureId[] = [
  "left",
  "right",
  "up",
  "down",
  "hold",
];

export type MotionReading = {
  /** True while something in front of the camera is moving. */
  moving: boolean;
  /** Share of the frame that changed, 0-1, for a live meter. */
  energy: number;
  /** Where the movement is, 0-1 across and down. Absent when nothing moves. */
  at?: { x: number; y: number };
  /** Emitted once, on the frame that completes a gesture. */
  gesture?: MotionGestureId;
};

export type MotionSettings = {
  /** How much a cell must change to count as moving, 0-255. */
  cellThreshold?: number;
  /** Share of moving cells below which the frame is treated as still. */
  minEnergy?: number;
  /**
   * Share of moving cells above which the frame is ignored. A light switched
   * on, a camera adjusting its exposure and someone walking behind the reader
   * all change the whole frame at once, and none of them is a gesture.
   */
  maxEnergy?: number;
  /** How far the movement must travel across the frame to count as a swipe. */
  swipeDistance?: number;
  /** How much longer a swipe must be along one axis than the other. */
  swipeRatio?: number;
  /** How long movement must stay in one place to count as holding. */
  holdMs?: number;
  /** How far movement may drift and still count as holding. */
  holdRadius?: number;
  /** Stillness this long ends the movement and decides what it was. */
  restMs?: number;
  /** Movement longer than this is decided without waiting for stillness. */
  maxStrokeMs?: number;
  /** Quiet time after a gesture, so one wave is not read as three. */
  cooldownMs?: number;
};

const DEFAULTS = {
  cellThreshold: 24,
  minEnergy: 0.02,
  maxEnergy: 0.6,
  swipeDistance: 0.22,
  swipeRatio: 1.5,
  holdMs: 700,
  holdRadius: 0.12,
  restMs: 220,
  maxStrokeMs: 2000,
  cooldownMs: 700,
} satisfies Required<MotionSettings>;

type Point = { at: number; x: number; y: number };

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Reads one camera's worth of frames. It keeps the previous frame and the
 * movement in progress, and answers each frame with what it now knows, so a
 * caller can both draw a live meter and act on a finished gesture.
 */
export function createMotionReader(settings: MotionSettings = {}) {
  const config = { ...DEFAULTS, ...settings };
  let previous: ArrayLike<number> | undefined;
  let shape = "";
  /** The movement in progress: where it has been, in order. */
  let stroke: Point[] = [];
  let lastMovedAt = 0;
  let quietUntil = 0;

  /** Decides what a finished movement was, or that it was nothing. */
  function decide(path: Point[]): MotionGestureId | undefined {
    const first = path[0];
    const last = path[path.length - 1];
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const across = Math.abs(dx);
    const down = Math.abs(dy);
    if (across >= config.swipeDistance && across >= down * config.swipeRatio)
      return dx > 0 ? "right" : "left";
    if (down >= config.swipeDistance && down >= across * config.swipeRatio)
      return dy > 0 ? "down" : "up";
    // Not a swipe. Movement that stayed in one place for long enough is a hand
    // held up and waving: the one gesture a reader can make without aiming.
    const held = last.at - first.at;
    const drifted = path.every(
      (point) => distance(point, first) <= config.holdRadius,
    );
    return held >= config.holdMs && drifted ? "hold" : undefined;
  }

  function end(at: number): MotionGestureId | undefined {
    if (stroke.length < 2) {
      stroke = [];
      return undefined;
    }
    const gesture = decide(stroke);
    stroke = [];
    if (gesture) quietUntil = at + config.cooldownMs;
    return gesture;
  }

  return {
    /** Forgets the camera without forgetting how it is configured. */
    reset(): void {
      previous = undefined;
      stroke = [];
      lastMovedAt = 0;
      quietUntil = 0;
    },

    read(frame: MotionFrame): MotionReading {
      const size = `${frame.columns}x${frame.rows}`;
      // A camera that changes resolution mid-stream would otherwise be compared
      // against a grid of another shape, and every cell would read as movement.
      if (size !== shape) {
        shape = size;
        previous = undefined;
        stroke = [];
      }
      const cells = frame.cells;
      const total = frame.columns * frame.rows;
      if (!previous || previous.length !== cells.length) {
        previous = Array.from(cells as ArrayLike<number>);
        return { moving: false, energy: 0 };
      }

      let changed = 0;
      let weight = 0;
      let sumX = 0;
      let sumY = 0;
      for (let index = 0; index < total; index++) {
        const difference = Math.abs(cells[index] - previous[index]);
        if (difference < config.cellThreshold) continue;
        changed += 1;
        const column = index % frame.columns;
        const row = (index - column) / frame.columns;
        weight += difference;
        sumX += (column + 0.5) * difference;
        sumY += (row + 0.5) * difference;
      }
      previous = Array.from(cells as ArrayLike<number>);

      const energy = total === 0 ? 0 : changed / total;
      const usable =
        energy >= config.minEnergy && energy <= config.maxEnergy && weight > 0;
      if (!usable) {
        // Stillness for long enough is what says a movement has finished.
        const gesture =
          stroke.length > 0 && frame.at - lastMovedAt >= config.restMs
            ? end(frame.at)
            : undefined;
        return { moving: false, energy, ...(gesture ? { gesture } : {}) };
      }

      const at = {
        x: sumX / weight / frame.columns,
        y: sumY / weight / frame.rows,
      };
      lastMovedAt = frame.at;
      if (frame.at < quietUntil) return { moving: true, energy, at };

      stroke.push({ at: frame.at, ...at });
      // A movement that never stops still has to be decided, or a reader waving
      // continuously would be told nothing at all.
      const gesture =
        frame.at - stroke[0].at >= config.maxStrokeMs ? end(frame.at) : undefined;
      return { moving: true, energy, at, ...(gesture ? { gesture } : {}) };
    },
  };
}
