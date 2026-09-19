import { useState, useCallback } from "react";

export type Planet = {
  id: string;
  name: string;
  position: [number, number, number];
  color: string;
};

const PLANET_COUNT = 9;
const RING_RADIUS = 3;

const PLANET_COLORS = [
  "#F47762", "#A84332", "#677C4A", "#4D7C0F", "#0369A1",
  "#7C3AED", "#B91C1C", "#D8EEAE", "#EEE9E1",
];

const PLANET_NAMES = [
  "Discover", "Design", "Plan", "Build", "Test",
  "Deploy", "Monitor", "Learn", "Iterate",
];

export function buildPlanets(): Planet[] {
  return Array.from({ length: PLANET_COUNT }, (_, i) => {
    const angle = (i / PLANET_COUNT) * Math.PI * 2;
    return {
      id: `planet-${i + 1}`,
      name: PLANET_NAMES[i],
      position: [
        Math.cos(angle) * RING_RADIUS,
        0,
        Math.sin(angle) * RING_RADIUS,
      ],
      color: PLANET_COLORS[i],
    };
  });
}

export function useGalaxyState() {
  const [planets] = useState<Planet[]>(() => buildPlanets());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [orbitAngle, setOrbitAngle] = useState(0);

  const selectPlanet = useCallback((id: string) => setSelectedId(id), []);
  const flyBack = useCallback(() => setSelectedId(null), []);

  return { planets, selectedId, selectPlanet, flyBack, orbitAngle, setOrbitAngle };
}
