import { requireNativeModule } from "expo-modules-core";

const ARSceneModule = requireNativeModule("ARScene");

export function startARSession(): void {
  ARSceneModule.startSession();
}

export function stopARSession(): void {
  ARSceneModule.stopSession();
}

export function placeAnchor(x: number, y: number, z: number): void {
  ARSceneModule.placeAnchor(x, y, z);
}

export function addPlaneListener(callback: (plane: unknown) => void): () => void {
  return ARSceneModule.addListener("onPlaneDetected", callback);
}

export function addFrameListener(callback: (pose: unknown) => void): () => void {
  return ARSceneModule.addListener("onFrameUpdate", callback);
}

export function isARSupported(): boolean {
  return ARSceneModule.isSupported ?? false;
}
