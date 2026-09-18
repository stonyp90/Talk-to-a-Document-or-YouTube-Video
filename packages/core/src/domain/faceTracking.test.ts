import { describe, expect, it } from "vitest";
import {
  createFaceReader,
  type FaceDetection,
  type FaceTrackingSettings,
} from "./faceTracking";

function detection(overrides: Partial<FaceDetection> = {}): FaceDetection {
  return {
    at: 1000,
    bounds: { x: 0.3, y: 0.2, width: 0.4, height: 0.5 },
    confidence: 0.95,
    landmarks: {
      leftEye: { x: 0.4, y: 0.35 },
      rightEye: { x: 0.6, y: 0.35 },
      noseTip: { x: 0.5, y: 0.45 },
      mouthLeft: { x: 0.42, y: 0.55 },
      mouthRight: { x: 0.58, y: 0.55 },
    },
    ...overrides,
  };
}

describe("face presence", () => {
  it("reports no face when detection is null", () => {
    const reader = createFaceReader();
    expect(reader.read(null).present).toBe(false);
  });

  it("reports a face when confidence is above threshold", () => {
    const reader = createFaceReader();
    expect(reader.read(detection()).present).toBe(true);
  });

  it("rejects low-confidence detections", () => {
    const reader = createFaceReader({ minConfidence: 0.8 });
    expect(reader.read(detection({ confidence: 0.5 })).present).toBe(false);
  });

  it("keeps face present for a few missed frames before losing it", () => {
    const reader = createFaceReader({ lostAfterFrames: 3 });
    reader.read(detection());
    expect(reader.read(null).present).toBe(true);
    expect(reader.read(null).present).toBe(true);
    expect(reader.read(null).present).toBe(false);
  });

  it("provides face position when present", () => {
    const reader = createFaceReader();
    const reading = reader.read(detection());
    expect(reading.position).toBeDefined();
    expect(reading.position!.x).toBeGreaterThan(0);
    expect(reading.position!.y).toBeGreaterThan(0);
  });
});

describe("eye tracking", () => {
  it("estimates eye openness for each eye", () => {
    const reader = createFaceReader();
    const reading = reader.read(detection());
    expect(reading.eyes).toBeDefined();
    expect(reading.eyes!.left.openness).toBeGreaterThan(0);
    expect(reading.eyes!.right.openness).toBeGreaterThan(0);
  });

  it("estimates gaze direction for each eye", () => {
    const reader = createFaceReader();
    const reading = reader.read(detection());
    expect(reading.eyes!.left.gazeX).toBeDefined();
    expect(reading.eyes!.left.gazeY).toBeDefined();
    expect(reading.eyes!.right.gazeX).toBeDefined();
    expect(reading.eyes!.right.gazeY).toBeDefined();
  });

  it("combines both eyes into a single gaze direction", () => {
    const reader = createFaceReader();
    const reading = reader.read(detection());
    expect(reading.gaze).toBeDefined();
    expect(reading.gaze!.x).toBeDefined();
    expect(reading.gaze!.y).toBeDefined();
  });
});

describe("blink detection", () => {
  it("detects a blink when both eyes close briefly", () => {
    const reader = createFaceReader({
      blinkThreshold: 0.3,
      blinkDurationMs: 100,
      blinkCooldownMs: 200,
    });

    const closedEyes = detection({
      landmarks: {
        leftEye: { x: 0.4, y: 0.44 },
        rightEye: { x: 0.6, y: 0.44 },
        noseTip: { x: 0.5, y: 0.45 },
        mouthLeft: { x: 0.42, y: 0.55 },
        mouthRight: { x: 0.58, y: 0.55 },
      },
    });

    reader.read(detection());
    expect(reader.read({ ...closedEyes, at: 1050 }).blinked).toBeFalsy();
    expect(reader.read({ ...closedEyes, at: 1150 }).blinked).toBe(true);
  });

  it("respects blink cooldown", () => {
    const reader = createFaceReader({
      blinkThreshold: 0.3,
      blinkDurationMs: 100,
      blinkCooldownMs: 500,
    });

    const closedEyes = detection({
      landmarks: {
        leftEye: { x: 0.4, y: 0.44 },
        rightEye: { x: 0.6, y: 0.44 },
        noseTip: { x: 0.5, y: 0.45 },
        mouthLeft: { x: 0.42, y: 0.55 },
        mouthRight: { x: 0.58, y: 0.55 },
      },
    });

    reader.read(detection());
    reader.read({ ...closedEyes, at: 1050 });
    expect(reader.read({ ...closedEyes, at: 1150 }).blinked).toBe(true);
    reader.read(detection({ at: 1200 }));
    reader.read({ ...closedEyes, at: 1300 });
    expect(reader.read({ ...closedEyes, at: 1400 }).blinked).toBeFalsy();
    reader.read(detection({ at: 1700 }));
    reader.read({ ...closedEyes, at: 1750 });
    expect(reader.read({ ...closedEyes, at: 1850 }).blinked).toBe(true);
  });

  it("does not blink when only one eye is closed", () => {
    const reader = createFaceReader({
      blinkThreshold: 0.3,
      blinkDurationMs: 100,
    });

    const oneEyeClosed = detection({
      landmarks: {
        leftEye: { x: 0.4, y: 0.44 },
        rightEye: { x: 0.6, y: 0.35 },
        noseTip: { x: 0.5, y: 0.45 },
        mouthLeft: { x: 0.42, y: 0.55 },
        mouthRight: { x: 0.58, y: 0.55 },
      },
    });

    reader.read(detection());
    expect(reader.read({ ...oneEyeClosed, at: 1200 }).blinked).toBeFalsy();
  });
});

