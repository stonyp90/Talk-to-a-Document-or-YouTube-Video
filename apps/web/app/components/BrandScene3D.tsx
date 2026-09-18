"use client";

import { useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import type * as THREE from "three";

function Model() {
  const { scene } = useGLTF("/models/brand-scene.glb");
  const ref = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta * 0.3;
    }
  });
  return <primitive ref={ref} object={scene} />;
}

/**
 * The 3D brand scene: the equalizer + document-flow GLB gently rotating in
 * a softly-lit canvas. Rendered inside a Suspense boundary so the static
 * loader covers the time while Three.js initialises and the model downloads.
 */
export default function BrandScene3D() {
  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 3], fov: 50 }}
        style={{ width: "100%", height: "100%" }}
        gl={{ alpha: true }}
      >
        <ambientLight intensity={0.7} />
        <directionalLight position={[2, 3, 2]} intensity={0.4} />
        <pointLight position={[-2, -1, 2]} intensity={0.2} color="#f47762" />
        <pointLight position={[2, 1, -2]} intensity={0.2} color="#a84332" />
        <Model />
      </Canvas>
      <span className="app-loader-word">
        {Array.from("ursly").map((letter, index) => (
          <span key={index}>{letter}</span>
        ))}
        <span className="brand-dot">.</span>
      </span>
      <span className="app-loader-bar">
        <span />
      </span>
    </>
  );
}
