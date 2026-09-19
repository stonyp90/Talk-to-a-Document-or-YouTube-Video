# Mobile Immersive Galaxy — Design Spec

**Date:** 2026-09-19
**Status:** Approved for implementation
**Platforms:** iOS + Android (simultaneous)
**Stack:** Expo SDK 57, React Native 0.86, R3F/Native, Custom AR Module

## Vision

A mobile-first spatial experience where the phone is the interface. The user opens Ursly and enters a 3D galaxy — 9 planets orbiting in space, each one a document or conversation. They fly between planets by swiping, tap one to enter a conversation, and speak naturally. One tap switches to AR mode where the galaxy anchors to their real world.

The keyboard is obsolete. The user speaks, points, moves, and looks. The interface understands and acts.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| 3D engine | @react-three/fiber/native over expo-gl | Same declarative paradigm as web R3F, actively maintained (July 2026), works with Expo 57 |
| AR | Custom Expo module (ARKit + ARCore) | No existing RN AR library supports Expo 57 cleanly. Thin native bridge keeps R3F as sole renderer |
| Scope | Galaxy + voice + AR in v1 | Full vision from day one |
| Platforms | iOS + Android simultaneously | Expo + AR Foundation abstracts platform differences |
| Experience | Mobile-only vision | Not a web port. Designed around what only a phone can do |
| Reality | Dual reality | 3D world as home + AR mode with a tap. User chooses their reality |
| Navigation | Galaxy navigator | Existing sdlc-galaxy.glb (9 planets) is the navigation space |

## Architecture

```
┌─────────────────────────────────────────────┐
│  Reality Layer                               │
│  ┌──────────────────┐  ┌──────────────────┐ │
│  │  3D Mode          │  │  AR Mode          │ │
│  │  (R3F/Native)     │  │  (Camera + R3F)   │ │
│  │  Full-screen      │  │  Plane detection  │ │
│  │  galaxy scene     │  │  World-anchored   │ │
│  └────────┬─────────┘  └────────┬─────────┘ │
│           │    toggle            │            │
│           └───────┬──────────────┘            │
│                   ▼                           │
│  ┌─────────────────────────────────────────┐ │
│  │  Scene Engine (shared R3F Canvas)       │ │
│  │  - Galaxy renderer (GLB loader)         │ │
│  │  - Planet interaction (tap, gaze)       │ │
│  │  - Camera controller (orbit, fly-to)    │ │
│  │  - Particle field + lighting            │ │
│  └────────────────────┬────────────────────┘ │
│                       ▼                      │
│  ┌─────────────────────────────────────────┐ │
│  │  Input Layer (always active)            │ │
│  │  - Voice (WebRTC + speech recognition)  │ │
│  │  - Gesture (swipe, pinch, tap)          │ │
│  │  - Motion (gyroscope parallax)          │ │
│  │  - Gaze (face tracking -> look-to-select)│ │
│  └────────────────────┬────────────────────┘ │
│                       ▼                      │
│  ┌─────────────────────────────────────────┐ │
│  │  Domain Layer (@talk/core — shared)     │ │
│  │  - Voice commands, file system, chat    │ │
│  └─────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

### Key principles

1. **One Canvas, two realities.** The R3F Canvas renders the galaxy in both modes. In 3D mode, the background is a void/skybox. In AR mode, the camera feed sits behind the Canvas and the scene anchors to a detected plane. Same scene graph, different backdrop.

2. **Input is always active.** Voice, gesture, motion, and gaze run simultaneously regardless of which reality mode is on. The user speaks while looking at a planet while tilting their phone — all three inputs fuse into one intention.

3. **Monolith to modular split.** The current App.tsx (1748 lines) splits into focused modules: GalaxyScreen, ConversationScreen, AROverlay, InputController. Navigation is a simple state machine (same pattern, named modules instead of one file).

4. **Shared domain stays in @talk/core.** Voice command matching, file system, chat protocol — all stays in the shared package. The mobile app only adds native rendering and input.

## Scene Engine & Galaxy Navigation

### Scene graph

```
Canvas (full-screen, MSAA 4x)
├── Environment
│   ├── Starfield (particle system, 2000 points)
│   ├── Ambient light (soft void glow)
│   └── Point lights (per-planet accent colour)
├── Galaxy rig (auto-rotate, slow orbit)
│   ├── Planet 1 (GLB mesh + label + glow ring)
│   ├── Planet 2
│   ├── ...
│   └── Planet 9
└── HUD overlay (React Native views, not 3D)
    ├── Voice orb (pulsing when listening)
    ├── AR toggle (floating button)
    └── Breadcrumb (where you are)
