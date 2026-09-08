/**
 * TEMPORARY — tests for the left-arm investigation instrumentation.
 *
 * These matter because the root-cause conclusion will rest on this arithmetic:
 * if the counting is wrong, the diagnosis is wrong.
 */

import { describe, expect, it } from "vitest";
import {
  analyzeArmFrame,
  isDebugMode,
  formatSummary,
  summarizeDiagnostic,
  type FrameSample,
} from "./armDiagnostics";
import { ARM_LANDMARKS } from "./landmarks";
import type { PoseLandmark } from "./poseEngine";

const FRAME = { width: 640, height: 480 };

/**
 * Builds a 33-landmark pose where the chosen arm forms a known angle.
 * The straight-arm layout runs shoulder -> elbow -> wrist straight down.
 */
function poseWithArm(
  side: "left" | "right",
  options: { visibilities?: [number, number, number]; bendX?: number } = {},
): PoseLandmark[] {
  const { visibilities = [0.9, 0.9, 0.9], bendX = 0 } = options;
  const landmarks: PoseLandmark[] = Array.from({ length: 33 }, () => ({
    x: 0,
    y: 0,
    visibility: 0.9,
  }));

  const i = ARM_LANDMARKS[side];
  landmarks[i.shoulder] = { x: 0.5, y: 0.3, visibility: visibilities[0] };
  landmarks[i.elbow] = { x: 0.5, y: 0.5, visibility: visibilities[1] };
  landmarks[i.wrist] = { x: 0.5 + bendX, y: 0.7, visibility: visibilities[2] };

  return landmarks;
}

function sample(overrides: Partial<FrameSample> = {}): FrameSample {
  return {
    t: 0,
    side: "left",
    hasPose: true,
    visibilities: [0.9, 0.9, 0.9],
    minVisibility: 0.9,
    points: [
      { x: 320, y: 144 },
      { x: 320, y: 240 },
      { x: 320, y: 336 },
    ],
    rawAngle: 180,
    gate: "pass",
    blockedBy: null,
    isCounting: true,
    prevPhase: "down",
    newPhase: "down",
    repCount: 0,
    ...overrides,
  };
}

describe("analyzeArmFrame", () => {
  it("reports no pose when landmarks are missing", () => {
    const result = analyzeArmFrame(undefined, "left", FRAME);

    expect(result.hasPose).toBe(false);
    expect(result.gate).toBe("no-pose");
    expect(result.points).toBeNull();
    expect(result.rawAngle).toBeNaN();
  });

  it("passes the gate when every landmark is visible", () => {
    const result = analyzeArmFrame(poseWithArm("left"), "left", FRAME);

    expect(result.gate).toBe("pass");
    expect(result.blockedBy).toBeNull();
    expect(result.minVisibility).toBe(0.9);
  });

  it("converts to pixels the same way the pipeline does", () => {
    const result = analyzeArmFrame(poseWithArm("left"), "left", FRAME);

    // x 0.5 of 640 and y 0.3 of 480.
    expect(result.points?.[0]).toEqual({ x: 320, y: 144 });
  });

  it("measures a straight arm as 180 degrees", () => {
    const result = analyzeArmFrame(poseWithArm("left"), "left", FRAME);

    expect(result.rawAngle).toBeCloseTo(180);
  });

  it("reads the left and right arms from different landmarks", () => {
    const pose = poseWithArm("left", { visibilities: [0.9, 0.9, 0.9] });
    // The right arm indices were never populated, so they sit at the origin.
    const left = analyzeArmFrame(pose, "left", FRAME);
    const right = analyzeArmFrame(pose, "right", FRAME);

    expect(left.rawAngle).toBeCloseTo(180);
    expect(right.rawAngle).not.toBeCloseTo(180);
  });

  it("still measures the angle on a frame the gate rejects", () => {
    // This is the whole point of the instrumentation.
    const pose = poseWithArm("left", { visibilities: [0.9, 0.9, 0.37] });
    const result = analyzeArmFrame(pose, "left", FRAME);

    expect(result.gate).toBe("reject");
    expect(result.points).not.toBeNull();
    expect(result.rawAngle).toBeCloseTo(180);
  });

  it("names the single landmark that failed", () => {
    const pose = poseWithArm("left", { visibilities: [0.9, 0.9, 0.37] });

    expect(analyzeArmFrame(pose, "left", FRAME).blockedBy).toBe("wrist");
  });

  it("reports multiple when more than one landmark failed", () => {
    const pose = poseWithArm("left", { visibilities: [0.9, 0.2, 0.37] });

    expect(analyzeArmFrame(pose, "left", FRAME).blockedBy).toBe("multiple");
  });

  it("treats the gate threshold itself as passing", () => {
    const pose = poseWithArm("left", { visibilities: [0.5, 0.5, 0.5] });

    expect(analyzeArmFrame(pose, "left", FRAME).gate).toBe("pass");
  });

  it("treats a missing visibility as zero", () => {
    const pose = poseWithArm("left");
    pose[ARM_LANDMARKS.left.wrist] = { x: 0.5, y: 0.7 };

    expect(analyzeArmFrame(pose, "left", FRAME).minVisibility).toBe(0);
  });
});

