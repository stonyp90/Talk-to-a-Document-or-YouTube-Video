/**
 * Full body pose tracking and movement analysis.
 *
 * Tracks 17+ body joints (pose landmarks) to understand the person's full body
 * movement, not just face or coarse motion. This enables:
 * - Full body gesture recognition (wave, point, reach, crouch, jump, etc.)
 * - Movement pattern learning (AI learns the person's typical movements)
 * - Immersive AR/VR interaction (body as controller)
 * - Accessibility (body movements as input for users who can't use hands)
 *
 * The adapter provides pose landmarks; this module interprets them into
 * meaningful body readings and gestures.
 */

export type Point2D = { x: number; y: number };

export type Point3D = { x: number; y: number; z: number };

/**
 * Standard COCO pose landmarks (17 joints).
 * See: https://cocodataset.org/#keypoints-2020
 */
export type PoseLandmarks = {
  // Head
  nose: Point3D;
  leftEye: Point3D;
  rightEye: Point3D;
  leftEar: Point3D;
  rightEar: Point3D;
  // Upper body
  leftShoulder: Point3D;
  rightShoulder: Point3D;
  leftElbow: Point3D;
  rightElbow: Point3D;
  leftWrist: Point3D;
  rightWrist: Point3D;
  // Lower body
  leftHip: Point3D;
  rightHip: Point3D;
  leftKnee: Point3D;
  rightKnee: Point3D;
  leftAnkle: Point3D;
  rightAnkle: Point3D;
};

export type PoseDetection = {
  /** When the detection was made, in milliseconds on a monotonic clock. */
  at: number;
  /** Bounding box of the person, 0-1 across and down the frame. */
  bounds: { x: number; y: number; width: number; height: number };
  /** Confidence 0-1 from the detector. */
  confidence: number;
  /** All 17 pose landmarks. */
  landmarks: PoseLandmarks;
  /** Per-landmark confidence 0-1. */
  landmarkConfidence: Partial<Record<keyof PoseLandmarks, number>>;
};

export type BodyPart =
  | "head"
  | "leftArm"
  | "rightArm"
  | "leftHand"
  | "rightHand"
  | "torso"
  | "leftLeg"
  | "rightLeg"
  | "leftFoot"
  | "rightFoot";

export type BodyReading = {
  /** True if a person was detected. */
  present: boolean;
  /** Center of the person, 0-1 across and down. */
  position?: Point2D;
  /** Overall body orientation (facing left/right/forward). */
  orientation?: "left" | "right" | "forward";
  /** Which body parts are moving significantly. */
  movingParts?: BodyPart[];
  /** Overall movement energy 0-1. */
  energy?: number;
  /** Detected body gesture (if any). */
  gesture?: BodyGestureId;
  /** Pose classification (standing, sitting, crouching, etc.). */
  pose?: PoseClass;
};

export type BodyGestureId =
  | "wave"
  | "point"
  | "reach"
  | "crouch"
  | "jump"
  | "stepForward"
  | "stepBack"
  | "armsUp"
  | "armsDown"
  | "leanLeft"
  | "leanRight"
  | "nod"
  | "shake";

export const BODY_GESTURES: readonly BodyGestureId[] = [
  "wave",
  "point",
  "reach",
  "crouch",
  "jump",
  "stepForward",
  "stepBack",
  "armsUp",
  "armsDown",
  "leanLeft",
  "leanRight",
  "nod",
  "shake",
];

export type PoseClass =
  | "standing"
  | "sitting"
  | "crouching"
  | "lying"
  | "walking"
  | "running";

export type BodyTrackingSettings = {
  /** Minimum detector confidence to accept a pose, 0-1. */
  minConfidence?: number;
  /** Movement threshold for a body part to be considered moving, in meters. */
  movementThreshold?: number;
  /** How long a gesture must be held to be recognized, in ms. */
  gestureDurationMs?: number;
  /** Quiet time after a gesture before another is accepted, in ms. */
  gestureCooldownMs?: number;
  /** How many frames without detection before person is considered lost. */
  lostAfterFrames?: number;
  /** Enable AI learning of movement patterns. */
  enableLearning?: boolean;
};

const DEFAULTS = {
  minConfidence: 0.5,
  movementThreshold: 0.05,
  gestureDurationMs: 500,
  gestureCooldownMs: 1000,
  lostAfterFrames: 10,
  enableLearning: true,
} satisfies Required<BodyTrackingSettings>;

type BodyPartPosition = {
  part: BodyPart;
  position: Point3D;
  velocity: Point3D;
};

type GestureStroke = {
  gesture: BodyGestureId;
  startedAt: number;
  positions: BodyPartPosition[];
};

/**
 * Calculates the angle between three points (in degrees).
 */
