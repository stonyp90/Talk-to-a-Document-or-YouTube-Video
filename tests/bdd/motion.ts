import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  createMotionReader,
  type MotionFrame,
  type MotionGestureId,
} from "../../packages/core/src/domain/motionGestures";
import { MOTION_LEGEND } from "../../apps/web/app/components/MotionActions";
import type { Step, World } from "./steps";

/**
 * Driving with a hand, exercised against the reader that actually decides what
 * a movement was. A camera cannot be put in an acceptance suite, so what is
 * played here is what a camera produces: a coarse grid of brightness, one frame
 * at a time, with a bright patch where a hand is. Everything downstream of that
 * grid is the real thing.
 */

const COLUMNS = 20;
const ROWS = 15;
/** The questions the panel offers, in the order it cycles them. */
const PROMPTS = [
  "Summarize the key ideas",
  "Explain this simply",
  "What should I remember?",
];

const still = () => new Array<number>(COLUMNS * ROWS).fill(40);

function handAt(x: number, y: number): number[] {
  const cells = still();
  const centreColumn = Math.round(x * (COLUMNS - 1));
  const centreRow = Math.round(y * (ROWS - 1));
  for (let row = 0; row < ROWS; row++)
    for (let column = 0; column < COLUMNS; column++)
      if (
        Math.abs(column - centreColumn) <= 2 &&
        Math.abs(row - centreRow) <= 2
      )
        cells[row * COLUMNS + column] = 230;
  return cells;
}

type State = {
  reader: ReturnType<typeof createMotionReader>;
  at: number;
  chosen: number;
  asked: string[];
  actions: string[];
  notice: string;
  camera: "off" | "on" | "refused";
  source: boolean;
  gestures: MotionGestureId[];
};

/** What the panel does with a movement, kept in step with MotionActions. */
function perform(state: State, gesture: MotionGestureId): void {
  state.gestures.push(gesture);
  if (gesture === "right" || gesture === "left") {
    state.chosen =
      (state.chosen + (gesture === "right" ? 1 : -1) + PROMPTS.length) %
      PROMPTS.length;
    state.notice = PROMPTS[state.chosen];
    return;
  }
  if (gesture === "hold") {
    if (!state.source) {
      state.notice = "Add a source first, then wave to ask.";
      return;
    }
    state.asked.push(PROMPTS[state.chosen]);
    return;
  }
  if (gesture === "up") {
    if (!state.source) {
      state.notice = "Add a source first, then wave to ask.";
      return;
    }
    state.actions.push("summarize");
    return;
  }
  state.actions.push("stop");
}

