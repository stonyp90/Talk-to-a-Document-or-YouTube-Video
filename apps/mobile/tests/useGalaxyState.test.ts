import { describe, it } from "node:test";
import assert from "node:assert/strict";

describe("useGalaxyState", () => {
  it("has 9 planets in a ring", () => {
    const { buildPlanets } = require("../src/scene/useGalaxyState");
    const planets = buildPlanets();
    assert.equal(planets.length, 9);
  });

  it("positions planets in a ring at radius 3", () => {
    const { buildPlanets } = require("../src/scene/useGalaxyState");
    const planets = buildPlanets();
    const planet = planets[0];
    const distance = Math.sqrt(
      planet.position[0] ** 2 + planet.position[2] ** 2,
    );
    assert.ok(Math.abs(distance - 3) < 0.1);
  });

  it("each planet has id, name, position, color", () => {
    const { buildPlanets } = require("../src/scene/useGalaxyState");
    const planets = buildPlanets();
    for (const p of planets) {
      assert.match(p.id, /^planet-\d+$/);
      assert.equal(typeof p.name, "string");
      assert.equal(p.position.length, 3);
      assert.equal(typeof p.color, "string");
    }
  });
});