describe("summarizeDiagnostic", () => {
  it("returns null when there is nothing to summarize", () => {
    expect(summarizeDiagnostic([])).toBeNull();
    expect(summarizeDiagnostic([sample()])).toBeNull();
  });

  it("separates frames that passed the gate from those rejected", () => {
    const summary = summarizeDiagnostic([
      sample({ t: 0 }),
      sample({ t: 100, gate: "reject", blockedBy: "wrist" }),
      sample({ t: 200, hasPose: false, gate: "no-pose" }),
      sample({ t: 300 }),
    ]);

    expect(summary?.frames.total).toBe(4);
    expect(summary?.frames.withPose).toBe(3);
    expect(summary?.frames.noPose).toBe(1);
    expect(summary?.frames.passedGate).toBe(2);
    expect(summary?.frames.rejectedByGate).toBe(1);
  });

  it("counts which landmark caused each rejection", () => {
    const summary = summarizeDiagnostic([
      sample({ t: 0, gate: "reject", blockedBy: "wrist" }),
      sample({ t: 100, gate: "reject", blockedBy: "wrist" }),
      sample({ t: 200, gate: "reject", blockedBy: "elbow" }),
    ]);

    expect(summary?.blockedBy).toEqual({ wrist: 2, elbow: 1 });
  });

  it("counts a threshold hit the gate threw away", () => {
    // The decisive measurement: the arm reached UP, the machine never saw it.
    const summary = summarizeDiagnostic([
      sample({ t: 0, rawAngle: 160 }),
      sample({ t: 100, rawAngle: 61, gate: "reject", blockedBy: "wrist" }),
      sample({ t: 200, rawAngle: 160 }),
    ]);

    expect(summary?.thresholds.rawUpHits).toBe(1);
    expect(summary?.thresholds.validUpHits).toBe(0);
    expect(summary?.thresholds.upHitsRejected).toBe(1);
  });

  it("counts a threshold hit lost because the set was not counting", () => {
    const summary = summarizeDiagnostic([
      sample({ t: 0, rawAngle: 160 }),
      sample({ t: 100, rawAngle: 40, isCounting: false }),
      sample({ t: 200, rawAngle: 160 }),
    ]);

    expect(summary?.thresholds.rawUpHits).toBe(1);
    expect(summary?.thresholds.validUpHits).toBe(0);
    expect(summary?.thresholds.upHitsNotCounting).toBe(1);
    expect(summary?.thresholds.upHitsRejected).toBe(0);
  });

  it("separates the angle range the machine saw from the one reached", () => {
    const summary = summarizeDiagnostic([
      sample({ t: 0, rawAngle: 160 }),
      sample({ t: 100, rawAngle: 40, gate: "reject", blockedBy: "wrist" }),
      sample({ t: 200, rawAngle: 150 }),
    ]);

    expect(summary?.angle.raw?.min).toBe(40);
    expect(summary?.angle.valid?.min).toBe(150);
  });

  it("logs every phase transition", () => {
    const summary = summarizeDiagnostic([
      sample({ t: 0, prevPhase: "down", newPhase: "down" }),
      sample({ t: 100, prevPhase: "down", newPhase: "lifting" }),
      sample({ t: 200, prevPhase: "lifting", newPhase: "up" }),
      sample({ t: 300, prevPhase: "up", newPhase: "up" }),
    ]);

    expect(summary?.transitions.total).toBe(2);
    expect(summary?.transitions.counts["down → lifting"]).toBe(1);
    expect(summary?.transitions.log[0].from).toBe("down");
  });

  it("reports the final rep count", () => {
    const summary = summarizeDiagnostic([
      sample({ t: 0, repCount: 0 }),
      sample({ t: 100, repCount: 1 }),
      sample({ t: 200, repCount: 2 }),
    ]);

    expect(summary?.repsCounted).toBe(2);
  });

  it("computes visibility statistics per landmark", () => {
    const summary = summarizeDiagnostic([
      sample({ t: 0, visibilities: [0.9, 0.8, 0.4] }),
      sample({ t: 1000, visibilities: [0.9, 0.8, 0.6] }),
    ]);

    expect(summary?.visibility.wrist.min).toBe(0.4);
    expect(summary?.visibility.wrist.avg).toBe(0.5);
    expect(summary?.visibility.wrist.framesBelowGate).toBe(1);
  });

  it("derives frame rate from the elapsed time", () => {
    const summary = summarizeDiagnostic([
      sample({ t: 0 }),
      sample({ t: 500 }),
      sample({ t: 1000 }),
    ]);

    expect(summary?.durationSec).toBe(1);
    expect(summary?.frames.fps).toBe(3);
  });
});

describe("formatSummary", () => {
  it("renders the headline numbers a comparison needs", () => {
    const summary = summarizeDiagnostic([
      sample({ t: 0, side: "left", rawAngle: 160 }),
      sample({
        t: 500,
        side: "left",
        rawAngle: 61,
        gate: "reject",
        blockedBy: "wrist",
      }),
      sample({ t: 1000, side: "left", rawAngle: 160, repCount: 1 }),
    ]);

    const text = formatSummary(summary!);

    expect(text).toContain("Arm: LEFT");
    expect(text).toContain("UP lost to gate:        1");
    expect(text).toContain("Reps counted: 1");
  });
});

describe("isDebugMode", () => {
  it("is off by default", () => {
    expect(isDebugMode("")).toBe(false);
  });

  it("is on with ?debug=true", () => {
    expect(isDebugMode("?debug=true")).toBe(true);
  });

  it("stays off for any other value", () => {
    expect(isDebugMode("?debug=1")).toBe(false);
    expect(isDebugMode("?debug=false")).toBe(false);
    expect(isDebugMode("?debug")).toBe(false);
  });

  it("ignores unrelated parameters", () => {
    expect(isDebugMode("?arm=left")).toBe(false);
    expect(isDebugMode("?arm=left&debug=true")).toBe(true);
  });
});
