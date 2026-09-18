/**
 * Body tracking adapter for the mobile app.
 *
 * Provides full body pose detection data to the domain module. In the simulator,
 * this generates realistic simulated pose detections with body movements. On a
 * physical device, this can be swapped to use MediaPipe Pose, MoveNet, or Apple
 * Vision framework.
 */

import type { PoseDetection, PoseLandmarks } from "@talk/core/domain/bodyTracking";

export type BodyTrackingConfig = {
  enabled: boolean;
  minConfidence: number;
  movementThreshold: number;
  gestureDurationMs: number;
  gestureCooldownMs: number;
  enableLearning: boolean;
};

export const DEFAULT_BODY_TRACKING_CONFIG: BodyTrackingConfig = {
  enabled: true,
  minConfidence: 0.5,
  movementThreshold: 0.05,
  gestureDurationMs: 500,
  gestureCooldownMs: 1000,
  enableLearning: true,
};

type SimulatedBodyState = {
  personCenterX: number;
  personCenterY: number;
  targetX: number;
  targetY: number;
  leftHandX: number;
  leftHandY: number;
  rightHandX: number;
  rightHandY: number;
  leftHandTargetX: number;
  leftHandTargetY: number;
  rightHandTargetX: number;
  rightHandTargetY: number;
  headTilt: number;
  isWaving: boolean;
  waveStartAt: number;
  isArmsUp: boolean;
  armsUpStartAt: number;
  isPointing: boolean;
  pointStartAt: number;
  nextGestureAt: number;
};

/**
 * Creates a simulated body pose detection source for testing in the simulator.
 * Generates realistic body movements, gestures (wave, point, arms up), and
 * natural idle motion.
 */
