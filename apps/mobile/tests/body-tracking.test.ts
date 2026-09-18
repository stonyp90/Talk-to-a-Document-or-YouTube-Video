import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createBodyReader,
  BODY_GESTURES,
  type PoseDetection,
  type PoseLandmarks,
} from "../../../packages/core/src/domain/bodyTracking";

function makeLandmarks(overrides: Partial<PoseLandmarks> = {}): PoseLandmarks {
  return {
    nose: { x: 0.5, y: 0.2, z: 0 },
    leftEye: { x: 0.47, y: 0.18, z: 0.02 },
    rightEye: { x: 0.53, y: 0.18, z: 0.02 },
    leftEar: { x: 0.43, y: 0.19, z: -0.01 },
    rightEar: { x: 0.57, y: 0.19, z: -0.01 },
    leftShoulder: { x: 0.35, y: 0.35, z: 0 },
    rightShoulder: { x: 0.65, y: 0.35, z: 0 },
    leftElbow: { x: 0.25, y: 0.5, z: 0.05 },
    rightElbow: { x: 0.75, y: 0.5, z: 0.05 },
    leftWrist: { x: 0.2, y: 0.65, z: 0.08 },
    rightWrist: { x: 0.8, y: 0.65, z: 0.08 },
    leftHip: { x: 0.4, y: 0.6, z: 0 },
    rightHip: { x: 0.6, y: 0.6, z: 0 },
    leftKnee: { x: 0.4, y: 0.78, z: 0.03 },
    rightKnee: { x: 0.6, y: 0.78, z: 0.03 },
    leftAnkle: { x: 0.4, y: 0.95, z: 0.02 },
    rightAnkle: { x: 0.6, y: 0.95, z: 0.02 },
    ...overrides,
  };
}

function makeDetection(overrides: Partial<PoseDetection> = {}): PoseDetection {
  return {
    at: Date.now(),
    bounds: { x: 0.3, y: 0.1, width: 0.4, height: 0.8 },
    confidence: 0.9,
    landmarks: makeLandmarks(),
    landmarkConfidence: {},
    ...overrides,
  };
}

test("body reader returns present: true for a confident detection", () => {
  const reader = createBodyReader();
  const reading = reader.read(makeDetection());
  assert.equal(reading.present, true);
  assert.ok(reading.position);
  assert.ok(reading.position.x > 0);
  assert.ok(reading.position.y > 0);
});

test("body reader returns present: false for low confidence", () => {
  const reader = createBodyReader({ minConfidence: 0.8 });
  const reading = reader.read(makeDetection({ confidence: 0.3 }));
  assert.equal(reading.present, false);
});

test("body reader classifies standing pose when hips are above knees", () => {
  const reader = createBodyReader();
  const reading = reader.read(makeDetection());
  assert.equal(reading.pose, "standing");
});

test("body reader classifies crouching when knee angle is sharp", () => {
  const reader = createBodyReader();
  const reading = reader.read(
    makeDetection({
      landmarks: makeLandmarks({
        leftHip: { x: 0.4, y: 0.5, z: 0 },
        leftKnee: { x: 0.35, y: 0.65, z: 0.03 },
        leftAnkle: { x: 0.45, y: 0.55, z: 0.02 },
        rightHip: { x: 0.6, y: 0.5, z: 0 },
        rightKnee: { x: 0.65, y: 0.65, z: 0.03 },
        rightAnkle: { x: 0.55, y: 0.55, z: 0.02 },
      }),
    }),
  );
  assert.equal(reading.pose, "crouching");
});

test("body reader detects forward orientation from shoulder positions", () => {
  const reader = createBodyReader();
  const reading = reader.read(makeDetection());
  assert.equal(reading.orientation, "forward");
});

test("body reader resets state correctly", () => {
  const reader = createBodyReader();
  reader.read(makeDetection());
  reader.reset();
  const reading = reader.read(makeDetection());
  assert.equal(reading.present, true);
});

test("body reader learns movement patterns when enabled", () => {
  const reader = createBodyReader({ enableLearning: true });
  for (let i = 0; i < 5; i++) {
    reader.read(
      makeDetection({
        at: Date.now() + i * 100,
        landmarks: makeLandmarks({
          nose: { x: 0.5 + i * 0.01, y: 0.2, z: 0 },
        }),
      }),
    );
  }
  const patterns = reader.getLearnedPatterns();
  assert.ok(patterns.size > 0);
});

test("body reader does not learn when disabled", () => {
  const reader = createBodyReader({ enableLearning: false });
  reader.read(makeDetection());
  const patterns = reader.getLearnedPatterns();
  assert.equal(patterns.size, 0);
});

test("body reader loses person after enough low-confidence frames", () => {
  const reader = createBodyReader({ lostAfterFrames: 3 });
  reader.read(makeDetection());
  for (let i = 0; i < 3; i++) {
    reader.read(makeDetection({ confidence: 0.1 }));
  }
  const reading = reader.read(makeDetection({ confidence: 0.1 }));
  assert.equal(reading.present, false);
});

test("BODY_GESTURES includes all expected gesture types", () => {
  assert.ok(BODY_GESTURES.includes("wave"));
  assert.ok(BODY_GESTURES.includes("point"));
  assert.ok(BODY_GESTURES.includes("reach"));
  assert.ok(BODY_GESTURES.includes("crouch"));
  assert.ok(BODY_GESTURES.includes("jump"));
  assert.ok(BODY_GESTURES.includes("armsUp"));
  assert.ok(BODY_GESTURES.includes("armsDown"));
  assert.ok(BODY_GESTURES.includes("nod"));
  assert.ok(BODY_GESTURES.includes("shake"));
  assert.ok(BODY_GESTURES.includes("leanLeft"));
  assert.ok(BODY_GESTURES.includes("leanRight"));
  assert.ok(BODY_GESTURES.includes("stepForward"));
  assert.ok(BODY_GESTURES.includes("stepBack"));
});

test("BODY_GESTURES has 13 gesture types", () => {
  assert.equal(BODY_GESTURES.length, 13);
});

test("body reader calculates energy from movement", () => {
  const reader = createBodyReader();
  // First detection establishes baseline
  reader.read(makeDetection({ at: 0 }));
  // Second detection with movement
  const reading = reader.read(
    makeDetection({
      at: 100,
      landmarks: makeLandmarks({
        nose: { x: 0.6, y: 0.25, z: 0 },
        leftWrist: { x: 0.3, y: 0.5, z: 0.08 },
        rightWrist: { x: 0.9, y: 0.5, z: 0.08 },
      }),
    }),
  );
  assert.equal(reading.present, true);
  assert.ok(reading.energy !== undefined);
  assert.ok(reading.energy >= 0);
  assert.ok(reading.energy <= 1);
});

test("body reader tracks moving body parts", () => {
  const reader = createBodyReader({ movementThreshold: 0.01 });
  reader.read(makeDetection({ at: 0 }));
  const reading = reader.read(
    makeDetection({
      at: 100,
      landmarks: makeLandmarks({
        nose: { x: 0.55, y: 0.22, z: 0 },
      }),
    }),
  );
  assert.equal(reading.present, true);
  assert.ok(reading.movingParts !== undefined);
});
