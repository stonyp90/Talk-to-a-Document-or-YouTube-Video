import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { ARSession } from "../src/ar/ARSession";

describe("ARSession", () => {
  let session: ARSession;

  beforeEach(() => {
    session = new ARSession();
  });

  it("starts in stopped state", () => {
    assert.strictEqual(session.running, false);
  });

  it("transitions to running on start", () => {
    session.start();
    assert.strictEqual(session.running, true);
  });

  it("transitions to stopped on stop", () => {
    session.start();
    session.stop();
    assert.strictEqual(session.running, false);
  });

  it("collects plane detections", () => {
    session.start();
    const planes: unknown[] = [];
    session.onPlaneDetected((plane) => planes.push(plane));
    session.handlePlaneUpdate({ id: "p1", position: [0, 0, 0], rotation: [0, 0, 0], extent: [1, 1] });
    assert.strictEqual(planes.length, 1);
  });

  it("does not emit planes when stopped", () => {
    const planes: unknown[] = [];
    session.onPlaneDetected((plane) => planes.push(plane));
    session.handlePlaneUpdate({ id: "p1", position: [0, 0, 0], rotation: [0, 0, 0], extent: [1, 1] });
    assert.strictEqual(planes.length, 0);
  });
});
