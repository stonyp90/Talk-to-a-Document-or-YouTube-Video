import { Dimensions } from "react-native";

const PLANET_COUNT = 9;
const ANGLE_TOLERANCE = 0.5;

export function screenToPlanet(
  x: number,
  y: number,
  orbitAngle: number,
): string | null {
  const { width, height } = Dimensions.get("window");
  const cx = width / 2;
  const cy = height * 0.45;
  const screenRadius = Math.min(width, height) * 0.3;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist > screenRadius * 1.3 || dist < screenRadius * 0.3) return null;
  const tapAngle = Math.atan2(dy, dx);
  let bestId: string | null = null;
  let bestDiff = Infinity;
  for (let i = 0; i < PLANET_COUNT; i++) {
    const planetAngle = (i / PLANET_COUNT) * Math.PI * 2 + orbitAngle;
    let diff = tapAngle - planetAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (Math.abs(diff) < bestDiff) {
      bestDiff = Math.abs(diff);
      bestId = `planet-${i + 1}`;
    }
  }
  return bestDiff < ANGLE_TOLERANCE ? bestId : null;
}
