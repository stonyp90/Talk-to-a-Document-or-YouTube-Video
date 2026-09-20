import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createNativeSenseSession,
  createPermissionSession,
  createTiltReader,
} from "../src/senseSession";

test("one explicit start activates both channels; a failed channel does not block the other", () => {
  const events: string[] = [];
  const session = createNativeSenseSession({
    voice: () => ({
      start: () => {
        events.push("voice:start");
        throw new Error("denied");
      },
      stop: () => events.push("voice:stop"),
    }),
    motion: () => ({
      start: () => events.push("motion:start"),
      stop: () => events.push("motion:stop"),
    }),
    onStop: () => events.push("session:stop"),
  });
  assert.deepEqual(events, []);
  session.start();
  assert.deepEqual(events, ["voice:start", "motion:start"]);
  session.stop();
  assert.deepEqual(events.slice(2), [
    "voice:stop",
    "motion:stop",
    "session:stop",
  ]);
});

test("unmount stops both inputs and blocks further starts", () => {
  let starts = 0;
  let stops = 0;
  const channel = { start: () => starts++, stop: () => stops++ };
  const session = createNativeSenseSession({
    voice: () => channel,
    motion: () => channel,
  });
  session.start();
  session.dispose();
  session.start();
  assert.equal(starts, 2);
  assert.equal(stops, 2);
});

test("permissions are not requested before activation and a late grant after stop does not open capture", async () => {
  let requested = 0;
  let opened = 0;
  let grant!: (value: boolean) => void;
  const gate = createPermissionSession({
    request: () => {
      requested++;
      return new Promise<boolean>((resolve) => {
        grant = resolve;
      });
    },
    open: () => opened++,
    close: () => {},
    pending: () => {},
    denied: () => {},
  });
  assert.equal(requested, 0);
  gate.start();
  assert.equal(requested, 1);
  gate.stop();
  grant(true);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(opened, 0);
});

test("a permission denial clears pending state and a retry can open capture", async () => {
  let allowed = false;
  let opened = 0;
  let denied = 0;
  const pending: boolean[] = [];
  const gate = createPermissionSession({
    request: async () => allowed,
    open: () => opened++,
    close: () => {},
    pending: (value) => pending.push(value),
    denied: () => denied++,
  });
  gate.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(denied, 1);
  assert.equal(pending.at(-1), false);
  allowed = true;
  gate.start();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(opened, 1);
});

test("real device tilt calibrates at rest and requires a return to neutral before another action", () => {
  const reader = createTiltReader({
    threshold: 0.4,
    neutral: 0.15,
    holdMs: 200,
    cooldownMs: 800,
  });
  assert.equal(reader.read({ x: 0.3, y: 0.8, z: 0.2 }, 0), undefined);
  assert.equal(reader.read({ x: 0.9, y: 0.8, z: 0.2 }, 100), undefined);
  assert.equal(reader.read({ x: 0.9, y: 0.8, z: 0.2 }, 350), "next");
  assert.equal(reader.read({ x: 0.9, y: 0.8, z: 0.2 }, 1500), undefined);
  reader.read({ x: 0.3, y: 0.8, z: 0.2 }, 1600);
  reader.read({ x: 0.3, y: 0.8, z: 0.8 }, 1800);
  assert.equal(reader.read({ x: 0.3, y: 0.8, z: 0.8 }, 2100), "ask");
});

test("a throwing permission adapter clears pending state and remains retryable", () => {
  const pending: boolean[] = [];
  let denied = 0;
  const gate = createPermissionSession({
    request: () => {
      throw new Error("native module unavailable");
    },
    open: () => assert.fail("must not open"),
    close: () => {},
    pending: (value) => pending.push(value),
    denied: () => denied++,
  });
  assert.doesNotThrow(() => gate.start());
  assert.equal(pending.at(-1), false);
  assert.equal(denied, 1);
  gate.start();
  assert.equal(denied, 2);
});
