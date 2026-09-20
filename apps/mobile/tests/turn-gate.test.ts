import { test } from "node:test";
import assert from "node:assert/strict";
import { createTurnGate } from "../src/conversation/turnGate";

test("simultaneous voice and movement admit one question until its answer completes", () => {
  const gate = createTurnGate();
  const voice = gate.begin();
  assert.ok(voice);
  assert.equal(gate.begin(), null);
  gate.finish(voice);
  assert.ok(gate.begin());
});

test("a late cancelled answer cannot release a newer question", () => {
  const gate = createTurnGate();
  const old = gate.begin()!;
  gate.reset();
  const current = gate.begin()!;
  gate.finish(old);
  assert.equal(gate.begin(), null);
  gate.finish(current);
  assert.ok(gate.begin());
});
