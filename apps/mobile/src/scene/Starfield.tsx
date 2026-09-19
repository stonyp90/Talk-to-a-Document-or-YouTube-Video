import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Points, BufferAttribute, Color } from "three";

const STAR_COUNT = 2000;
const SPREAD = 50;

export function Starfield() {
  const ref = useRef<Points>(null);

  const positions = useMemo(() => {
    const arr = new Float32Array(STAR_COUNT * 3);
    for (let i = 0; i < STAR_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * SPREAD;
      arr[i * 3 + 1] = (Math.random() - 0.5) * SPREAD;
      arr[i * 3 + 2] = (Math.random() - 0.5) * SPREAD;
    }
    return arr;
  }, []);

  const colors = useMemo(() => {
    const arr = new Float32Array(STAR_COUNT * 3);
    const palette = [
      new Color("#F47762"), new Color("#A84332"), new Color("#677C4A"),
      new Color("#EEE9E1"), new Color("#7C3AED"),
    ];
    for (let i = 0; i < STAR_COUNT; i++) {
      const c = palette[Math.floor(Math.random() * palette.length)];
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, []);

  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.01;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial size={0.08} vertexColors transparent opacity={0.8} />
    </points>
  );
}
