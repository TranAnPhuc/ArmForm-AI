import { describe, expect, it } from "vitest";
import { readArm, type PoseLandmark } from "./poseEngine";
import { ARM_LANDMARKS, MIN_VISIBILITY } from "./landmarks";

/** Frame size of a typical webcam, so the pixel maths is realistic. */
const FRAME = { width: 640, height: 480 };

const LANDMARK_COUNT = 33;

/** A pose where every landmark is invisible, so tests only set what they need. */
function emptyPose(): PoseLandmark[] {
  return Array.from({ length: LANDMARK_COUNT }, () => ({
    x: 0,
    y: 0,
    visibility: 0,
  }));
}

/** Places a visible shoulder, elbow and wrist for one side. */
function poseWithArm(
  side: "left" | "right",
  visibility = 0.9,
): PoseLandmark[] {
  const pose = emptyPose();
  const indices = ARM_LANDMARKS[side];

  pose[indices.shoulder] = { x: 0.5, y: 0.25, visibility };
  pose[indices.elbow] = { x: 0.5, y: 0.5, visibility };
  pose[indices.wrist] = { x: 0.75, y: 0.5, visibility };

  return pose;
}

describe("readArm — no usable pose", () => {
  it("reports no person when the frame contains no pose", () => {
    expect(readArm(undefined, "right", FRAME)).toEqual({
      status: "no-person",
      points: null,
    });
  });

  it("reports an unclear arm when confidence is below the threshold", () => {
    const pose = poseWithArm("right", MIN_VISIBILITY - 0.01);

    expect(readArm(pose, "right", FRAME)).toEqual({
      status: "arm-unclear",
      points: null,
    });
  });

  it("reports an unclear arm when a landmark is missing entirely", () => {
    const pose = poseWithArm("right");
    // A short landmark array is what a partially detected pose looks like.
    const truncated = pose.slice(0, ARM_LANDMARKS.right.wrist);

    expect(readArm(truncated, "right", FRAME).status).toBe("arm-unclear");
  });

  it("reports an unclear arm when only one of the three joints is weak", () => {
    const pose = poseWithArm("right");
    pose[ARM_LANDMARKS.right.elbow] = { x: 0.5, y: 0.5, visibility: 0.1 };

    expect(readArm(pose, "right", FRAME).status).toBe("arm-unclear");
  });

  it("reports an unclear arm when visibility is absent", () => {
    const pose = emptyPose();
    const indices = ARM_LANDMARKS.left;
    pose[indices.shoulder] = { x: 0.5, y: 0.25 };
    pose[indices.elbow] = { x: 0.5, y: 0.5 };
    pose[indices.wrist] = { x: 0.75, y: 0.5 };

    expect(readArm(pose, "left", FRAME).status).toBe("arm-unclear");
  });
});

describe("readArm — tracking", () => {
  it("accepts confidence exactly at the threshold", () => {
    const pose = poseWithArm("right", MIN_VISIBILITY);

    expect(readArm(pose, "right", FRAME).status).toBe("tracking");
  });

  it("returns shoulder, elbow and wrist converted to pixels, in that order", () => {
    const reading = readArm(poseWithArm("right"), "right", FRAME);

    expect(reading.status).toBe("tracking");
    expect(reading.points).toEqual([
      { x: 320, y: 120 },
      { x: 320, y: 240 },
      { x: 480, y: 240 },
    ]);
  });

  it("scales x by width and y by height, so a non-square frame is not distorted", () => {
    const reading = readArm(poseWithArm("right"), "right", {
      width: 1000,
      height: 100,
    });

    expect(reading.points).toEqual([
      { x: 500, y: 25 },
      { x: 500, y: 50 },
      { x: 750, y: 50 },
    ]);
  });

  it("reads the side the caller asked for, not the other one", () => {
    const pose = poseWithArm("left");

    expect(readArm(pose, "left", FRAME).status).toBe("tracking");
    expect(readArm(pose, "right", FRAME).status).toBe("arm-unclear");
  });

  it("does not mutate the landmarks it was given", () => {
    const pose = poseWithArm("right");
    const snapshot = structuredClone(pose);

    readArm(pose, "right", FRAME);

    expect(pose).toEqual(snapshot);
  });
});