describe("gaze tracking", () => {
  it("tracks gaze region", () => {
    const reader = createFaceReader({ gazeColumns: 3, gazeRows: 3 });
    reader.read(detection());
    const region = reader.currentGazeRegion();
    expect(region.x).toBeGreaterThanOrEqual(0);
    expect(region.x).toBeLessThan(3);
    expect(region.y).toBeGreaterThanOrEqual(0);
    expect(region.y).toBeLessThan(3);
  });

  it("reports when gaze is settled", () => {
    const reader = createFaceReader({ gazeDwellMs: 200 });
    reader.read(detection({ at: 1000 }));
    expect(reader.isGazeSettled(1100)).toBe(false);
    expect(reader.isGazeSettled(1250)).toBe(true);
  });

  it("resets dwell timer when gaze moves to new region", () => {
    const reader = createFaceReader({ gazeDwellMs: 200 });
    reader.read(detection({ at: 1000 }));

    const farRight = detection({
      at: 1100,
      landmarks: {
        leftEye: { x: 0.55, y: 0.35 },
        rightEye: { x: 0.75, y: 0.35 },
        noseTip: { x: 0.5, y: 0.45 },
        mouthLeft: { x: 0.42, y: 0.55 },
        mouthRight: { x: 0.58, y: 0.55 },
      },
    });
    reader.read(farRight);
    expect(reader.isGazeSettled(1200)).toBe(false);
    expect(reader.isGazeSettled(1350)).toBe(true);
  });
});

describe("configuration", () => {
  it("accepts custom settings", () => {
    const settings: FaceTrackingSettings = {
      minConfidence: 0.7,
      blinkThreshold: 0.2,
      gazeDwellMs: 300,
    };
    const reader = createFaceReader(settings);
    expect(reader.read(detection({ confidence: 0.6 })).present).toBe(false);
  });

  it("allows runtime configuration updates", () => {
    const reader = createFaceReader({ minConfidence: 0.5 });
    expect(reader.read(detection({ confidence: 0.6 })).present).toBe(true);

    reader.configure({ minConfidence: 0.8 });
    expect(reader.read(detection({ confidence: 0.6 })).present).toBe(false);
  });

  it("resets tracking state without losing configuration", () => {
    const reader = createFaceReader({ minConfidence: 0.8, lostAfterFrames: 2 });
    reader.read(detection({ confidence: 0.9 }));
    reader.reset();
    expect(reader.read(detection({ confidence: 0.9 })).present).toBe(true);
    // After the valid detection, low-confidence ones are rejected after grace period
    expect(reader.read(detection({ confidence: 0.6 })).present).toBe(true);
    expect(reader.read(detection({ confidence: 0.6 })).present).toBe(false);
    expect(reader.read(detection({ confidence: 0.6 })).present).toBe(false);
  });
});

describe("head pose", () => {
  it("passes through yaw when provided", () => {
    const reader = createFaceReader();
    const reading = reader.read(detection({ yaw: 15 }));
    expect(reading.headYaw).toBe(15);
  });

  it("leaves yaw undefined when not provided", () => {
    const reader = createFaceReader();
    const reading = reader.read(detection());
    expect(reading.headYaw).toBeUndefined();
  });
});
