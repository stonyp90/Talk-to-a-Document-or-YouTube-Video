import { describe, it } from "node:test";
import assert from "node:assert";
import { resolveIntention, type InputSignals } from "../src/input/intentionResolver";

describe("resolveIntention", () => {
  it("returns null when no signals present", () => {
    const signals: InputSignals = {};
    assert.strictEqual(resolveIntention(signals), null);
  });

  it("voice command takes highest priority", () => {
    const signals: InputSignals = {
      voiceCommand: { type: "fly-to", planetId: "planet-1" },
      gesture: { type: "tap-planet", planetId: "planet-3" },
    };
    const action = resolveIntention(signals);
    assert.deepStrictEqual(action, { type: "fly-to", planetId: "planet-1" });
  });

  it("gesture takes priority over gaze", () => {
    const signals: InputSignals = {
      gesture: { type: "tap-planet", planetId: "planet-2" },
      gaze: { type: "dwell-select", planetId: "planet-5" },
    };
    const action = resolveIntention(signals);
    assert.deepStrictEqual(action, { type: "tap-planet", planetId: "planet-2" });
  });

  it("gaze dwell fires when no voice or gesture", () => {
    const signals: InputSignals = {
      gaze: { type: "dwell-select", planetId: "planet-4" },
    };
    const action = resolveIntention(signals);
    assert.deepStrictEqual(action, { type: "dwell-select", planetId: "planet-4" });
  });

  it("combines gaze target with voice action", () => {
    const signals: InputSignals = {
      voiceCommand: { type: "open" },
      gaze: { type: "looking-at", planetId: "planet-7" },
    };
    const action = resolveIntention(signals);
    assert.deepStrictEqual(action, { type: "fly-to", planetId: "planet-7" });
  });

  it("returns fly-back for gesture tap on empty space", () => {
    const signals: InputSignals = {
      gesture: { type: "tap-empty" },
    };
    const action = resolveIntention(signals);
    assert.deepStrictEqual(action, { type: "fly-back" });
  });

  it("returns toggle-reality for voice AR/3D command", () => {
    const signals: InputSignals = {
      voiceCommand: { type: "toggle-reality" },
    };
    const action = resolveIntention(signals);
    assert.deepStrictEqual(action, { type: "toggle-reality" });
  });
});
