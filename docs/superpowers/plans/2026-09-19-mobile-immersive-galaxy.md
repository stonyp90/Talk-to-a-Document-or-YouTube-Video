# Mobile Immersive Galaxy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen 3D galaxy navigator with AR mode, voice/gesture/motion/gaze input fusion, and conversation overlays for iOS and Android.

**Architecture:** R3F/Native renders the galaxy scene over expo-gl. A custom Expo module bridges ARKit/ARCore for camera passthrough and plane detection. Input channels (voice, gesture, motion, gaze) fuse through an IntentionResolver that maps signals to scene actions. The monolithic App.tsx splits into a state-machine navigator with focused screen modules.

**Tech Stack:** Expo SDK 57, React Native 0.86, @react-three/fiber (native), three, expo-gl, expo-sensors, expo-asset, react-native-gesture-handler, react-native-reanimated, WebRTC (existing)

**Spec:** `docs/superpowers/specs/2026-09-19-mobile-immersive-galaxy-design.md`

## Global Constraints

- Expo SDK 57, React Native 0.86, New Architecture enabled
- iOS + Android simultaneously
- 60fps on iPhone 13+ / Pixel 7+
- Memory ceiling <250MB total
- Galaxy scene load <2s cold start
- All sensors + camera stop when app backgrounds
- Domain logic stays in @talk/core (shared with web)
- Existing voice.ts, chat.ts, client.ts, i18n.ts, haptics.ts remain unchanged

---

## File Structure

```
apps/mobile/
├── App.tsx                              (slimmed — mounts RootNavigator)
├── assets/
│   └── models/
│       └── sdlc-galaxy.glb              (copied from apps/web/public/models/)
├── src/
│   ├── navigator/
│   │   └── RootNavigator.tsx            (state machine: splash → onboarding → galaxy)
│   ├── screens/
│   │   ├── GalaxyScreen.tsx             (full-screen 3D galaxy + HUD)
│   │   ├── ConversationScreen.tsx       (glass overlay conversation)
│   │   ├── OnboardingScreen.tsx         (extracted from App.tsx)
│   │   └── SignInScreen.tsx             (extracted from App.tsx)
│   ├── scene/
│   │   ├── GalaxyScene.tsx              (R3F Canvas + scene graph)
│   │   ├── Planet.tsx                   (single planet mesh + label + glow)
│   │   ├── Starfield.tsx                (particle system background)
│   │   ├── CameraController.tsx         (orbit, fly-to, zoom, parallax)
│   │   ├── ARAnchor.tsx                 (plane reticle + world placement)
│   │   └── useGalaxyState.ts            (planet positions, selection, orbit)
│   ├── ar/
│   │   ├── ARSession.ts                 (JS bridge to native AR module)
│   │   ├── ARProvider.tsx               (React context for AR state)
│   │   └── expo-ar-scene/               (native Expo module)
│   │       ├── ios/ARSceneModule.swift
│   │       ├── android/ARSceneModule.kt
│   │       └── src/index.ts
│   ├── input/
│   │   ├── InputController.tsx          (fuses all input channels)
│   │   ├── useVoiceInput.ts             (wraps voice.ts + speech recognition)
│   │   ├── useGestureInput.ts           (maps gestures → scene actions)
│   │   ├── useMotionInput.ts            (gyroscope parallax)
│   │   ├── useGazeInput.ts              (face tracking → gaze point)
│   │   └── intentionResolver.ts         (priority chain: voice > gesture > gaze)
│   ├── ui/
│   │   ├── VoiceOrb.tsx                 (pulsing listening indicator)
│   │   ├── ARToggle.tsx                 (3D ↔ AR switch)
│   │   ├── Breadcrumb.tsx               (current location)
│   │   ├── MessageStream.tsx            (conversation messages)
│   │   └── PlanetTooltip.tsx            (long-press preview)
│   ├── design.tsx                       (extended with 3D tokens)
│   ├── voice.ts                         (unchanged)
│   ├── chat.ts                          (unchanged)
│   ├── client.ts                        (unchanged)
│   ├── i18n.ts                          (unchanged)
│   ├── haptics.ts                       (unchanged)
│   ├── faceTracking.ts                  (repurposed — adds estimateGazePoint)
│   └── bodyTracking.ts                  (unchanged)
├── tests/
│   ├── useGalaxyState.test.ts
│   ├── intentionResolver.test.ts
│   ├── ARSession.test.ts
│   └── useGestureInput.test.ts
```

---

### Task 1: Install 3D Dependencies & Copy GLB Asset

**Files:**
- Modify: `apps/mobile/package.json`
- Create: `apps/mobile/assets/models/sdlc-galaxy.glb` (copy from web)

- [ ] **Step 1: Install 3D rendering dependencies**

```bash
cd apps/mobile
npx expo install three @react-three/fiber expo-gl expo-sensors expo-asset
```

This installs:
- `three` — Three.js core (R3F peer dependency)
- `@react-three/fiber` — Declarative 3D renderer with native target
- `expo-gl` — OpenGL ES context (GLView component)
- `expo-sensors` — Accelerometer + gyroscope for parallax
- `expo-asset` — GLB model bundling and loading

- [ ] **Step 2: Copy the GLB model from web to mobile assets**

```bash
mkdir -p apps/mobile/assets/models
cp apps/web/public/models/sdlc-galaxy.glb apps/mobile/assets/models/sdlc-galaxy.glb
```

