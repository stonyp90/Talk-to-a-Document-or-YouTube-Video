/**
 * Reading a face in front of a camera.
 *
 * A face is the richest signal a person can give without speaking: where they
 * are looking, whether they blinked, how their head is tilted. Each of those is
 * a question the adapter answers frame by frame, and this module decides what
 * the answers mean. The adapter hands over landmarks — points on the face — and
 * this module turns them into intent.
 *
 * No model lives here. The adapter picks the detector; this module only reads
 * the points it is given. Swap the detector, keep the logic.
 */

export type Point2D = { x: number; y: number };

export type FaceLandmarks = {
  leftEye: Point2D;
  rightEye: Point2D;
  noseTip: Point2D;
  mouthLeft: Point2D;
  mouthRight: Point2D;
  /** Optional ear positions for head pose estimation. */
  leftEar?: Point2D;
  rightEar?: Point2D;
};

export type FaceDetection = {
  /** When the detection was made, in milliseconds on a monotonic clock. */
  at: number;
  /** Bounding box of the face, 0-1 across and down the frame. */
  bounds: { x: number; y: number; width: number; height: number };
  /** Confidence 0-1 from the detector. */
  confidence: number;
  /** Key points on the face. */
  landmarks: FaceLandmarks;
  /** Estimated head rotation in degrees, positive = turned right. */
  yaw?: number;
  /** Estimated head tilt in degrees, positive = tilted right. */
  roll?: number;
};

export type EyeState = {
  /** How open the eye is, 0 (closed) to 1 (fully open). */
  openness: number;
  /** Where the pupil is relative to the eye center, -1 to 1. */
  gazeX: number;
  gazeY: number;
};

export type FaceReading = {
  /** True if a face was detected. */
  present: boolean;
  /** Where the face is, 0-1 across and down. */
  position?: Point2D;
  /** State of each eye. */
  eyes?: { left: EyeState; right: EyeState };
  /** Combined gaze direction, -1 to 1. */
  gaze?: Point2D;
  /** True during the frame a blink completes. */
  blinked?: boolean;
  /** Head yaw in degrees if estimable. */
  headYaw?: number;
};

export type FaceTrackingSettings = {
  /** Minimum detector confidence to accept a face, 0-1. */
  minConfidence?: number;
  /** Eye openness below which the eye is considered closed, 0-1. */
  blinkThreshold?: number;
  /** How long both eyes must be closed to count as a blink, in ms. */
  blinkDurationMs?: number;
  /** Quiet time after a blink before another is accepted, in ms. */
  blinkCooldownMs?: number;
  /** Gaze must stay in one region this long to count as dwelling, in ms. */
  gazeDwellMs?: number;
  /** How many gaze regions across the screen (horizontal). */
  gazeColumns?: number;
  /** How many gaze regions across the screen (vertical). */
  gazeRows?: number;
  /** Minimum face size relative to frame to accept, 0-1. */
  minFaceSize?: number;
  /** Maximum face size relative to frame to accept, 0-1. */
  maxFaceSize?: number;
  /** How many frames without detection before face is considered lost. */
  lostAfterFrames?: number;
};

const DEFAULTS = {
  minConfidence: 0.6,
  blinkThreshold: 0.25,
  blinkDurationMs: 120,
  blinkCooldownMs: 400,
  gazeDwellMs: 500,
  gazeColumns: 3,
  gazeRows: 3,
  minFaceSize: 0.08,
  maxFaceSize: 0.9,
  lostAfterFrames: 5,
} satisfies Required<FaceTrackingSettings>;

/**
 * Estimates eye openness from landmarks. Uses the vertical distance from the
 * expected eye position (above nose) to detect when eyes close.
 */
function estimateEyeOpenness(
  eyeCenter: Point2D,
  noseTip: Point2D,
  faceWidth: number,
): number {
  const expectedEyeY = noseTip.y - faceWidth * 0.25;
  const verticalDistance = noseTip.y - eyeCenter.y;
  const expectedDistance = faceWidth * 0.25;
  const ratio = verticalDistance / Math.max(expectedDistance, 0.001);
  return Math.min(1, Math.max(0, ratio));
}

/**
 * Estimates gaze direction from eye position relative to face center.
 * Returns -1 to 1 for each axis.
 */
