"use client";

import {
  Suspense,
  useMemo,
  useRef,
  useState,
  useEffect,
  type CSSProperties,
} from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import { Box3, Vector3, type Group } from "three";

/**
 * The SDLC galaxy as a 3D model: nine planets orbiting in a ring, each one a
 * stage of the software development lifecycle. The model auto-rotates so a
 * reader sees the full cycle without touching it, and OrbitControls let them
 * spin it by hand when they want a closer look.
 */

function GalaxyModel() {
  const spin = useRef<Group>(null);
  const { scene } = useGLTF("/models/sdlc-galaxy.glb");

  /* The model arrives at whatever scale its author worked in, which is not the
     scale the camera was placed for. Measured once and fitted to the frame, so
     the ring fills the field instead of a speck of it. */
  const { scale, offset } = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const span = Math.max(size.x, size.y, size.z) || 1;
    return { scale: 3.2 / span, offset: center.multiplyScalar(-1) };
  }, [scene]);

  // Slow auto-rotation: the galaxy turns on its own so the reader sees the
  // whole cycle without interaction.
  useFrame((_, delta) => {
    if (spin.current) spin.current.rotation.y += delta * 0.15;
  });

  return (
    <group scale={scale}>
      <group position={offset}>
        <group ref={spin}>
          <primitive object={scene} />
        </group>
      </group>
    </group>
  );
}

function canUseWebGL(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch {
    return false;
  }
}

function LoadingFallback() {
  return (
    <div className="galaxy-loading" role="status" aria-label="Loading 3D model">
      <div className="galaxy-loading-spinner" />
    </div>
  );
}

export function Galaxy3D({
  width = 300,
  height = 300,
  fill = false,
}: {
  width?: number;
  height?: number;
  /** Take the box the page gives this, rather than a fixed one. */
  fill?: boolean;
}) {
  const [webglSupported, setWebglSupported] = useState(true);

  useEffect(() => {
    setWebglSupported(canUseWebGL());
  }, []);

  const containerStyle = {
    width: fill ? "100%" : width,
    height: fill ? "100%" : height,
  } as CSSProperties;

  if (!webglSupported) {
    return (
      <div
        className="galaxy-fallback"
        style={containerStyle}
        role="img"
        aria-label="3D view unavailable — your browser does not support WebGL"
      >
        <p>3D view is not available in this browser.</p>
      </div>
    );
  }

  return (
    <div style={containerStyle} className="galaxy-container">
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ position: [0, 2, 5], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: "transparent" }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <GalaxyModel />
          <OrbitControls
            enableZoom={true}
            enablePan={false}
            autoRotate={false}
            minDistance={2}
            maxDistance={10}
          />
        </Canvas>
      </Suspense>
    </div>
  );
}
