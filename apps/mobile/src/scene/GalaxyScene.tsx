import React, { Suspense, useMemo, useRef } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Canvas, useFrame, useLoader } from "@react-three/fiber";
// @ts-expect-error – three ships GLTFLoader without type declarations
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";
import { Box3, Vector3, type Group } from "three";
import { Asset } from "expo-asset";
import { CameraController } from "./CameraController";

function GalaxyModel() {
  const spin = useRef<Group>(null);
  const asset = Asset.fromModule(require("../../assets/models/sdlc-galaxy.glb"));
  asset.downloadAsync();
  const gltf = useLoader(GLTFLoader as any, asset.localUri ?? asset.uri);
  const { scene } = gltf as any;

  const { scale, offset } = useMemo(() => {
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const center = box.getCenter(new Vector3());
    const span = Math.max(size.x, size.y, size.z) || 1;
    return { scale: 3.2 / span, offset: center.multiplyScalar(-1) };
  }, [scene]);

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

function LoadingFallback() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color="#F47762" />
    </View>
  );
}

export function GalaxyScene() {
  return (
    <View style={styles.container}>
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ position: [0, 2, 5], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
          style={{ backgroundColor: "transparent" }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <GalaxyModel />
          <CameraController selectedId={null} planets={[]} />
        </Canvas>
      </Suspense>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
});
