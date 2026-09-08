/**
 * Turns raw pose landmarks into the three arm points the exercise engine needs.
 *
 * Pure and dependency-free: no React, no MediaPipe, no DOM. That is why the
 * frame size arrives as plain numbers instead of a canvas element — the whole
 * point of this module is that it can be tested without a camera.
 */

import type { Point2D } from "../exercise/angle";
import { ARM_LANDMARKS, MIN_VISIBILITY, type ArmSide } from "./landmarks";

/**
 * The subset of a MediaPipe landmark this layer uses. Declaring it structurally
 * keeps the dependency arrow pointing at us, not at the vision library.
 */
export interface PoseLandmark {
  x: number;
  y: number;
  visibility?: number;
}

export interface FrameSize {
  width: number;
  height: number;
}

export type ArmTrackingStatus = "no-person" | "arm-unclear" | "tracking";

export interface ArmReading {
  status: ArmTrackingStatus;
  /** Shoulder, elbow and wrist in pixels, or null when the arm is untrusted. */
  points: Point2D[] | null;
}

const UNTRACKED = (status: ArmTrackingStatus): ArmReading => ({
  status,
  points: null,
});

/**
 * Reads one arm from a detected pose.
 *
 * Coordinates are converted to pixels here because normalized x scales with
 * frame width and y with frame height: on a non-square frame the two axes are
 * not comparable, and an angle measured from them would be distorted.
 */
export function readArm(
  landmarks: PoseLandmark[] | undefined,
  side: ArmSide,
  frame: FrameSize,
): ArmReading {
  if (!landmarks) return UNTRACKED("no-person");

  const indices = ARM_LANDMARKS[side];
  const arm = [
    landmarks[indices.shoulder],
    landmarks[indices.elbow],
    landmarks[indices.wrist],
  ];

  // A missing landmark is as untrustworthy as a low-confidence one.
  if (arm.some((point) => (point?.visibility ?? 0) < MIN_VISIBILITY)) {
    return UNTRACKED("arm-unclear");
  }

  return {
    status: "tracking",
    points: arm.map((point) => ({
      x: point.x * frame.width,
      y: point.y * frame.height,
    })),
  };
}