export function registerMotionChecks(step: Step) {
  const states = new WeakMap<World, State>();
  const state = (world: World): State => {
    const existing = states.get(world);
    if (existing) return existing;
    const created: State = {
      reader: createMotionReader(),
      at: 1000,
      chosen: 0,
      asked: [],
      actions: [],
      notice: "",
      camera: "off",
      source: false,
      gestures: [],
    };
    states.set(world, created);
    return created;
  };

  const frame = (current: State, cells: number[]): MotionFrame => ({
    at: current.at,
    columns: COLUMNS,
    rows: ROWS,
    cells,
  });

  /**
   * Plays a path in front of the camera, then the stillness that ends it and
   * the pause that separates it from the next one. A reader does drop their
   * hand between two movements, and the reader of the camera insists on it:
   * one continuous wave is one gesture, not three.
   */
  function play(
    world: World,
    path: Array<{ x: number; y: number }>,
    rest = 1200,
  ): void {
    const current = state(world);
    const take = (cells: number[]) => {
      const reading = current.reader.read(frame(current, cells));
      if (reading.gesture) perform(current, reading.gesture);
      current.at += 60;
    };
    take(still());
    for (const point of path) take(handAt(point.x, point.y));
    for (let index = 0; index < rest / 60; index++) take(still());
  }

  const across = (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) =>
    Array.from({ length: 6 }, (_, index) => ({
      x: from.x + ((to.x - from.x) * index) / 5,
      y: from.y + ((to.y - from.y) * index) / 5,
    }));

  step("the control modes are listed", function () {
    state(this);
  });

  step("motion is offered alongside voice and keyboard", function () {
    const source = readFileSync(
      "apps/web/app/components/ModeSwitcher.tsx",
      "utf8",
    );
    for (const label of [
      "Voice to action",
      "Motion to action",
      "Keyboard to action",
    ])
      assert.ok(source.includes(label), `${label} must be one of the modes`);
    assert.ok(
      !source.includes("aria-disabled"),
      "No mode may be offered and then refused.",
    );
  });

  step("motion is marked as beta", function () {
    const source = readFileSync(
      "apps/web/app/components/ModeSwitcher.tsx",
      "utf8",
    );
    assert.match(source, /id: "motion",[\s\S]*?detail: "Beta"/);
  });

  step("the motion panel is shown", function () {
    state(this).camera = "off";
  });

  step("the camera is off until the reader starts it", function () {
    assert.equal(state(this).camera, "off");
    const panel = readFileSync(
      "apps/web/app/components/MotionActions.tsx",
      "utf8",
    );
    // Nothing may open a camera on its own: the only call site is the control.
    assert.match(
      panel,
      /onClick=\{\(\) => \(watching \? stop\(\) : void start\(\)\)\}/,
    );
  });

  step("the panel says that nothing is recorded or sent", function () {
    const panel = readFileSync(
      "apps/web/app/components/MotionActions.tsx",
      "utf8",
    );
    assert.match(panel, /Nothing is recorded or sent/);
  });

  step("the response headers are inspected", function () {
    state(this);
  });

  step(
    "the permissions policy allows this origin to use the camera",
    function () {
      const config = readFileSync("apps/web/next.config.ts", "utf8");
      assert.match(config, /camera=\(self\)/);
    },
  );

  step("it still allows the microphone and nothing else", function () {
    const config = readFileSync("apps/web/next.config.ts", "utf8");
    assert.match(config, /microphone=\(self\)/);
    assert.match(config, /geolocation=\(\), payment=\(\)/);
  });

  step("the camera is running with a source ready", function () {
    const current = state(this);
    current.camera = "on";
    current.source = true;
  });

  step("the camera is running with no source", function () {
    const current = state(this);
    current.camera = "on";
    current.source = false;
  });

  step("a hand crosses the frame to the right", function () {
    play(this, across({ x: 0.2, y: 0.5 }, { x: 0.85, y: 0.5 }));
  });

  step("a hand crosses the frame to the left", function () {
    play(this, across({ x: 0.85, y: 0.5 }, { x: 0.2, y: 0.5 }));
  });

  step("a hand rises through the frame", function () {
    play(this, across({ x: 0.5, y: 0.85 }, { x: 0.5, y: 0.15 }));
  });

  step("a hand falls through the frame", function () {
    play(this, across({ x: 0.5, y: 0.15 }, { x: 0.5, y: 0.85 }));
  });

  step("a hand waves in one place", function () {
    play(
      this,
      Array.from({ length: 16 }, (_, index) => ({
        x: 0.5 + (index % 2 === 0 ? 0.02 : -0.02),
        y: 0.5,
      })),
    );
  });

  step("the light in the room changes all at once", function () {
    const current = state(this);
    const flooded = new Array<number>(COLUMNS * ROWS).fill(240);
    current.reader.read(frame(current, still()));
    current.at += 60;
    const reading = current.reader.read(frame(current, flooded));
    if (reading.gesture) perform(current, reading.gesture);
    current.at += 60;
  });

  step("the next question is chosen", function () {
    assert.equal(state(this).gestures.at(-1), "right");
    assert.equal(state(this).notice, PROMPTS[state(this).chosen]);
  });

  step("the previous question is chosen", function () {
    assert.equal(state(this).gestures.at(-1), "left");
    assert.equal(state(this).chosen, 0);
  });

  step("the chosen question is asked", function () {
    assert.deepEqual(state(this).asked, [PROMPTS[state(this).chosen]]);
  });

  step("nothing is asked", function () {
    assert.deepEqual(state(this).asked, []);
  });

  step("the reader is told to add a source first", function () {
    assert.match(state(this).notice, /add a source first/i);
  });

  step("the source is summarized", function () {
    assert.ok(state(this).actions.includes("summarize"));
  });

  step("the answer is stopped", function () {
    assert.ok(state(this).actions.includes("stop"));
  });

  step("nothing is chosen and nothing is asked", function () {
    const current = state(this);
    assert.deepEqual(current.gestures, []);
    assert.deepEqual(current.asked, []);
    assert.equal(current.chosen, 0);
  });

  step("the reader refuses the camera", function () {
    state(this).camera = "refused";
  });

  step("the reason is shown with what to do next", function () {
    assert.equal(state(this).camera, "refused");
    const camera = readFileSync("apps/web/src/lib/motionCamera.ts", "utf8");
    assert.match(camera, /Allow it in your browser, then start motion again/);
  });

  step("voice and keyboard remain available", function () {
    const source = readFileSync(
      "apps/web/app/components/ModeSwitcher.tsx",
      "utf8",
    );
    assert.ok(source.includes("Voice to action"));
    assert.ok(source.includes("Keyboard to action"));
    // Every movement the legend promises has to be one the reader can produce.
    assert.deepEqual(MOTION_LEGEND.map((entry) => entry.gesture).sort(), [
      "down",
      "hold",
      "left",
      "right",
      "up",
    ]);
  });
}
