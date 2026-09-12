import { describe, expect, it } from "vitest";
import {
  createMotionReader,
  type MotionFrame,
  type MotionGestureId,
} from "./motionGestures";

const COLUMNS = 16;
const ROWS = 12;

/** A still frame: one flat grey, so nothing differs from anything. */
const still = () => new Array<number>(COLUMNS * ROWS).fill(40);

/**
 * A frame with a bright patch at a point given in frame coordinates, which is
 * what a hand in front of a camera looks like once it has been reduced to a
 * grid of brightness.
 */
function patch(x: number, y: number, radius = 2): number[] {
  const cells = still();
  const centreColumn = Math.round(x * (COLUMNS - 1));
  const centreRow = Math.round(y * (ROWS - 1));
  for (let row = 0; row < ROWS; row++)
    for (let column = 0; column < COLUMNS; column++)
      if (
        Math.abs(column - centreColumn) <= radius &&
        Math.abs(row - centreRow) <= radius
      )
        cells[row * COLUMNS + column] = 230;
  return cells;
}

const frame = (at: number, cells: number[]): MotionFrame => ({
  at,
  columns: COLUMNS,
  rows: ROWS,
  cells,
});

/**
 * Plays a hand across the frame and returns every gesture the reader emitted.
 * The path is sampled at a camera-like rate, and the movement is followed by
 * enough stillness for the reader to decide what it was.
 */
function play(
  reader: ReturnType<typeof createMotionReader>,
  path: Array<{ x: number; y: number }>,
  options: { stepMs?: number; restMs?: number; start?: number } = {},
): MotionGestureId[] {
  const step = options.stepMs ?? 60;
  let at = options.start ?? 1000;
  const gestures: MotionGestureId[] = [];
  const take = (cells: number[]) => {
    const reading = reader.read(frame(at, cells));
    if (reading.gesture) gestures.push(reading.gesture);
    at += step;
  };
  take(still());
  for (const point of path) take(patch(point.x, point.y));
  // Stillness: the same frame twice differs from itself by nothing.
  for (let index = 0; index < (options.restMs ?? 400) / step; index++)
    take(still());
  return gestures;
}

/** A straight path of `steps` points from one place to another. */
const line = (
  from: { x: number; y: number },
  to: { x: number; y: number },
  steps = 6,
) =>
  Array.from({ length: steps }, (_, index) => ({
    x: from.x + ((to.x - from.x) * index) / (steps - 1),
    y: from.y + ((to.y - from.y) * index) / (steps - 1),
  }));

describe("reading a hand in front of a camera", () => {
  it("says nothing about the first frame it has ever seen", () => {
    const reader = createMotionReader();
    expect(reader.read(frame(0, still()))).toEqual({
      moving: false,
      energy: 0,
    });
  });

  it("reads a hand crossing to the right as a right swipe", () => {
    expect(
      play(createMotionReader(), line({ x: 0.2, y: 0.5 }, { x: 0.85, y: 0.5 })),
    ).toEqual(["right"]);
  });

  it("reads a hand crossing to the left as a left swipe", () => {
    expect(
      play(createMotionReader(), line({ x: 0.85, y: 0.5 }, { x: 0.2, y: 0.5 })),
    ).toEqual(["left"]);
  });

  it("reads a hand rising as an up swipe", () => {
    expect(
      play(createMotionReader(), line({ x: 0.5, y: 0.85 }, { x: 0.5, y: 0.15 })),
    ).toEqual(["up"]);
  });

  it("reads a hand falling as a down swipe", () => {
    expect(
      play(createMotionReader(), line({ x: 0.5, y: 0.15 }, { x: 0.5, y: 0.85 })),
    ).toEqual(["down"]);
  });

  it("reads a hand waving in one place as holding", () => {
    const wave = Array.from({ length: 16 }, (_, index) => ({
      x: 0.5 + (index % 2 === 0 ? 0.02 : -0.02),
      y: 0.5,
    }));
    expect(play(createMotionReader(), wave)).toEqual(["hold"]);
  });

  it("says nothing about a movement too small to have been meant", () => {
    expect(
      play(createMotionReader(), line({ x: 0.5, y: 0.5 }, { x: 0.56, y: 0.5 })),
    ).toEqual([]);
  });

  it("says nothing while the room is still", () => {
    const reader = createMotionReader();
    const readings = [0, 60, 120].map((at) => reader.read(frame(at, still())));
    expect(readings.every((reading) => !reading.moving)).toBe(true);
    expect(readings.every((reading) => reading.gesture === undefined)).toBe(
      true,
    );
  });

  it("ignores a light coming on, which changes everything at once", () => {
    const reader = createMotionReader();
    reader.read(frame(0, still()));
    const flooded = new Array<number>(COLUMNS * ROWS).fill(240);
    const reading = reader.read(frame(60, flooded));
    expect(reading.moving).toBe(false);
    expect(reading.energy).toBeGreaterThan(0.6);
  });

  it("reports where the movement is, so the interface can show it", () => {
    const reader = createMotionReader();
    reader.read(frame(0, still()));
    const reading = reader.read(frame(60, patch(0.8, 0.25)));
    expect(reading.moving).toBe(true);
    expect(reading.at!.x).toBeGreaterThan(0.6);
    expect(reading.at!.y).toBeLessThan(0.45);
  });

  it("reads two separate swipes as two gestures", () => {
    const reader = createMotionReader();
    const first = play(reader, line({ x: 0.2, y: 0.5 }, { x: 0.85, y: 0.5 }), {
      start: 1000,
    });
    const second = play(reader, line({ x: 0.85, y: 0.5 }, { x: 0.2, y: 0.5 }), {
      start: 4000,
    });
    expect([...first, ...second]).toEqual(["right", "left"]);
  });

  it("does not read one wave as several gestures", () => {
    const reader = createMotionReader();
    const there = line({ x: 0.2, y: 0.5 }, { x: 0.85, y: 0.5 });
    const back = line({ x: 0.85, y: 0.5 }, { x: 0.2, y: 0.5 });
    // No rest between the two halves: one continuous wave of the arm.
    expect(play(reader, [...there, ...back]).length).toBeLessThanOrEqual(1);
  });

  it("decides a movement that never stops rather than waiting forever", () => {
    const reader = createMotionReader({ maxStrokeMs: 400 });
    const gestures: MotionGestureId[] = [];
    let at = 0;
    reader.read(frame(at, still()));
    // A hand crossing steadily and never pausing: without a limit the reader
    // would hold the stroke open for as long as the reader kept moving.
    for (let step = 0; step < 10; step++) {
      at += 60;
      const reading = reader.read(frame(at, patch(0.1 + step * 0.09, 0.5)));
      if (reading.gesture) gestures.push(reading.gesture);
    }
    expect(gestures).toContain("right");
  });

  it("forgets the camera when asked, so a stopped session starts clean", () => {
    const reader = createMotionReader();
    reader.read(frame(0, still()));
    reader.read(frame(60, patch(0.2, 0.5)));
    reader.reset();
    expect(reader.read(frame(120, patch(0.85, 0.5)))).toEqual({
      moving: false,
      energy: 0,
    });
  });

  it("starts again when the camera changes resolution mid-stream", () => {
    const reader = createMotionReader();
    reader.read(frame(0, still()));
    const reading = reader.read({
      at: 60,
      columns: 8,
      rows: 6,
      cells: new Array<number>(48).fill(40),
    });
    expect(reading).toEqual({ moving: false, energy: 0 });
  });
});
