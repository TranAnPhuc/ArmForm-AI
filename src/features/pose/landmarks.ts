/**
 * MediaPipe Pose returns 33 landmarks as a flat array, addressed by index.
 * These are the only indices the Biceps Curl MVP cares about.
 *
 * "left" / "right" refer to the person's own body, not the screen side.
 */

export type ArmSide = "left" | "right";

export interface ArmLandmarkIndices {
  shoulder: number;
  elbow: number;
  wrist: number;
}

export const ARM_LANDMARKS: Record<ArmSide, ArmLandmarkIndices> = {
  left: { shoulder: 11, elbow: 13, wrist: 15 },
  right: { shoulder: 12, elbow: 14, wrist: 16 },
};

/** All three arm landmarks must reach this visibility before we trust the pose. */
export const MIN_VISIBILITY = 0.5;
