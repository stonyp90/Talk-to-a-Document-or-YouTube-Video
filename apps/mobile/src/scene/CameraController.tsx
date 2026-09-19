import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { Planet } from "./useGalaxyState";

const OVERVIEW_POSITION = new Vector3(0, 2, 8);
const ORBIT_DISTANCE = 2.5;
const FLY_SPEED = 3.0;
const Y_AXIS = new Vector3(0, 1, 0);

export function CameraController({
  selectedId,
  planets,
  orbitAngle,
}: {
  selectedId: string | null;
  planets: Planet[];
  orbitAngle: number;
}) {
  const { camera } = useThree();
  const target = useRef(OVERVIEW_POSITION.clone());
  const lookTarget = useRef(new Vector3(0, 0, 0));

  useEffect(() => {
    if (selectedId) {
      const planet = planets.find((p) => p.id === selectedId);
      if (planet) {
        const [px, py, pz] = planet.position;
        const dir = new Vector3(px, py, pz).normalize();
        target.current.set(
          px + dir.x * ORBIT_DISTANCE,
          py + 0.5,
          pz + dir.z * ORBIT_DISTANCE,
        );
        lookTarget.current.set(px, py, pz);
      }
    } else {
      target.current.copy(OVERVIEW_POSITION).applyAxisAngle(Y_AXIS, orbitAngle);
      lookTarget.current.set(0, 0, 0);
    }
  }, [selectedId, planets, orbitAngle]);

  useFrame((_, delta) => {
    const step = delta * FLY_SPEED;
    camera.position.lerp(target.current, step);
    const currentLook = new Vector3();
    camera.getWorldDirection(currentLook);
    const desiredLook = lookTarget.current.clone().sub(camera.position).normalize();
    currentLook.lerp(desiredLook, step);
    camera.lookAt(camera.position.clone().add(currentLook));
  });

  return null;
}
