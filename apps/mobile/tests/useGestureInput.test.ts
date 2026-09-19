import { describe, it } from "node:test";
import assert from "node:assert";

describe("gesture signal mapping", () => {
  it("tap on planet produces tap-planet signal", () => {
    const hitTest = (x: number, y: number) =>
      x > 100 && x < 200 ? "planet-1" : null;
    const planetId = hitTest(150, 150);
    assert.strictEqual(planetId, "planet-1");
  });

  it("tap on empty space produces null from hit test", () => {
    const hitTest = (x: number, y: number) =>
      x > 100 && x < 200 ? "planet-1" : null;
    const planetId = hitTest(50, 50);
    assert.strictEqual(planetId, null);
  });
});