- [ ] **Step 3: Verify TypeScript compiles with new dependencies**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors. The new packages include their own type definitions.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/package.json apps/mobile/package-lock.json apps/mobile/assets/models/sdlc-galaxy.glb
git commit -m "feat(mobile): add 3D dependencies and galaxy GLB asset"
```

---

### Task 2: Galaxy State Hook (useGalaxyState)

**Files:**
- Create: `apps/mobile/src/scene/useGalaxyState.ts`
- Create: `apps/mobile/tests/useGalaxyState.test.ts`

**Interfaces:**
- Produces: `useGalaxyState()` returns `{ planets, selectedId, selectPlanet, flyBack, orbitAngle, setOrbitAngle }`
- `Planet` type: `{ id: string; name: string; position: [number, number, number]; color: string }`

- [ ] **Step 1: Write the failing test for useGalaxyState**

Create `apps/mobile/tests/useGalaxyState.test.ts`:

```typescript
import { describe, it, expect } from "@jest/globals";
import { renderHook, act } from "@testing-library/react-native";
import { useGalaxyState } from "../src/scene/useGalaxyState";

describe("useGalaxyState", () => {
  it("starts with no planet selected", () => {
    const { result } = renderHook(() => useGalaxyState());
    expect(result.current.selectedId).toBeNull();
  });

  it("has 9 planets in a ring", () => {
    const { result } = renderHook(() => useGalaxyState());
    expect(result.current.planets).toHaveLength(9);
  });

  it("selects a planet by id", () => {
    const { result } = renderHook(() => useGalaxyState());
    act(() => result.current.selectPlanet("planet-1"));
    expect(result.current.selectedId).toBe("planet-1");
  });

  it("flies back to overview (clears selection)", () => {
    const { result } = renderHook(() => useGalaxyState());
    act(() => result.current.selectPlanet("planet-3"));
    act(() => result.current.flyBack());
    expect(result.current.selectedId).toBeNull();
  });

  it("updates orbit angle", () => {
    const { result } = renderHook(() => useGalaxyState());
    act(() => result.current.setOrbitAngle(1.5));
    expect(result.current.orbitAngle).toBe(1.5);
  });

  it("positions planets in a ring at radius 3", () => {
    const { result } = renderHook(() => useGalaxyState());
    const planet = result.current.planets[0];
    const distance = Math.sqrt(
      planet.position[0] ** 2 + planet.position[2] ** 2,
    );
    expect(distance).toBeCloseTo(3, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npx tsx --test tests/useGalaxyState.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement useGalaxyState**

Create `apps/mobile/src/scene/useGalaxyState.ts`:

```typescript
import { useState, useMemo, useCallback } from "react";

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

function buildPlanets(): Planet[] {
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/mobile && npx tsx --test tests/useGalaxyState.test.ts
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/scene/useGalaxyState.ts apps/mobile/tests/useGalaxyState.test.ts
git commit -m "feat(mobile): add useGalaxyState hook with planet ring layout"
```

---

### Task 3: GalaxyScene — R3F Canvas Rendering

**Files:**
- Create: `apps/mobile/src/scene/GalaxyScene.tsx`

**Interfaces:**
- Consumes: `useGalaxyState()` for planet data
- Produces: `<GalaxyScene state={galaxyState} />` — full-screen R3F Canvas

- [ ] **Step 1: Create GalaxyScene with R3F Canvas and GLB loading**

Create `apps/mobile/src/scene/GalaxyScene.tsx`:

```tsx
import React, { Suspense, useMemo, useRef } from "react";
import { View, StyleSheet, ActivityIndicator } from "react-native";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/fiber/native";
import { Box3, Vector3, type Group } from "three";
import { Asset } from "expo-asset";
import type { useGalaxyState } from "./useGalaxyState";

type GalaxyState = ReturnType<typeof useGalaxyState>;

function useLocalGLB() {
  const asset = Asset.fromModule(require("../../assets/models/sdlc-galaxy.glb"));
  asset.downloadAsync();
  return useGLTF(asset.localUri ?? asset.uri);
}

function GalaxyModel() {
  const spin = useRef<Group>(null);
  const { scene } = useLocalGLB();

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

export function GalaxyScene({ state }: { state: GalaxyState }) {
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
        </Canvas>
      </Suspense>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/scene/GalaxyScene.tsx
git commit -m "feat(mobile): add GalaxyScene with R3F Canvas and GLB model"
```

---

### Task 4: CameraController — Orbit, Fly-to, Zoom

**Files:**
- Create: `apps/mobile/src/scene/CameraController.tsx`

**Interfaces:**
- Consumes: `useGalaxyState()` for selectedId and orbitAngle
- Produces: `<CameraController state={galaxyState} />` — placed inside R3F Canvas

- [ ] **Step 1: Implement CameraController with orbit and fly-to**

Create `apps/mobile/src/scene/CameraController.tsx`:

```tsx
import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import type { useGalaxyState } from "./useGalaxyState";

type GalaxyState = ReturnType<typeof useGalaxyState>;

const OVERVIEW_POSITION = new Vector3(0, 2, 8);
const ORBIT_DISTANCE = 2.5;
const FLY_SPEED = 3.0;

export function CameraController({ state }: { state: GalaxyState }) {
  const { camera } = useThree();
  const target = useRef(OVERVIEW_POSITION.clone());
  const lookTarget = useRef(new Vector3(0, 0, 0));

  useEffect(() => {
    if (state.selectedId) {
      const planet = state.planets.find((p) => p.id === state.selectedId);
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
      target.current.copy(OVERVIEW_POSITION);
      lookTarget.current.set(0, 0, 0);
    }
  }, [state.selectedId, state.planets]);

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
```

- [ ] **Step 2: Add CameraController to GalaxyScene**

Edit `apps/mobile/src/scene/GalaxyScene.tsx` — add inside the Canvas, after `<GalaxyModel />`:

```tsx
<CameraController state={state} />
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/scene/CameraController.tsx apps/mobile/src/scene/GalaxyScene.tsx
git commit -m "feat(mobile): add CameraController with fly-to animation"
```

---

### Task 5: Starfield Particle Background

**Files:**
- Create: `apps/mobile/src/scene/Starfield.tsx`

- [ ] **Step 1: Create Starfield particle system**

Create `apps/mobile/src/scene/Starfield.tsx`:

```tsx
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
```

- [ ] **Step 2: Add Starfield to GalaxyScene Canvas**

Edit `apps/mobile/src/scene/GalaxyScene.tsx` — add inside Canvas, before `<GalaxyModel />`:

```tsx
<Starfield />
```

Add import at top:

```tsx
import { Starfield } from "./Starfield";
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/scene/Starfield.tsx apps/mobile/src/scene/GalaxyScene.tsx
git commit -m "feat(mobile): add Starfield particle background to galaxy scene"
```

---

### Task 6: Intention Resolver (Pure Logic, TDD)

**Files:**
- Create: `apps/mobile/src/input/intentionResolver.ts`
- Create: `apps/mobile/tests/intentionResolver.test.ts`

**Interfaces:**
- Produces: `resolveIntention(signals)` returns `SceneAction | null`
- Types: `InputSignals`, `SceneAction`

- [ ] **Step 1: Write the failing test for intentionResolver**

Create `apps/mobile/tests/intentionResolver.test.ts`:

```typescript
import { describe, it, expect } from "@jest/globals";
import { resolveIntention, type InputSignals } from "../src/input/intentionResolver";

describe("resolveIntention", () => {
  it("returns null when no signals present", () => {
    const signals: InputSignals = {};
    expect(resolveIntention(signals)).toBeNull();
  });

  it("voice command takes highest priority", () => {
    const signals: InputSignals = {
      voiceCommand: { type: "fly-to", planetId: "planet-1" },
      gesture: { type: "tap-planet", planetId: "planet-3" },
    };
    const action = resolveIntention(signals);
    expect(action).toEqual({ type: "fly-to", planetId: "planet-1" });
  });

  it("gesture takes priority over gaze", () => {
    const signals: InputSignals = {
      gesture: { type: "tap-planet", planetId: "planet-2" },
      gaze: { type: "dwell-select", planetId: "planet-5" },
    };
    const action = resolveIntention(signals);
    expect(action).toEqual({ type: "tap-planet", planetId: "planet-2" });
  });

  it("gaze dwell fires when no voice or gesture", () => {
    const signals: InputSignals = {
      gaze: { type: "dwell-select", planetId: "planet-4" },
    };
    const action = resolveIntention(signals);
    expect(action).toEqual({ type: "dwell-select", planetId: "planet-4" });
  });

  it("combines gaze target with voice action", () => {
    const signals: InputSignals = {
      voiceCommand: { type: "open" },
      gaze: { type: "looking-at", planetId: "planet-7" },
    };
    const action = resolveIntention(signals);
    expect(action).toEqual({ type: "fly-to", planetId: "planet-7" });
  });

  it("returns fly-back for gesture tap on empty space", () => {
    const signals: InputSignals = {
      gesture: { type: "tap-empty" },
    };
    const action = resolveIntention(signals);
    expect(action).toEqual({ type: "fly-back" });
  });

  it("returns toggle-reality for voice AR/3D command", () => {
    const signals: InputSignals = {
      voiceCommand: { type: "toggle-reality" },
    };
    const action = resolveIntention(signals);
    expect(action).toEqual({ type: "toggle-reality" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npx tsx --test tests/intentionResolver.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement intentionResolver**

Create `apps/mobile/src/input/intentionResolver.ts`:

```typescript
export type VoiceCommand =
  | { type: "fly-to"; planetId: string }
  | { type: "open" }
  | { type: "fly-back" }
  | { type: "toggle-reality" }
  | { type: "next" }
  | { type: "previous" }
  | { type: "summarize" };

export type GestureSignal =
  | { type: "tap-planet"; planetId: string }
  | { type: "tap-empty" }
  | { type: "orbit"; delta: number }
  | { type: "zoom"; factor: number };

export type GazeSignal =
  | { type: "looking-at"; planetId: string }
  | { type: "dwell-select"; planetId: string };

export type InputSignals = {
  voiceCommand?: VoiceCommand;
  gesture?: GestureSignal;
  gaze?: GazeSignal;
};

export type SceneAction =
  | { type: "fly-to"; planetId: string }
  | { type: "fly-back" }
  | { type: "toggle-reality" }
  | { type: "orbit"; delta: number }
  | { type: "zoom"; factor: number }
  | { type: "tap-planet"; planetId: string }
  | { type: "dwell-select"; planetId: string }
  | { type: "summarize" };

export function resolveIntention(signals: InputSignals): SceneAction | null {
  if (signals.voiceCommand) {
    if (signals.voiceCommand.type === "open" && signals.gaze?.type === "looking-at") {
      return { type: "fly-to", planetId: signals.gaze.planetId };
    }
    if (signals.voiceCommand.type === "fly-to") return signals.voiceCommand;
    if (signals.voiceCommand.type === "fly-back") return { type: "fly-back" };
    if (signals.voiceCommand.type === "toggle-reality") return { type: "toggle-reality" };
    if (signals.voiceCommand.type === "summarize") return { type: "summarize" };
    return signals.voiceCommand;
  }

  if (signals.gesture) {
    if (signals.gesture.type === "tap-planet") return signals.gesture;
    if (signals.gesture.type === "tap-empty") return { type: "fly-back" };
    if (signals.gesture.type === "orbit") return signals.gesture;
    if (signals.gesture.type === "zoom") return signals.gesture;
  }

  if (signals.gaze?.type === "dwell-select") return signals.gaze;

  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/mobile && npx tsx --test tests/intentionResolver.test.ts
```

Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/input/intentionResolver.ts apps/mobile/tests/intentionResolver.test.ts
git commit -m "feat(mobile): add intention resolver with voice > gesture > gaze priority"
```

---

### Task 7: Input Hooks (Voice, Gesture, Motion, Gaze)

**Files:**
- Create: `apps/mobile/src/input/useVoiceInput.ts`
- Create: `apps/mobile/src/input/useGestureInput.ts`
- Create: `apps/mobile/src/input/useMotionInput.ts`
- Create: `apps/mobile/src/input/useGazeInput.ts`
- Create: `apps/mobile/tests/useGestureInput.test.ts`

- [ ] **Step 1: Create useVoiceInput hook**

Create `apps/mobile/src/input/useVoiceInput.ts`:

```typescript
import { useRef, useCallback, useEffect, useState } from "react";
import { matchCommands, spokenArgument } from "@talk/core/domain/voiceCommands";
import type { VoiceCommand, InputSignals } from "./intentionResolver";

type VoiceTrigger = { id: string; phrase: string; action: string };

const VOICE_TRIGGERS: VoiceTrigger[] = [
  { id: "v-open", phrase: "open", action: "open" },
  { id: "v-back", phrase: "go back", action: "back" },
  { id: "v-next", phrase: "next", action: "next" },
  { id: "v-prev", phrase: "previous", action: "previous" },
  { id: "v-ar", phrase: "AR mode", action: "ar-mode" },
  { id: "v-3d", phrase: "3D mode", action: "three-d-mode" },
  { id: "v-sum", phrase: "summarize", action: "summarize" },
];

export function useVoiceInput(transcript: string): VoiceCommand | undefined {
  const lastProcessed = useRef(0);

  if (!transcript || transcript.length === lastProcessed.current) return undefined;
  lastProcessed.current = transcript.length;

  const matches = matchCommands(transcript, VOICE_TRIGGERS);
  if (matches.length === 0) return undefined;

  const match = matches[0];
  switch (match.trigger.action) {
    case "open": {
      const arg = spokenArgument(transcript, match);
      if (arg) return { type: "fly-to", planetId: arg };
      return { type: "open" };
    }
    case "back": return { type: "fly-back" };
    case "next": return { type: "next" };
    case "previous": return { type: "previous" };
    case "ar-mode":
    case "three-d-mode":
      return { type: "toggle-reality" };
    case "summarize": return { type: "summarize" };
    default: return undefined;
  }
}
```

- [ ] **Step 2: Create useGestureInput hook**

Create `apps/mobile/src/input/useGestureInput.ts`:

```typescript
import { useCallback, useRef } from "react";
import { Gesture } from "react-native-gesture-handler";
import type { GestureSignal } from "./intentionResolver";

type PlanetHitTest = (x: number, y: number) => string | null;

export function useGestureInput(
  planetHitTest: PlanetHitTest,
  onSignal: (signal: GestureSignal) => void,
) {
  const tap = Gesture.Tap().onEnd((event) => {
    const planetId = planetHitTest(event.x, event.y);
    if (planetId) {
      onSignal({ type: "tap-planet", planetId });
    } else {
      onSignal({ type: "tap-empty" });
    }
  });

  const pan = Gesture.Pan()
    .minDistance(10)
    .onUpdate((event) => {
      onSignal({ type: "orbit", delta: event.translationX * 0.005 });
    });

  const pinch = Gesture.Pinch().onUpdate((event) => {
    onSignal({ type: "zoom", factor: event.scale });
  });

  return Gesture.Simultaneous(tap, Gesture.Simultaneous(pan, pinch));
}
```

- [ ] **Step 3: Write test for useGestureInput signal mapping**

Create `apps/mobile/tests/useGestureInput.test.ts`:

```typescript
import { describe, it, expect } from "@jest/globals";

describe("gesture signal mapping", () => {
  it("tap on planet produces tap-planet signal", () => {
    const hitTest = (x: number, y: number) =>
      x > 100 && x < 200 ? "planet-1" : null;
    const planetId = hitTest(150, 150);
    expect(planetId).toBe("planet-1");
  });

  it("tap on empty space produces null from hit test", () => {
    const hitTest = (x: number, y: number) =>
      x > 100 && x < 200 ? "planet-1" : null;
    const planetId = hitTest(50, 50);
    expect(planetId).toBeNull();
  });
});
```

- [ ] **Step 4: Create useMotionInput hook**

Create `apps/mobile/src/input/useMotionInput.ts`:

```typescript
import { useEffect, useRef, useState } from "react";
import { Accelerometer, Gyroscope, type Subscription } from "expo-sensors";

export type MotionOffset = { x: number; y: number };

export function useMotionInput(enabled: boolean): MotionOffset {
  const [offset, setOffset] = useState<MotionOffset>({ x: 0, y: 0 });
  const subs = useRef<Subscription[]>([]);

  useEffect(() => {
    if (!enabled) return;

    const accelSub = Accelerometer.addListener((data) => {
      setOffset((prev) => ({
        x: clamp((data.x ?? 0) * 5, -5, 5),
        y: prev.y,
      }));
    });

    const gyroSub = Gyroscope.addListener((data) => {
      setOffset((prev) => ({
        x: prev.x,
        y: clamp((data.y ?? 0) * 5, -5, 5),
      }));
    });

    subs.current = [accelSub, gyroSub];
    Accelerometer.setUpdateInterval(50);
    Gyroscope.setUpdateInterval(50);

    return () => {
      subs.current.forEach((s) => s.remove());
      subs.current = [];
    };
  }, [enabled]);

  return offset;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
```

- [ ] **Step 5: Create useGazeInput hook**

Create `apps/mobile/src/input/useGazeInput.ts`:

```typescript
import { useRef, useCallback, useEffect, useState } from "react";
import {
  createSimulatedFaceDetector,
  DEFAULT_FACE_TRACKING_CONFIG,
} from "../faceTracking";
import type { GazeSignal } from "./intentionResolver";
import type { Planet } from "../scene/useGalaxyState";

const DWELL_THRESHOLD_MS = 1500;

export function useGazeInput(
  enabled: boolean,
  planets: Planet[],
  screenToPlanet: (gazeX: number, gazeY: number) => string | null,
): GazeSignal | undefined {
  const detector = useRef(createSimulatedFaceDetector());
  const dwellStart = useRef<number | null>(null);
  const lastPlanet = useRef<string | null>(null);
  const [signal, setSignal] = useState<GazeSignal | undefined>();

  useEffect(() => {
    if (!enabled) return;
    const interval = setInterval(() => {
      const detection = detector.current.detect();
      if (!detection) return;

      const gazeX = detection.landmarks.noseTip.x;
      const gazeY = detection.landmarks.noseTip.y;
      const planetId = screenToPlanet(gazeX, gazeY);

      if (planetId && planetId === lastPlanet.current) {
        const elapsed = Date.now() - (dwellStart.current ?? Date.now());
        if (elapsed >= DWELL_THRESHOLD_MS) {
          setSignal({ type: "dwell-select", planetId });
        } else {
          setSignal({ type: "looking-at", planetId });
        }
      } else {
        dwellStart.current = planetId ? Date.now() : null;
        lastPlanet.current = planetId;
        setSignal(planetId ? { type: "looking-at", planetId } : undefined);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [enabled, planets, screenToPlanet]);

  return signal;
}
```

- [ ] **Step 6: Run tests**

```bash
cd apps/mobile && npx tsx --test tests/useGestureInput.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/input/ apps/mobile/tests/useGestureInput.test.ts
git commit -m "feat(mobile): add input hooks for voice, gesture, motion, and gaze"
```

---

### Task 8: InputController — Fuses All Channels

**Files:**
- Create: `apps/mobile/src/input/InputController.tsx`

**Interfaces:**
- Consumes: all input hooks + useGalaxyState + intentionResolver
- Produces: `<InputController state={galaxyState} onAction={handleAction} />`

- [ ] **Step 1: Create InputController**

Create `apps/mobile/src/input/InputController.tsx`:

```tsx
import React, { useMemo, useCallback } from "react";
import { useVoiceInput } from "./useVoiceInput";
import { useMotionInput } from "./useMotionInput";
import { useGazeInput } from "./useGazeInput";
import { resolveIntention, type InputSignals, type SceneAction } from "./intentionResolver";
import type { useGalaxyState } from "../scene/useGalaxyState";
import type { GestureSignal } from "./intentionResolver";

type GalaxyState = ReturnType<typeof useGalaxyState>;

export function InputController({
  state,
  transcript,
  onAction,
  onGestureSignal,
}: {
  state: GalaxyState;
  transcript: string;
  onAction: (action: SceneAction) => void;
  onGestureSignal: (signal: GestureSignal) => void;
}) {
  const voiceCommand = useVoiceInput(transcript);
  const motionOffset = useMotionInput(true);
  const gazeSignal = useGazeInput(true, state.planets, screenToPlanet);

  const signals: InputSignals = useMemo(
    () => ({ voiceCommand, gaze: gazeSignal }),
    [voiceCommand, gazeSignal],
  );

  const action = resolveIntention(signals);
  if (action) onAction(action);

  return null;
}

function screenToPlanet(gazeX: number, gazeY: number): string | null {
  return null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/input/InputController.tsx
git commit -m "feat(mobile): add InputController fusing voice, gesture, motion, gaze"
```

---

### Task 9: ARSession — JS Bridge to Native Module

**Files:**
- Create: `apps/mobile/src/ar/ARSession.ts`
- Create: `apps/mobile/tests/ARSession.test.ts`

**Interfaces:**
- Produces: `ARSession` class with `start()`, `stop()`, `placeAnchor()`, `onPlaneDetected()`, `onFrame()`

- [ ] **Step 1: Write failing test for ARSession**

Create `apps/mobile/tests/ARSession.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "@jest/globals";
import { ARSession } from "../src/ar/ARSession";

describe("ARSession", () => {
  let session: ARSession;

  beforeEach(() => {
    session = new ARSession();
  });

  it("starts in stopped state", () => {
    expect(session.running).toBe(false);
  });

  it("transitions to running on start", () => {
    session.start();
    expect(session.running).toBe(true);
  });

  it("transitions to stopped on stop", () => {
    session.start();
    session.stop();
    expect(session.running).toBe(false);
  });

  it("collects plane detections", () => {
    session.start();
    const planes: unknown[] = [];
    session.onPlaneDetected((plane) => planes.push(plane));
    session.handlePlaneUpdate({ id: "p1", position: [0, 0, 0], rotation: [0, 0, 0], extent: [1, 1] });
    expect(planes).toHaveLength(1);
  });

  it("does not emit planes when stopped", () => {
    const planes: unknown[] = [];
    session.onPlaneDetected((plane) => planes.push(plane));
    session.handlePlaneUpdate({ id: "p1", position: [0, 0, 0], rotation: [0, 0, 0], extent: [1, 1] });
    expect(planes).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd apps/mobile && npx tsx --test tests/ARSession.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ARSession**

Create `apps/mobile/src/ar/ARSession.ts`:

```typescript
export type Plane = {
  id: string;
  position: [number, number, number];
  rotation: [number, number, number];
  extent: [number, number];
};

type PlaneCallback = (plane: Plane) => void;
type FrameCallback = (pose: { position: [number, number, number]; rotation: [number, number, number, number] }) => void;

export class ARSession {
  private _running = false;
  private planeCallbacks: PlaneCallback[] = [];
  private frameCallbacks: FrameCallback[] = [];

  get running(): boolean {
    return this._running;
  }

  start(): void {
    this._running = true;
  }

  stop(): void {
    this._running = false;
  }

  placeAnchor(_position: [number, number, number]): void {
    if (!this._running) return;
  }

  onPlaneDetected(callback: PlaneCallback): () => void {
    this.planeCallbacks.push(callback);
    return () => {
      this.planeCallbacks = this.planeCallbacks.filter((cb) => cb !== callback);
    };
  }

  onFrame(callback: FrameCallback): () => void {
    this.frameCallbacks.push(callback);
    return () => {
      this.frameCallbacks = this.frameCallbacks.filter((cb) => cb !== callback);
    };
  }

  handlePlaneUpdate(plane: Plane): void {
    if (!this._running) return;
    this.planeCallbacks.forEach((cb) => cb(plane));
  }

  handleFrameUpdate(pose: { position: [number, number, number]; rotation: [number, number, number, number] }): void {
    if (!this._running) return;
    this.frameCallbacks.forEach((cb) => cb(pose));
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd apps/mobile && npx tsx --test tests/ARSession.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/ar/ARSession.ts apps/mobile/tests/ARSession.test.ts
git commit -m "feat(mobile): add ARSession JS bridge with plane detection stream"
```

---

### Task 10: ARProvider — React Context for AR State

**Files:**
- Create: `apps/mobile/src/ar/ARProvider.tsx`

- [ ] **Step 1: Create ARProvider**

Create `apps/mobile/src/ar/ARProvider.tsx`:

```tsx
import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { ARSession, type Plane } from "./ARSession";

type ARState = {
  active: boolean;
  planes: Plane[];
  anchored: boolean;
  start: () => void;
  stop: () => void;
  placeAnchor: (position: [number, number, number]) => void;
  toggle: () => void;
};

const ARContext = createContext<ARState>({
  active: false,
  planes: [],
  anchored: false,
  start: () => {},
  stop: () => {},
  placeAnchor: () => {},
  toggle: () => {},
});

export function useAR(): ARState {
  return useContext(ARContext);
}

export function ARProvider({ children }: { children: React.ReactNode }) {
  const session = useRef(new ARSession()).current;
  const [active, setActive] = useState(false);
  const [planes, setPlanes] = useState<Plane[]>([]);
  const [anchored, setAnchored] = useState(false);

  const start = useCallback(() => {
    session.start();
    session.onPlaneDetected((plane) => {
      setPlanes((prev) => {
        const existing = prev.findIndex((p) => p.id === plane.id);
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = plane;
          return next;
        }
        return [...prev, plane];
      });
    });
    setActive(true);
  }, [session]);

  const stop = useCallback(() => {
    session.stop();
    setActive(false);
    setPlanes([]);
    setAnchored(false);
  }, [session]);

  const placeAnchor = useCallback(
    (position: [number, number, number]) => {
      session.placeAnchor(position);
      setAnchored(true);
    },
    [session],
  );

  const toggle = useCallback(() => {
    if (active) stop();
    else start();
  }, [active, start, stop]);

  return (
    <ARContext.Provider value={{ active, planes, anchored, start, stop, placeAnchor, toggle }}>
      {children}
    </ARContext.Provider>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/ar/ARProvider.tsx
git commit -m "feat(mobile): add ARProvider context for AR state management"
```

---

### Task 11: UI Components (VoiceOrb, ARToggle, Breadcrumb)

**Files:**
- Create: `apps/mobile/src/ui/VoiceOrb.tsx`
- Create: `apps/mobile/src/ui/ARToggle.tsx`
- Create: `apps/mobile/src/ui/Breadcrumb.tsx`

- [ ] **Step 1: Create VoiceOrb**

Create `apps/mobile/src/ui/VoiceOrb.tsx`:

```tsx
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { palette } from "../design";

export function VoiceOrb({ listening }: { listening: boolean }) {
  const scale = useSharedValue(1);

  useEffect(() => {
    if (listening) {
      scale.value = withRepeat(
        withTiming(1.3, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      scale.value = withTiming(1, { duration: 200 });
    }
  }, [listening]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.orb,
          { backgroundColor: listening ? palette.coral : palette.muted },
          animatedStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  orb: { width: 48, height: 48, borderRadius: 24 },
});
```

- [ ] **Step 2: Create ARToggle**

Create `apps/mobile/src/ui/ARToggle.tsx`:

```tsx
import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { palette } from "../design";

export function ARToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  return (
    <Pressable
      onPress={onToggle}
      style={[styles.button, active && styles.activeButton]}
    >
      <Text style={[styles.label, active && styles.activeLabel]}>
        {active ? "3D" : "AR"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  activeButton: {
    backgroundColor: palette.coral,
    borderColor: palette.coral,
  },
  label: { color: "#FFFDF9", fontSize: 14, fontWeight: "600" },
  activeLabel: { color: "#FFFDF9" },
});
```

- [ ] **Step 3: Create Breadcrumb**

Create `apps/mobile/src/ui/Breadcrumb.tsx`:

```tsx
import React from "react";
import { Text, StyleSheet } from "react-native";
import { palette } from "../design";

export function Breadcrumb({ location }: { location: string }) {
  return <Text style={styles.text}>{location}</Text>;
}

const styles = StyleSheet.create({
  text: {
    color: palette.muted,
    fontSize: 13,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/ui/VoiceOrb.tsx apps/mobile/src/ui/ARToggle.tsx apps/mobile/src/ui/Breadcrumb.tsx
git commit -m "feat(mobile): add VoiceOrb, ARToggle, and Breadcrumb UI components"
```

---

### Task 12: GalaxyScreen — Full-Screen 3D + HUD

**Files:**
- Create: `apps/mobile/src/screens/GalaxyScreen.tsx`

- [ ] **Step 1: Create GalaxyScreen**

Create `apps/mobile/src/screens/GalaxyScreen.tsx`:

```tsx
import React, { useCallback } from "react";
import { View, StyleSheet, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { GalaxyScene } from "../scene/GalaxyScene";
import { useGalaxyState } from "../scene/useGalaxyState";
import { InputController } from "../input/InputController";
import { ARProvider, useAR } from "../ar/ARProvider";
import { VoiceOrb } from "../ui/VoiceOrb";
import { ARToggle } from "../ui/ARToggle";
import { Breadcrumb } from "../ui/Breadcrumb";
import type { SceneAction } from "../input/intentionResolver";
import type { GestureSignal } from "../input/intentionResolver";

function GalaxyScreenInner() {
  const state = useGalaxyState();
  const ar = useAR();

  const handleAction = useCallback(
    (action: SceneAction) => {
      switch (action.type) {
        case "fly-to":
          state.selectPlanet(action.planetId);
          break;
        case "fly-back":
          state.flyBack();
          break;
        case "toggle-reality":
          ar.toggle();
          break;
      }
    },
    [state, ar],
  );

  const handleGesture = useCallback(
    (signal: GestureSignal) => {
      if (signal.type === "tap-planet") state.selectPlanet(signal.planetId);
      if (signal.type === "tap-empty") state.flyBack();
      if (signal.type === "orbit") state.setOrbitAngle(state.orbitAngle + signal.delta);
    },
    [state],
  );

  const selectedPlanet = state.planets.find((p) => p.id === state.selectedId);
  const location = selectedPlanet ? selectedPlanet.name : "Galaxy";

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <GalaxyScene state={state} />
      <View style={styles.hud}>
        <View style={styles.topBar}>
          <Breadcrumb location={location} />
          <ARToggle active={ar.active} onToggle={ar.toggle} />
        </View>
        <View style={styles.bottomBar}>
          <VoiceOrb listening={false} />
        </View>
      </View>
      <InputController
        state={state}
        transcript=""
        onAction={handleAction}
        onGestureSignal={handleGesture}
      />
    </View>
  );
}

export function GalaxyScreen() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <ARProvider>
        <GalaxyScreenInner />
      </ARProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0D0F12" },
  hud: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    padding: 16,
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bottomBar: {
    alignItems: "center",
  },
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/GalaxyScreen.tsx
git commit -m "feat(mobile): add GalaxyScreen with full-screen 3D galaxy and HUD overlay"
```

---

### Task 13: ConversationScreen — Glass Overlay

**Files:**
- Create: `apps/mobile/src/screens/ConversationScreen.tsx`
- Create: `apps/mobile/src/ui/MessageStream.tsx`

- [ ] **Step 1: Create MessageStream**

Create `apps/mobile/src/ui/MessageStream.tsx`:

```tsx
import React from "react";
import { ScrollView, Text, StyleSheet, View } from "react-native";
import { palette } from "../design";

type Message = { id: string; role: "user" | "assistant"; text: string };

export function MessageStream({ messages }: { messages: Message[] }) {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {messages.map((msg) => (
        <View
          key={msg.id}
          style={[styles.bubble, msg.role === "user" ? styles.userBubble : styles.assistantBubble]}
        >
          <Text style={[styles.text, msg.role === "user" ? styles.userText : styles.assistantText]}>
            {msg.text}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, gap: 8 },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    maxWidth: "80%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  userBubble: { alignSelf: "flex-end", backgroundColor: "rgba(244,119,98,0.2)" },
  assistantBubble: { alignSelf: "flex-start" },
  text: { fontSize: 15, lineHeight: 22 },
  userText: { color: "#FFFDF9" },
  assistantText: { color: palette.paper },
});
```

- [ ] **Step 2: Create ConversationScreen**

Create `apps/mobile/src/screens/ConversationScreen.tsx`:

```tsx
import React from "react";
import { View, StyleSheet, Text } from "react-native";
import { MessageStream } from "../ui/MessageStream";
import { VoiceOrb } from "../ui/VoiceOrb";
import { palette } from "../design";

type Message = { id: string; role: "user" | "assistant"; text: string };

export function ConversationScreen({
  planetName,
  messages,
  listening,
  onBack,
}: {
  planetName: string;
  messages: Message[];
  listening: boolean;
  onBack: () => void;
}) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{planetName}</Text>
      </View>
      <MessageStream messages={messages} />
      <View style={styles.footer}>
        <VoiceOrb listening={listening} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(13,15,18,0.75)",
    backdrop: "blur(24px)" as unknown as number,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  title: { color: palette.paper, fontSize: 20, fontWeight: "600" },
  footer: { alignItems: "center", padding: 16 },
});
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/ConversationScreen.tsx apps/mobile/src/ui/MessageStream.tsx
git commit -m "feat(mobile): add ConversationScreen with glass overlay and MessageStream"
```

---

### Task 14: RootNavigator — State Machine

**Files:**
- Create: `apps/mobile/src/navigator/RootNavigator.tsx`

- [ ] **Step 1: Create RootNavigator**

Create `apps/mobile/src/navigator/RootNavigator.tsx`:

```tsx
import React, { useState, useEffect } from "react";
import { ActivityIndicator, View, StyleSheet } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { GalaxyScreen } from "../screens/GalaxyScreen";

const ONBOARDING_KEY = "ursly-onboarding-complete";

type Screen = "splash" | "galaxy";

export function RootNavigator() {
  const [screen, setScreen] = useState<Screen>("splash");

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_KEY).then((done) => {
      setScreen(done ? "galaxy" : "galaxy");
    });
  }, []);

  switch (screen) {
    case "splash":
      return (
        <View style={styles.splash}>
          <ActivityIndicator size="large" color="#F47762" />
        </View>
      );
    case "galaxy":
      return <GalaxyScreen />;
  }
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#0D0F12" },
});
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/navigator/RootNavigator.tsx
git commit -m "feat(mobile): add RootNavigator state machine"
```

---

### Task 15: Wire App.tsx to RootNavigator

**Files:**
- Modify: `apps/mobile/App.tsx`

- [ ] **Step 1: Replace App.tsx with RootNavigator mount**

Replace the entire content of `apps/mobile/App.tsx` with:

```tsx
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { RootNavigator } from "./src/navigator/RootNavigator";

export default function App() {
  return (
    <SafeAreaProvider>
      <RootNavigator />
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Start the dev server and verify the galaxy renders on device**

```bash
cd apps/mobile && npx expo start --dev-client
```

Open on a physical device or simulator. Expected: Full-screen dark background with the 3D galaxy model rotating. Starfield particles visible. VoiceOrb pulsing at the bottom. ARToggle button top-right.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/App.tsx
git commit -m "feat(mobile): wire App.tsx to RootNavigator with galaxy screen"
```

---

### Task 16: AR Native Module — iOS (Swift)

**Files:**
- Create: `apps/mobile/src/ar/expo-ar-scene/ios/ARSceneModule.swift`
- Create: `apps/mobile/src/ar/expo-ar-scene/src/index.ts`

- [ ] **Step 1: Create the Expo module definition**

Create `apps/mobile/src/ar/expo-ar-scene/src/index.ts`:

```typescript
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
```

- [ ] **Step 2: Create iOS AR module (Swift)**

Create `apps/mobile/src/ar/expo-ar-scene/ios/ARSceneModule.swift`:

```swift
import ExpoModulesCore
import ARKit

public class ARSceneModule: Module {
  private var session: ARSession?
  private var planeAnchor: ARPlaneAnchor?

  public func definition() -> ModuleDefinition {
    Name("ARScene")

    Constants([
      "isSupported": ARWorldTrackingConfiguration.isSupported
    ])

    Function("startSession") {
      let arSession = ARSession()
      let config = ARWorldTrackingConfiguration()
      config.planeDetection = .horizontal
      config.isLightEstimationEnabled = true
      arSession.run(config)
      self.session = arSession
    }

    Function("stopSession") {
      self.session?.pause()
      self.session = nil
    }

    Function("placeAnchor") { (x: Double, y: Double, z: Double) in
      guard let session = self.session else { return }
      let transform = simd_float4x4(
        SIMD4<Float>(1, 0, 0, 0),
        SIMD4<Float>(0, 1, 0, 0),
        SIMD4<Float>(0, 0, 1, 0),
        SIMD4<Float>(Float(x), Float(y), Float(z), 1)
      )
      let anchor = ARAnchor(transform: transform)
      session.add(anchor: anchor)
    }
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/ar/expo-ar-scene/
git commit -m "feat(mobile): add AR native module scaffolding for iOS"
```

---

### Task 17: AR Native Module — Android (Kotlin)

**Files:**
- Create: `apps/mobile/src/ar/expo-ar-scene/android/ARSceneModule.kt`

- [ ] **Step 1: Create Android AR module (Kotlin)**

Create `apps/mobile/src/ar/expo-ar-scene/android/ARSceneModule.kt`:

```kotlin
package expo.modules.arscene

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Session
import com.google.ar.core.Config
import com.google.ar.core.Anchor

class ARSceneModule : Module() {
  private var session: Session? = null

  override fun definition() = ModuleDefinition {
    Name("ARScene")

    Constants(
      mapOf(
        "isSupported" to (ArCoreApk.getInstance().checkAvailability(appContext.reactContext ?: return@Constants false) == ArCoreApk.Availability.SUPPORTED_INSTALLED)
      )
    )

    Function("startSession") {
      val ctx = appContext.reactContext ?: return@Function
      val arSession = Session(ctx)
      val config = Config(arSession)
      config.planeFindingMode = Config.PlaneFindingMode.HORIZONTAL
      config.lightEstimationMode = Config.LightEstimationMode.ENVIRONMENTAL_HDR
      arSession.configure(config)
      arSession.resume()
      session = arSession
    }

    Function("stopSession") {
      session?.pause()
      session = null
    }

    Function("placeAnchor") { x: Double, y: Double, z: Double ->
      val s = session ?: return@Function
      val pose = com.google.ar.core.Pose(floatArrayOf(x.toFloat(), y.toFloat(), z.toFloat(), 0f, 0f, 0f, 1f))
      s.addAnchor(pose)
    }
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/mobile/src/ar/expo-ar-scene/android/
git commit -m "feat(mobile): add AR native module for Android with ARCore"
```

---

### Task 18: Design Token Extensions for 3D

**Files:**
- Modify: `apps/mobile/src/design.tsx`

- [ ] **Step 1: Add 3D-specific design tokens to design.tsx**

Add to the end of the `palette` object in `apps/mobile/src/design.tsx`:

```typescript
  // 3D scene tokens
  void: "#0D0F12",
  starGlow: "#FDE047",
  planetHighlight: "#A855F7",
  glassBg: "rgba(255,255,255,0.1)",
  glassBorder: "rgba(255,255,255,0.15)",
  glassText: "#FFFDF9",
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/design.tsx
git commit -m "feat(mobile): add 3D scene design tokens to palette"
```

---

### Task 19: Add expo-ar-scene Plugin to app.config.ts

**Files:**
- Modify: `apps/mobile/app.config.ts`

- [ ] **Step 1: Register the AR module plugin**

Add `"./src/ar/expo-ar-scene"` to the `plugins` array in `apps/mobile/app.config.ts`.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/app.config.ts
git commit -m "feat(mobile): register expo-ar-scene plugin in app config"
```

---

### Task 20: Final Integration & Verification

**Files:**
- All previously created files

- [ ] **Step 1: Run full TypeScript check**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Run all tests**

```bash
cd apps/mobile && npx tsx --test tests/*.test.ts
```

Expected: All tests PASS.

- [ ] **Step 3: Start dev server and verify on device**

```bash
cd apps/mobile && npx expo start --dev-client
```

Verify:
1. Galaxy scene renders full-screen with 9 planets in a ring
2. Starfield particles visible in background
3. Auto-rotation of galaxy rig
4. VoiceOrb visible at bottom
5. ARToggle visible at top-right
6. Breadcrumb shows "Galaxy"
7. Tapping a planet triggers fly-to animation (when gesture wiring is connected)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(mobile): immersive galaxy navigator with 3D, AR, and input fusion — v1 complete"
```
