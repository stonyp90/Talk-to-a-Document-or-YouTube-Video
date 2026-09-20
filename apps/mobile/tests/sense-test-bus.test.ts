import assert from "node:assert/strict";
import test from "node:test";
import { createSenseTestBus, type SenseTestInput } from "../src/senseTestBus";

test("mock input injection is explicit, deterministic, and unsubscribes", () => {
  const bus = createSenseTestBus();
  const seen: SenseTestInput[] = [];
  const unsubscribe = bus.subscribe((input) => seen.push(input));
  assert.deepEqual(seen, []);
  bus.emit({ type: "voice", text: "summarize this" });
  bus.emit({ type: "motion", action: "next" });
  assert.deepEqual(seen, [
    { type: "voice", text: "summarize this" },
    { type: "motion", action: "next" },
  ]);
  unsubscribe();
  bus.emit({ type: "motion", action: "ask" });
  assert.equal(seen.length, 2);
});