function estimateGaze(
  eyeCenter: Point2D,
  faceCenter: Point2D,
  faceWidth: number,
): Point2D {
  const dx = (eyeCenter.x - faceCenter.x) / Math.max(faceWidth, 0.001);
  const dy = (eyeCenter.y - faceCenter.y) / Math.max(faceWidth, 0.001);
  return {
    x: Math.min(1, Math.max(-1, dx * 4)),
    y: Math.min(1, Math.max(-1, dy * 4)),
  };
}

/**
 * Reads faces from an adapter that provides detections frame by frame.
 * Tracks blinks, gaze direction, and face presence over time.
 */
export function createFaceReader(settings: FaceTrackingSettings = {}) {
  const config: Required<FaceTrackingSettings> = { ...DEFAULTS, ...settings };
  let lastFaceAt = 0;
  let missedFrames = 0;
  let eyesClosedSince = 0;
  let lastBlinkAt = 0;
  let gazeRegion = { x: -1, y: -1 };
  let gazeDwellStart = 0;

  function toGazeRegion(gaze: Point2D): { x: number; y: number } {
    const col = Math.floor(((gaze.x + 1) / 2) * config.gazeColumns);
    const row = Math.floor(((gaze.y + 1) / 2) * config.gazeRows);
    return {
      x: Math.min(config.gazeColumns - 1, Math.max(0, col)),
      y: Math.min(config.gazeRows - 1, Math.max(0, row)),
    };
  }

  return {
    /** Updates configuration at runtime and resets tracking state. */
    configure(patch: FaceTrackingSettings): void {
      Object.assign(config, patch);
      this.reset();
    },

    /** Forgets tracking state without forgetting configuration. */
    reset(): void {
      lastFaceAt = 0;
      missedFrames = 0;
      eyesClosedSince = 0;
      lastBlinkAt = 0;
      gazeRegion = { x: -1, y: -1 };
      gazeDwellStart = 0;
    },

    read(detection: FaceDetection | null): FaceReading {
      if (!detection || detection.confidence < config.minConfidence) {
        missedFrames++;
        if (missedFrames >= config.lostAfterFrames || lastFaceAt === 0) {
          return { present: false };
        }
        return { present: true };
      }

      missedFrames = 0;
      lastFaceAt = detection.at;

      const { landmarks, bounds } = detection;
      const faceCenter: Point2D = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      };
      const faceWidth = bounds.width;

      const leftOpenness = estimateEyeOpenness(
        landmarks.leftEye,
        landmarks.noseTip,
        faceWidth,
      );
      const rightOpenness = estimateEyeOpenness(
        landmarks.rightEye,
        landmarks.noseTip,
        faceWidth,
      );

      const leftGaze = estimateGaze(landmarks.leftEye, faceCenter, faceWidth);
      const rightGaze = estimateGaze(landmarks.rightEye, faceCenter, faceWidth);
      const gaze: Point2D = {
        x: (leftGaze.x + rightGaze.x) / 2,
        y: (leftGaze.y + rightGaze.y) / 2,
      };

      const bothClosed =
        leftOpenness < config.blinkThreshold &&
        rightOpenness < config.blinkThreshold;
      let blinked = false;

      if (bothClosed) {
        if (eyesClosedSince === 0) {
          // Only start tracking eye closure if we're not in cooldown
          if (detection.at - lastBlinkAt >= config.blinkCooldownMs) {
            eyesClosedSince = detection.at;
          }
        } else if (
          detection.at - eyesClosedSince >= config.blinkDurationMs &&
          detection.at - lastBlinkAt >= config.blinkCooldownMs
        ) {
          blinked = true;
          lastBlinkAt = detection.at;
          eyesClosedSince = 0;
        }
      } else {
        eyesClosedSince = 0;
      }

      const region = toGazeRegion(gaze);
      if (region.x !== gazeRegion.x || region.y !== gazeRegion.y) {
        gazeRegion = region;
        gazeDwellStart = detection.at;
      }

      return {
        present: true,
        position: faceCenter,
        eyes: {
          left: { openness: leftOpenness, gazeX: leftGaze.x, gazeY: leftGaze.y },
          right: {
            openness: rightOpenness,
            gazeX: rightGaze.x,
            gazeY: rightGaze.y,
          },
        },
        gaze,
        blinked,
        headYaw: detection.yaw,
      };
    },

    /** Whether gaze has been steady in one region long enough to act on it. */
    isGazeSettled(at: number): boolean {
      return at - gazeDwellStart >= config.gazeDwellMs;
    },

    /** The current gaze region for UI highlighting. */
    currentGazeRegion(): { x: number; y: number } {
      return { ...gazeRegion };
    },
  };
}