```

### Planet interaction

- **Look-to-highlight:** Gyroscope parallax shifts the camera subtly as the user tilts the phone. A planet near screen centre glows brighter — gaze selection without eye tracking hardware.
- **Tap-to-fly:** Tap a planet and the camera animates (spring easing) to orbit it. The planet fills the view. This is the conversation entry.
- **Pinch-to-zoom:** Two fingers zoom the camera in/out of the galaxy.
- **Swipe-to-orbit:** One-finger drag rotates the galaxy rig.

### Fly-to animation

When the user taps a planet, the camera controller runs a spring-animated fly-to:

1. Camera pulls back slightly (zoom out 10%)
2. Camera arcs toward the target planet (Bezier path, not linear)
3. Camera settles into orbit around the planet (close enough to read its label)
4. Haptic feedback on arrival (selection impact)

The reverse (fly-back) returns to the full galaxy view.

### Conversation view

Once a planet is selected, the conversation UI appears as a glass overlay over the orbiting planet — not a separate screen. The planet stays visible and slowly rotating behind the conversation. Voice orb at the bottom, message stream above, all translucent over the 3D scene. The user never loses the sense of being in the galaxy.

### AR mode transition

Tap the AR toggle button:

1. Camera feed fades in behind the R3F Canvas (alpha: true)
2. Plane detection starts (horizontal surfaces)
3. A reticle appears on detected planes
4. Tap to place — the galaxy anchors to that point in world space
5. The user walks around it, leans in close, or zooms out

The galaxy rig's scale shrinks to fit a tabletop. Planets become tangible objects you can reach toward.

## AR Module (Custom Expo Module)

### Purpose

A thin native bridge that gives the JS layer two things: camera passthrough and plane detection. Everything else — all 3D rendering — stays in R3F/Native. The module does not render 3D; it provides the real-world backdrop and spatial anchoring.

### Native surface

```
expo-ar-scene (custom Expo module)
├── iOS (Swift)
│   ├── ARSCNView wrapper (ARKit)
│   ├── Plane detection -> horizontal planes
│   ├── Camera feed -> texture shared to GL context
│   └── Hit test -> world coordinates on tap
├── Android (Kotlin)
│   ├── ARSceneView wrapper (ARCore)
│   ├── Plane detection -> horizontal planes
│   ├── Camera feed -> texture shared to GL context
│   └── Hit test -> world coordinates on tap
└── JS API (TypeScript)
    ├── startAR() -> begins session, returns plane stream
    ├── stopAR() -> ends session, releases camera
    ├── placeAnchor(position) -> anchors scene to world point
    ├── onPlaneDetected(callback) -> streams detected planes
    └── onFrame(callback) -> camera pose for parallax alignment