function angleBetween(a: Point3D, b: Point3D, c: Point3D): number {
  const ab = { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
  const cb = { x: b.x - c.x, y: b.y - c.y, z: b.z - c.z };
  const dot = ab.x * cb.x + ab.y * cb.y + ab.z * cb.z;
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2 + ab.z ** 2);
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2 + cb.z ** 2);
  if (magAB === 0 || magCB === 0) return 0;
  const cosAngle = dot / (magAB * magCB);
  return Math.acos(Math.max(-1, Math.min(1, cosAngle))) * (180 / Math.PI);
}

/**
 * Calculates distance between two 3D points.
 */
function distance3D(a: Point3D, b: Point3D): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2);
}

/**
 * Reads full body pose from camera frames and interprets movements.
 */
export function createBodyReader(settings: BodyTrackingSettings = {}) {
  const config = { ...DEFAULTS, ...settings };
  let previous: PoseDetection | undefined;
  let lostFrames = 0;
  let gestureStroke: GestureStroke | undefined;
  let lastGestureAt = 0;
  /** Learned movement patterns for this person. */
  const movementPatterns: Map<string, number[]> = new Map();

  function getBodyPartPositions(landmarks: PoseLandmarks): BodyPartPosition[] {
    const now = performance.now();
    const prev = previous?.landmarks;

    const calculateVelocity = (current: Point3D, prev?: Point3D): Point3D => {
      if (!prev) return { x: 0, y: 0, z: 0 };
      const dt = previous ? (now - previous.at) / 1000 : 1;
      return {
        x: (current.x - prev.x) / dt,
        y: (current.y - prev.y) / dt,
        z: (current.z - prev.z) / dt,
      };
    };

    return [
      { part: "head", position: landmarks.nose, velocity: calculateVelocity(landmarks.nose, prev?.nose) },
      { part: "leftArm", position: landmarks.leftShoulder, velocity: calculateVelocity(landmarks.leftShoulder, prev?.leftShoulder) },
      { part: "rightArm", position: landmarks.rightShoulder, velocity: calculateVelocity(landmarks.rightShoulder, prev?.rightShoulder) },
      { part: "leftHand", position: landmarks.leftWrist, velocity: calculateVelocity(landmarks.leftWrist, prev?.leftWrist) },
      { part: "rightHand", position: landmarks.rightWrist, velocity: calculateVelocity(landmarks.rightWrist, prev?.rightWrist) },
      { part: "torso", position: { x: (landmarks.leftHip.x + landmarks.rightHip.x) / 2, y: (landmarks.leftHip.y + landmarks.rightHip.y) / 2, z: (landmarks.leftHip.z + landmarks.rightHip.z) / 2 }, velocity: { x: 0, y: 0, z: 0 } },
      { part: "leftLeg", position: landmarks.leftHip, velocity: calculateVelocity(landmarks.leftHip, prev?.leftHip) },
      { part: "rightLeg", position: landmarks.rightHip, velocity: calculateVelocity(landmarks.rightHip, prev?.rightHip) },
      { part: "leftFoot", position: landmarks.leftAnkle, velocity: calculateVelocity(landmarks.leftAnkle, prev?.leftAnkle) },
      { part: "rightFoot", position: landmarks.rightAnkle, velocity: calculateVelocity(landmarks.rightAnkle, prev?.rightAnkle) },
    ];
  }

  function detectMovingParts(positions: BodyPartPosition[]): BodyPart[] {
    return positions
      .filter((p) => {
        const speed = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2 + p.velocity.z ** 2);
        return speed > config.movementThreshold;
      })
      .map((p) => p.part);
  }

  function classifyPose(landmarks: PoseLandmarks): PoseClass {
    const hipHeight = (landmarks.leftHip.y + landmarks.rightHip.y) / 2;
    const kneeHeight = (landmarks.leftKnee.y + landmarks.rightKnee.y) / 2;
    const ankleHeight = (landmarks.leftAnkle.y + landmarks.rightAnkle.y) / 2;
    const shoulderHeight = (landmarks.leftShoulder.y + landmarks.rightShoulder.y) / 2;

    // Crouching: knees bent significantly
    const kneeAngle = angleBetween(landmarks.leftHip, landmarks.leftKnee, landmarks.leftAnkle);
    if (kneeAngle < 90) return "crouching";

    // Sitting: hips low, knees bent
    if (hipHeight > 0.6 && kneeAngle < 120) return "sitting";

    // Lying: body is horizontal
    if (Math.abs(shoulderHeight - hipHeight) < 0.1) return "lying";

    // Default: standing
    return "standing";
  }

  function detectGesture(positions: BodyPartPosition[], landmarks: PoseLandmarks): BodyGestureId | undefined {
    const now = performance.now();

    // Wave: hand moving side to side above shoulder height
    const leftHand = positions.find((p) => p.part === "leftHand");
    const rightHand = positions.find((p) => p.part === "rightHand");
    const leftShoulder = positions.find((p) => p.part === "leftArm");
    const rightShoulder = positions.find((p) => p.part === "rightArm");

    if (leftHand && leftShoulder && leftHand.position.y < leftShoulder.position.y) {
      if (Math.abs(leftHand.velocity.x) > 0.5) return "wave";
    }
    if (rightHand && rightShoulder && rightHand.position.y < rightShoulder.position.y) {
      if (Math.abs(rightHand.velocity.x) > 0.5) return "wave";
    }

    // Point: arm extended forward
    if (leftHand && leftShoulder && distance3D(leftHand.position, leftShoulder.position) > 0.4) {
      return "point";
    }
    if (rightHand && rightShoulder && distance3D(rightHand.position, rightShoulder.position) > 0.4) {
      return "point";
    }

    // Arms up: both hands above head
    const nose = positions.find((p) => p.part === "head");
    if (leftHand && rightHand && nose && leftHand.position.y < nose.position.y && rightHand.position.y < nose.position.y) {
      return "armsUp";
    }

    // Arms down: both hands below waist
    const hip = positions.find((p) => p.part === "torso");
    if (leftHand && rightHand && hip && leftHand.position.y > hip.position.y && rightHand.position.y > hip.position.y) {
      return "armsDown";
    }

    // Crouch: detected by pose classification
    const pose = classifyPose(landmarks);
    if (pose === "crouching") return "crouch";

    // Jump: rapid upward movement
    if (positions.some((p) => p.velocity.y < -1.0)) return "jump";

    // Lean left/right: torso tilted
    const torso = positions.find((p) => p.part === "torso");
    if (torso && Math.abs(torso.velocity.x) > 0.3) {
      return torso.velocity.x < 0 ? "leanLeft" : "leanRight";
    }

    // Nod: head moving up and down
    if (nose && Math.abs(nose.velocity.y) > 0.3) return "nod";

    // Shake: head moving side to side
    if (nose && Math.abs(nose.velocity.x) > 0.3) return "shake";

    return undefined;
  }

  function learnMovement(positions: BodyPartPosition[]): void {
    if (!config.enableLearning) return;

    // Store movement pattern for each body part
    positions.forEach((p) => {
      const key = p.part;
      const pattern = movementPatterns.get(key) || [];
      pattern.push(Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2 + p.velocity.z ** 2));
      // Keep last 100 samples
      if (pattern.length > 100) pattern.shift();
      movementPatterns.set(key, pattern);
    });
  }

  return {
    /** Forgets the camera without forgetting how it is configured. */
    reset(): void {
      previous = undefined;
      lostFrames = 0;
      gestureStroke = undefined;
      lastGestureAt = 0;
    },

    /** Get learned movement patterns. */
    getLearnedPatterns(): Map<string, number[]> {
      return movementPatterns;
    },

    read(detection: PoseDetection): BodyReading {
      // Check confidence
      if (detection.confidence < config.minConfidence) {
        lostFrames++;
        if (lostFrames >= config.lostAfterFrames) {
          previous = undefined;
        }
        return { present: false };
      }

      lostFrames = 0;
      const positions = getBodyPartPositions(detection.landmarks);
      const movingParts = detectMovingParts(positions);
      const pose = classifyPose(detection.landmarks);

      // Calculate overall energy
      const totalMovement = positions.reduce((sum, p) => {
        const speed = Math.sqrt(p.velocity.x ** 2 + p.velocity.y ** 2 + p.velocity.z ** 2);
        return sum + speed;
      }, 0);
      const energy = Math.min(1, totalMovement / (positions.length * 2));

      // Detect gesture
      const gesture = detectGesture(positions, detection.landmarks);
      const now = performance.now();
      let finalGesture: BodyGestureId | undefined;

      if (gesture && now - lastGestureAt > config.gestureCooldownMs) {
        if (!gestureStroke) {
          gestureStroke = { gesture, startedAt: now, positions: [] };
        }
        gestureStroke.positions.push(...positions);

        if (now - gestureStroke.startedAt >= config.gestureDurationMs) {
          finalGesture = gesture;
          lastGestureAt = now;
          gestureStroke = undefined;
        }
      } else {
        gestureStroke = undefined;
      }

      // Learn from this movement
      learnMovement(positions);

      previous = detection;

      return {
        present: true,
        position: {
          x: detection.bounds.x + detection.bounds.width / 2,
          y: detection.bounds.y + detection.bounds.height / 2,
        },
        orientation: detection.landmarks.leftShoulder.x < detection.landmarks.rightShoulder.x ? "forward" : "left",
        movingParts,
        energy,
        gesture: finalGesture,
        pose,
      };
    },
  };
}