export function createSimulatedBodyDetector() {
  const state: SimulatedBodyState = {
    personCenterX: 0.5,
    personCenterY: 0.45,
    targetX: 0.5,
    targetY: 0.45,
    leftHandX: 0.35,
    leftHandY: 0.6,
    rightHandX: 0.65,
    rightHandY: 0.6,
    leftHandTargetX: 0.35,
    leftHandTargetY: 0.6,
    rightHandTargetX: 0.65,
    rightHandTargetY: 0.6,
    headTilt: 0,
    isWaving: false,
    waveStartAt: 0,
    isArmsUp: false,
    armsUpStartAt: 0,
    isPointing: false,
    pointStartAt: 0,
    nextGestureAt: Date.now() + 5000 + Math.random() * 8000,
  };

  let lastUpdateAt = Date.now();

  function lerp(current: number, target: number, speed: number): number {
    return current + (target - current) * speed;
  }

  return {
    /** Generates a body pose detection for the current moment. */
    detect(): PoseDetection | null {
      const now = Date.now();
      const dt = Math.min(100, now - lastUpdateAt);
      lastUpdateAt = now;

      // Smoothly move person toward target (idle sway)
      const moveSpeed = 0.001 * dt;
      state.personCenterX = lerp(state.personCenterX, state.targetX, moveSpeed);
      state.personCenterY = lerp(state.personCenterY, state.targetY, moveSpeed);

      // Occasionally pick a new idle target
      if (Math.random() < 0.005) {
        state.targetX = 0.4 + Math.random() * 0.2;
        state.targetY = 0.4 + Math.random() * 0.1;
      }

      // Trigger random gestures periodically
      if (!state.isWaving && !state.isArmsUp && !state.isPointing && now >= state.nextGestureAt) {
        const gestureRoll = Math.random();
        if (gestureRoll < 0.35) {
          state.isWaving = true;
          state.waveStartAt = now;
        } else if (gestureRoll < 0.6) {
          state.isArmsUp = true;
          state.armsUpStartAt = now;
        } else if (gestureRoll < 0.8) {
          state.isPointing = true;
          state.pointStartAt = now;
        }
        state.nextGestureAt = now + 6000 + Math.random() * 10000;
      }

      // Handle waving gesture (hand above shoulder, moving side to side)
      if (state.isWaving) {
        const elapsed = now - state.waveStartAt;
        if (elapsed < 1500) {
          // Right hand above right shoulder, oscillating horizontally
          const wavePhase = Math.sin(elapsed * 0.012) * 0.08;
          state.rightHandTargetX = state.personCenterX + 0.15 + wavePhase;
          state.rightHandTargetY = state.personCenterY - 0.25;
        } else {
          state.isWaving = false;
          state.rightHandTargetX = 0.65;
          state.rightHandTargetY = 0.6;
        }
      }

      // Handle arms up gesture
      if (state.isArmsUp) {
        const elapsed = now - state.armsUpStartAt;
        if (elapsed < 2000) {
          state.leftHandTargetX = state.personCenterX - 0.2;
          state.leftHandTargetY = state.personCenterY - 0.3;
          state.rightHandTargetX = state.personCenterX + 0.2;
          state.rightHandTargetY = state.personCenterY - 0.3;
        } else {
          state.isArmsUp = false;
          state.leftHandTargetX = 0.35;
          state.leftHandTargetY = 0.6;
          state.rightHandTargetX = 0.65;
          state.rightHandTargetY = 0.6;
        }
      }

      // Handle pointing gesture
      if (state.isPointing) {
        const elapsed = now - state.pointStartAt;
        if (elapsed < 1800) {
          state.rightHandTargetX = state.personCenterX + 0.3;
          state.rightHandTargetY = state.personCenterY - 0.05;
        } else {
          state.isPointing = false;
          state.rightHandTargetX = 0.65;
          state.rightHandTargetY = 0.6;
        }
      }

      // Smoothly move hands toward targets
      const handSpeed = 0.008 * dt;
      state.leftHandX = lerp(state.leftHandX, state.leftHandTargetX, handSpeed);
      state.leftHandY = lerp(state.leftHandY, state.leftHandTargetY, handSpeed);
      state.rightHandX = lerp(state.rightHandX, state.rightHandTargetX, handSpeed);
      state.rightHandY = lerp(state.rightHandY, state.rightHandTargetY, handSpeed);

      // Head tilt follows person movement
      state.headTilt = (state.personCenterX - 0.5) * 15;

      // Build full COCO pose landmarks (17 joints)
      const cx = state.personCenterX;
      const cy = state.personCenterY;

      const landmarks: PoseLandmarks = {
        // Head
        nose: { x: cx, y: cy - 0.18, z: 0 },
        leftEye: { x: cx - 0.03, y: cy - 0.2, z: 0.02 },
        rightEye: { x: cx + 0.03, y: cy - 0.2, z: 0.02 },
        leftEar: { x: cx - 0.07, y: cy - 0.19, z: -0.01 },
        rightEar: { x: cx + 0.07, y: cy - 0.19, z: -0.01 },
        // Upper body
        leftShoulder: { x: cx - 0.15, y: cy - 0.1, z: 0 },
        rightShoulder: { x: cx + 0.15, y: cy - 0.1, z: 0 },
        leftElbow: {
          x: (cx - 0.15 + state.leftHandX) / 2,
          y: (cy - 0.1 + state.leftHandY) / 2,
          z: 0.05,
        },
        rightElbow: {
          x: (cx + 0.15 + state.rightHandX) / 2,
          y: (cy - 0.1 + state.rightHandY) / 2,
          z: 0.05,
        },
        leftWrist: { x: state.leftHandX, y: state.leftHandY, z: 0.08 },
        rightWrist: { x: state.rightHandX, y: state.rightHandY, z: 0.08 },
        // Lower body
        leftHip: { x: cx - 0.1, y: cy + 0.1, z: 0 },
        rightHip: { x: cx + 0.1, y: cy + 0.1, z: 0 },
        leftKnee: { x: cx - 0.1, y: cy + 0.28, z: 0.03 },
        rightKnee: { x: cx + 0.1, y: cy + 0.28, z: 0.03 },
        leftAnkle: { x: cx - 0.1, y: cy + 0.45, z: 0.02 },
        rightAnkle: { x: cx + 0.1, y: cy + 0.45, z: 0.02 },
      };

      const personWidth = 0.4;
      const personHeight = 0.7;

      return {
        at: now,
        bounds: {
          x: cx - personWidth / 2,
          y: cy - personHeight / 2,
          width: personWidth,
          height: personHeight,
        },
        confidence: 0.88 + Math.random() * 0.1,
        landmarks,
        landmarkConfidence: {
          nose: 0.95,
          leftEye: 0.92,
          rightEye: 0.93,
          leftShoulder: 0.9,
          rightShoulder: 0.91,
          leftWrist: 0.85,
          rightWrist: 0.86,
          leftHip: 0.88,
          rightHip: 0.89,
        },
      };
    },

    /** Reset simulation state. */
    reset(): void {
      state.personCenterX = 0.5;
      state.personCenterY = 0.45;
      state.targetX = 0.5;
      state.targetY = 0.45;
      state.leftHandX = 0.35;
      state.leftHandY = 0.6;
      state.rightHandX = 0.65;
      state.rightHandY = 0.6;
      state.leftHandTargetX = 0.35;
      state.leftHandTargetY = 0.6;
      state.rightHandTargetX = 0.65;
      state.rightHandTargetY = 0.6;
      state.headTilt = 0;
      state.isWaving = false;
      state.isArmsUp = false;
      state.isPointing = false;
      state.nextGestureAt = Date.now() + 5000 + Math.random() * 8000;
    },
  };
}