```

### Integration with R3F

The R3F Canvas has `alpha: true` and `style={{ position: 'absolute' }}`. Behind it sits the AR camera view (native view, z-index below). When AR is active:

1. The AR module starts the camera + plane detection
2. Camera feed renders as a native view behind the GL surface
3. The R3F scene's background becomes transparent
4. Plane data flows to JS as `{ id, position, rotation, extent }` objects
5. A visual reticle (R3F mesh) follows the hit-test point
6. On tap, `placeAnchor()` locks the galaxy rig to that world position

### Why custom, not a library

No existing RN AR library supports both platforms cleanly on Expo 57. ViroReact is confirmed only to Expo 54 and locks you into its rendering pipeline. A thin custom module:

- Works with Expo 57 New Architecture (Fabric/TurboModules)
- Keeps R3F as the sole renderer
- Is approximately 300 lines Swift + 300 lines Kotlin — focused, not a framework
- Can be extended later (vertical planes, image tracking, body occlusion)

### Performance contract

- Camera feed runs on the GPU texture path — no CPU copy per frame
- Plane detection results throttle to 30Hz (planes don't change faster than the eye tracks)
- AR session pauses automatically when the app backgrounds (onPause/onResume lifecycle)
- Memory: AR session adds approximately 40MB (camera buffer + plane mesh)

## Input Layer — Voice, Gesture, Motion, Gaze Fusion

### Principle

Every input channel runs simultaneously. The user never switches modes. They speak while looking at a planet while tilting the phone. The input layer fuses all signals into a single intention and acts.

### Input channels

```
┌─────────────────────────────────────────────────┐
│  InputController (always active)                │
│                                                 │
│  ┌───────────┐  ┌───────────┐  ┌────────────┐  │
│  │  Voice     │  │  Gesture   │  │  Motion     │  │
│  │  WebRTC +  │  │  tap,      │  │  gyro +     │  │
│  │  speech    │  │  swipe,    │  │  accel      │  │
│  │  recog     │  │  pinch     │  │             │  │
│  └─────┬─────┘  └─────┬─────┘  └──────┬──────┘  │
│        │               │               │         │
│        └───────────┬───┴───────────────┘         │
│                    ▼                              │
│           ┌─────────────┐                        │
│           │  Intention   │                        │
│           │  Resolver    │                        │
│           └──────┬──────┘                        │
│                  ▼                                │
│           ┌─────────────┐                        │
│           │  Scene       │                        │
│           │  Action      │                        │
│           └─────────────┘                        │
└─────────────────────────────────────────────────┘
```

### Voice (existing, enhanced)

The current WebRTC + OpenAI Realtime pipeline stays. Speech recognition runs continuously while the user is in the galaxy. Voice commands map to scene actions:

| Spoken phrase | Scene action |
|---|---|
| "open [name]" | Fly to the matching planet |
| "summarize" | Start conversation with selected planet |
| "go back" | Fly back to galaxy overview |
| "next" / "previous" | Orbit to adjacent planet |
| "AR mode" / "3D mode" | Toggle reality |
| Free-form question | Send to conversation with current planet context |

Voice commands are matched via `@talk/core`'s `matchCommands` — same logic as web, shared across platforms.

### Gesture (existing, mapped to 3D)

`react-native-gesture-handler` already in the app. Gestures map to scene control:

| Gesture | Scene action |
|---|---|
| Single tap on planet | Fly-to that planet |
| Single tap on empty space | Fly back to overview |
| One-finger drag | Orbit rotate the galaxy |
| Two-finger pinch | Zoom camera in/out |
| Two-finger rotate | Tilt the galaxy plane |
| Long press on planet | Show planet detail preview (tooltip) |

### Motion (new — gyroscope parallax)

`expo-sensors` (Accelerometer + Gyroscope) provides device orientation. This drives two things:

1. **Parallax camera offset:** Tilting the phone shifts the camera position slightly (plus/minus 5 degrees on each axis). The galaxy appears to have depth — planets closer to the viewer move faster than distant ones. This is the "looking through a window" effect that makes spatial computing feel real.

2. **Gaze estimation:** Combined with face tracking (existing `faceTracking.ts`), device orientation determines where the user is looking on screen. A planet near the gaze point highlights. No eye-tracking hardware needed — the phone's front camera + motion sensors approximate gaze well enough for selection at this scale.

### Gaze (existing face tracking, repurposed)

The current `faceTracking.ts` detects face position via `expo-camera`. Instead of using this for a motion camera HUD (the current use), it feeds the InputController:

- Face position in camera frame -> estimated gaze point on screen
- Gaze point + gyroscope parallax -> which planet the user is looking at
- Dwell time (looking at a planet for >1.5s) -> auto-highlight that planet
- Gaze + voice ("open this") -> select the highlighted planet without touching the screen

### Intention Resolver

The resolver is a simple priority chain:

1. **Voice command matched?** Execute it immediately. Voice is explicit.
2. **Gesture detected?** Execute it. Gestures are deliberate.
3. **Gaze dwell + voice fragment?** Combine — gaze provides the target, voice provides the action.
4. **Motion only?** Passive — drives parallax but does not trigger actions.

No channel blocks another. The user can speak while swiping. The resolver processes each channel independently and acts on the strongest signal.

## File & Component Structure

### From monolith to modules

The current `App.tsx` (1748 lines) contains everything: onboarding, sign-in, voice, motion camera, file browser, conversation. It splits into a state-machine navigator with focused screen modules.

### File tree

```
apps/mobile/
├── App.tsx                          (entry — mounts RootNavigator)
├── src/
│   ├── navigator/
│   │   └── RootNavigator.tsx        (state machine: splash -> onboarding -> galaxy)
│   │
│   ├── screens/
│   │   ├── GalaxyScreen.tsx         (full-screen 3D galaxy + HUD overlay)
│   │   ├── ConversationScreen.tsx   (planet conversation — glass overlay)
│   │   ├── OnboardingScreen.tsx     (existing Onboarding, extracted)
│   │   └── SignInScreen.tsx         (existing SignIn, extracted)
│   │
│   ├── scene/
│   │   ├── GalaxyScene.tsx          (R3F Canvas + scene graph)
│   │   ├── Planet.tsx               (single planet: mesh + label + glow)
│   │   ├── Starfield.tsx            (particle system background)
│   │   ├── CameraController.tsx     (orbit, fly-to, zoom, parallax)
│   │   ├── ARAnchor.tsx             (plane reticle + world placement)
│   │   └── useGalaxyState.ts        (planet positions, selection, orbit angle)
│   │
│   ├── ar/
│   │   ├── ARSession.ts             (JS bridge to native AR module)
│   │   ├── ARProvider.tsx           (React context: AR state + controls)
│   │   └── expo-ar-scene/           (native Expo module)
│   │       ├── ios/ARSceneModule.swift
│   │       ├── android/ARSceneModule.kt
│   │       └── src/index.ts
│   │
│   ├── input/
│   │   ├── InputController.tsx      (fuses voice + gesture + motion + gaze)
│   │   ├── useVoiceInput.ts         (wraps existing voice.ts + speech recognition)
│   │   ├── useGestureInput.ts       (maps gestures to scene actions)
│   │   ├── useMotionInput.ts        (gyroscope parallax + gaze estimation)
│   │   └── useGazeInput.ts          (face tracking -> screen gaze point)
│   │
│   ├── ui/
│   │   ├── VoiceOrb.tsx             (pulsing orb — listening indicator)
│   │   ├── ARToggle.tsx             (floating 3D <-> AR switch)
│   │   ├── Breadcrumb.tsx           (current location in galaxy)
│   │   ├── MessageStream.tsx        (conversation messages, glass style)
│   │   └── PlanetTooltip.tsx        (long-press preview)
│   │
│   ├── design.tsx                   (existing — extended with 3D tokens)
│   ├── voice.ts                     (existing — unchanged)
│   ├── chat.ts                      (existing — unchanged)
│   ├── client.ts                    (existing — unchanged)
│   ├── i18n.ts                      (existing — unchanged)
│   ├── haptics.ts                   (existing — unchanged)
│   ├── faceTracking.ts              (existing — repurposed for gaze)
│   ├── bodyTracking.ts              (existing — kept for motion camera mode)
```

### State machine

```
splash -> onboarding -> sign-in -> galaxy <-> conversation
                                    ↕
                                  AR mode (overlay, not a screen)
