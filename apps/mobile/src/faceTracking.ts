/**
 * Face tracking adapter for the mobile app.
 *
 * Provides face detection data to the domain module. In the simulator, this
 * generates realistic simulated detections. On a physical device, this can be
 * swapped to use react-native-vision-camera or Apple Vision framework.
 */

import type { FaceDetection, FaceLandmarks } from "@talk/core/domain/faceTracking";

export type FaceTrackingConfig = {
  enabled: boolean;
  minConfidence: number;
  blinkThreshold: number;
  blinkDurationMs: number;
  blinkCooldownMs: number;
  gazeDwellMs: number;
  gazeColumns: number;
  gazeRows: number;
};

export const DEFAULT_FACE_TRACKING_CONFIG: FaceTrackingConfig = {
  enabled: true,
  minConfidence: 0.6,
  blinkThreshold: 0.25,
  blinkDurationMs: 120,
  blinkCooldownMs: 400,
  gazeDwellMs: 500,
  gazeColumns: 3,
  gazeRows: 3,
};

type SimulatedState = {
  faceCenterX: number;
  faceCenterY: number;
  eyeOpenness: number;
  gazeX: number;
  gazeY: number;
  targetX: number;
  targetY: number;
  targetGazeX: number;
  targetGazeY: number;
  nextBlinkAt: number;
  blinking: boolean;
  blinkStartAt: number;
};

/**
 * Creates a simulated face detection source for testing in the simulator.
 * Generates realistic face movements, blinks, and gaze shifts.
 */
export function createSimulatedFaceDetector() {
  const state: SimulatedState = {
    faceCenterX: 0.5,
    faceCenterY: 0.4,
    eyeOpenness: 1,
    gazeX: 0,
    gazeY: 0,
    targetX: 0.5,
    targetY: 0.4,
    targetGazeX: 0,
    targetGazeY: 0,
    nextBlinkAt: Date.now() + 3000 + Math.random() * 4000,
    blinking: false,
    blinkStartAt: 0,
  };

  let lastUpdateAt = Date.now();

  function lerp(current: number, target: number, speed: number): number {
    return current + (target - current) * speed;
  }

  return {
    /** Generates a face detection for the current moment. */
    detect(): FaceDetection | null {
      const now = Date.now();
      const dt = Math.min(100, now - lastUpdateAt);
      lastUpdateAt = now;

      // Smoothly move face toward target
      const moveSpeed = 0.002 * dt;
      state.faceCenterX = lerp(state.faceCenterX, state.targetX, moveSpeed);
      state.faceCenterY = lerp(state.faceCenterY, state.targetY, moveSpeed);

      // Occasionally pick a new target
      if (Math.random() < 0.01) {
        state.targetX = 0.35 + Math.random() * 0.3;
        state.targetY = 0.3 + Math.random() * 0.2;
      }

      // Smoothly move gaze toward target
      const gazeSpeed = 0.005 * dt;
      state.gazeX = lerp(state.gazeX, state.targetGazeX, gazeSpeed);
      state.gazeY = lerp(state.gazeY, state.targetGazeY, gazeSpeed);

      // Occasionally pick a new gaze target
      if (Math.random() < 0.02) {
        state.targetGazeX = (Math.random() - 0.5) * 1.5;
        state.targetGazeY = (Math.random() - 0.5) * 0.8;
      }

      // Handle blinking
      if (!state.blinking && now >= state.nextBlinkAt) {
        state.blinking = true;
        state.blinkStartAt = now;
      }

      if (state.blinking) {
        const blinkElapsed = now - state.blinkStartAt;
        if (blinkElapsed < 60) {
          state.eyeOpenness = 1 - blinkElapsed / 60;
        } else if (blinkElapsed < 120) {
          state.eyeOpenness = (blinkElapsed - 60) / 60;
        } else {
          state.eyeOpenness = 1;
          state.blinking = false;
          state.nextBlinkAt = now + 2000 + Math.random() * 5000;
        }
      }

      const faceWidth = 0.3;
      const faceHeight = 0.38;
      const faceX = state.faceCenterX - faceWidth / 2;
      const faceY = state.faceCenterY - faceHeight / 2;

      const eyeOffsetX = faceWidth * 0.2;
      const eyeY = faceY + faceHeight * 0.3;
      const gazeOffset = state.gazeX * faceWidth * 0.05;

      const landmarks: FaceLandmarks = {
        leftEye: {
          x: state.faceCenterX - eyeOffsetX + gazeOffset,
          y: eyeY + state.gazeY * faceHeight * 0.03,
        },
        rightEye: {
          x: state.faceCenterX + eyeOffsetX + gazeOffset,
          y: eyeY + state.gazeY * faceHeight * 0.03,
        },
        noseTip: {
          x: state.faceCenterX,
          y: faceY + faceHeight * 0.55,
        },
        mouthLeft: {
          x: state.faceCenterX - faceWidth * 0.12,
          y: faceY + faceHeight * 0.75,
        },
        mouthRight: {
          x: state.faceCenterX + faceWidth * 0.12,
          y: faceY + faceHeight * 0.75,
        },
        leftEar: {
          x: faceX - 0.02,
          y: faceY + faceHeight * 0.4,
        },
        rightEar: {
          x: faceX + faceWidth + 0.02,
          y: faceY + faceHeight * 0.4,
        },
      };

      return {
        at: now,
        bounds: { x: faceX, y: faceY, width: faceWidth, height: faceHeight },
        confidence: 0.92 + Math.random() * 0.06,
        landmarks,
        yaw: (state.faceCenterX - 0.5) * 30,
        roll: (state.faceCenterY - 0.4) * 10,
      };
    },

    /** Reset simulation state. */
    reset(): void {
      state.faceCenterX = 0.5;
      state.faceCenterY = 0.4;
      state.eyeOpenness = 1;
      state.gazeX = 0;
      state.gazeY = 0;
      state.targetX = 0.5;
      state.targetY = 0.4;
      state.targetGazeX = 0;
      state.targetGazeY = 0;
      state.nextBlinkAt = Date.now() + 3000 + Math.random() * 4000;
      state.blinking = false;
      state.blinkStartAt = 0;
    },
  };
}