```

AR mode is not a screen — it is an overlay state within GalaxyScreen. The user toggles it on/off while staying in the galaxy. No navigation transition, just a visual crossfade.

### Dependency flow

```
screens/ -> scene/ -> ar/
    |         |
  ui/      input/
    |         |
  design.tsx  voice.ts, faceTracking.ts, gesture-handler, expo-sensors
                |
            @talk/core
```

No circular dependencies. Each layer only imports from below it. The `scene/` layer knows nothing about voice or gestures — it receives actions from `input/` via props or context.

### Inventory

| Category | Files | Action |
|---|---|---|
| Keep as-is | voice.ts, chat.ts, client.ts, i18n.ts, haptics.ts, session.ts, pricing.ts | No changes |
| Extract from App.tsx | Onboarding -> OnboardingScreen, SignIn -> SignInScreen | Move + minor cleanup |
| Repurpose | faceTracking.ts | Add gaze estimation export alongside existing face detection |
| New: scene | GalaxyScene, Planet, Starfield, CameraController, ARAnchor, useGalaxyState | 6 new files |
| New: ar | ARSession, ARProvider, native module | 3 new files + native code |
| New: input | InputController, useVoiceInput, useGestureInput, useMotionInput, useGazeInput | 5 new files |
| New: ui | VoiceOrb, ARToggle, Breadcrumb, MessageStream, PlanetTooltip | 5 new files |
| New: navigator | RootNavigator | 1 new file |

Total: approximately 20 new files, 3000-4000 lines of new code + 600 lines native (Swift/Kotlin).

## Performance, Error Handling & Testing

### Performance targets

| Metric | Target | How |
|---|---|---|
| Galaxy scene load | <2s cold start | GLB preloaded during splash screen via `useGLTF.preload()` |
| Frame rate | 60fps on iPhone 13+ / Pixel 7+ | R3F with `frameloop="demand"` — only re-render on state change or animation |
| Fly-to animation | <800ms | Spring animation via `react-native-reanimated` driving R3F camera position |
| AR plane detection | <3s to first plane | ARKit/ARCore native — no JS overhead on detection loop |
| Memory ceiling | <250MB total | Texture compression (KTX2), dispose unused geometries, pause AR when in 3D mode |
| Battery | No background drain | All sensors + camera stop when app backgrounds via AppState listener |

### Rendering strategy

- **Demand-mode rendering:** The R3F loop does not run continuously. It renders on state change (planet selected, camera moved, orbit rotation) and during active animations. Idle galaxy = zero GPU frames.
- **LOD (level of detail):** Planets far from camera render with simpler geometry. Only the selected planet gets full detail.
- **Texture compression:** The GLB model's textures convert to KTX2/Basis format — 4-8x smaller than PNG, GPU-native decoding.
- **Particle budget:** Starfield capped at 2000 points. Each point is a single vertex — negligible GPU cost.

### Error handling

| Failure | User experience |
|---|---|
| GLB model fails to load | Fallback: render planets as procedural spheres with the same colour palette. Never show a blank screen. |
| AR not supported (old device) | AR toggle button hidden. 3D mode is the only reality. No error message — the feature simply is not offered. |
| Camera permission denied | Gaze input silently disabled. Voice + gesture still work. No modal. |
| Microphone permission denied | Voice orb shows a tap-to-enable prompt. Other inputs unaffected. |
| AR plane detection fails (no flat surface) | Reticle pulses gently, tooltip: "Point at a flat surface". User can tap to place manually. |
| Network failure during conversation | Glass overlay shows retry pill. Galaxy stays visible. Voice: "Check your connection and try again." |
| WebGL context lost | Auto-recreate context. If unrecoverable: fall back to a static screenshot of the galaxy with tappable planet overlays. |

### Testing strategy

| Layer | What | Tool |
|---|---|---|
| Domain logic | Voice command matching, file navigation, chat protocol | Jest — runs in @talk/core, shared with web |
| Input fusion | Intention resolver priority chain, gesture mapping | Jest + React Native Testing Library |
| Scene state | Planet selection, orbit angles, fly-to targets | Jest — useGalaxyState hook tested without rendering |
| AR bridge | Session lifecycle, plane parsing, anchor placement | Jest with mocked native module |
| Navigation | State machine transitions (splash -> galaxy -> conversation) | React Native Testing Library |
| Visual regression | Galaxy renders correctly, planet highlight, AR overlay | Manual on device + screenshot comparison |
| Performance | Frame rate, memory, load time | Xcode Instruments / Android Profiler — per-release |

### What we do not test

- R3F rendering internals (Three.js handles that)
- Native AR module internals (tested by running on device)
- Animation curves (visual, verified by eye)

## New Dependencies

| Package | Purpose |
|---|---|
| `three` | Three.js core (R3F peer dependency) |
| `@react-three/fiber` | Declarative 3D renderer (native target) |
| `expo-gl` | OpenGL ES context for R3F (included in Expo SDK) |
| `expo-sensors` | Accelerometer + gyroscope for parallax + gaze |
| `expo-asset` | GLB model bundling and loading |

## Implementation Order

1. **Install 3D dependencies** — three, @react-three/fiber, expo-gl, expo-sensors, expo-asset
2. **GalaxyScene renders** — load sdlc-galaxy.glb, full-screen R3F Canvas, auto-rotate
3. **Camera controller** — orbit, fly-to, pinch-to-zoom, swipe-to-orbit
4. **Planet interaction** — tap-to-select, fly-to animation, haptic feedback
5. **Conversation overlay** — glass panel over selected planet, voice + messages
6. **Input fusion** — InputController wiring voice, gesture, motion, gaze
7. **AR module** — native Expo module (Swift + Kotlin), plane detection, anchor placement
8. **AR integration** — camera passthrough, reticle, tap-to-place, scale-to-tabletop
9. **Modular split** — extract screens from App.tsx, RootNavigator state machine
10. **Polish** — starfield particles, per-planet lighting, demand-mode rendering, error fallbacks
