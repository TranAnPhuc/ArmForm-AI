/**
 * End-to-end test of the deterministic half of the MVP:
 * landmark pixels -> elbow angle -> curl state machine -> form evaluation.
 *
 * The camera and MediaPipe are deliberately absent. Everything below the pose
 * layer is pure, which is what makes this testable at all.
 */

import { describe, expect, it } from "vitest";
import { calculateAngle, type Point2D } from "./angle";
import {
  createCurlState,
  updateCurlState,
  type CurlState,
} from "./curlStateMachine";
import {
  evaluateRep,
  summarizeSession,
  type RepMetrics,
} from "./formEvaluation";

/** Frame size of a typical webcam, so coordinates match real pixel space. */
const WIDTH = 640;
const HEIGHT = 480;

const SHOULDER: Point2D = { x: 0.5 * WIDTH, y: 0.3 * HEIGHT };
const ELBOW: Point2D = { x: 0.5 * WIDTH, y: 0.55 * HEIGHT };

/**
 * Places the wrist so that the elbow angle equals `degrees`, rotating around
 * the elbow from the straight-arm position.
 */
function wristAt(degrees: number): Point2D {
  const forearm = 0.25 * HEIGHT;
  const radians = (degrees * Math.PI) / 180;

  // At 180 degrees the wrist continues straight down from the elbow.
  return {
    x: ELBOW.x + forearm * Math.sin(radians),
    y: ELBOW.y + forearm * Math.cos(Math.PI - radians),
  };
}

interface Frame {
  angleTarget: number;
  timestampMs: number;
}

function feed(frames: Frame[]): { state: CurlState; reps: RepMetrics[] } {
  let state = createCurlState();
  const reps: RepMetrics[] = [];

  for (const frame of frames) {
    const angle = calculateAngle(SHOULDER, ELBOW, wristAt(frame.angleTarget));
    const previous = state;

    state = updateCurlState(state, {
      angle,
      timestampMs: frame.timestampMs,
      isValid: !Number.isNaN(angle),
    });

    if (state.repCount > previous.repCount && state.lastRep) {
      reps.push(state.lastRep);
    }
  }

  return { state, reps };
}

/** Builds one curl at ~15fps, the detection rate measured on real hardware. */
function curl(
  startMs: number,
  options: { top: number; bottom: number; frames: number },
): Frame[] {
  const { top, bottom, frames } = options;
  const step = 1000 / 15;
  const result: Frame[] = [];

  // Down -> up -> down, linearly interpolated.
  for (let i = 0; i <= frames; i++) {
    const progress = i / frames;
    const angle =
      progress <= 0.5
        ? bottom + (top - bottom) * (progress * 2)
        : top + (bottom - top) * ((progress - 0.5) * 2);

    result.push({ angleTarget: angle, timestampMs: startMs + i * step });
  }

  return result;
}

describe("angle geometry helper", () => {
  it("produces the angles the test intends", () => {
    for (const target of [30, 65, 90, 145, 175]) {
      const angle = calculateAngle(SHOULDER, ELBOW, wristAt(target));
      expect(angle).toBeCloseTo(target, 0);
    }
  });
});

describe("full pipeline", () => {
  it("counts a clean rep and rates it good", () => {
    // 160 -> 40 -> 160 over 30 frames at 15fps, about 2 seconds
    const { state, reps } = feed(
      curl(0, { bottom: 160, top: 40, frames: 30 }),
    );

    expect(state.repCount).toBe(1);
    expect(reps).toHaveLength(1);

    const evaluation = evaluateRep(reps[0]);
    expect(evaluation.romScore).toBe(100);
    expect(evaluation.issues).toEqual([]);
    expect(evaluation.message).toBe("Good rep");
  });

  it("flags a shallow rep that never extends", () => {
    const { state, reps } = feed(
      // Starts extended so the machine locks on, then curls in a short range.
      [
        { angleTarget: 160, timestampMs: 0 },
        ...curl(100, { bottom: 130, top: 40, frames: 30 }),
      ],
    );

    // 130 never reaches the 145 down threshold, so no rep completes.
    expect(state.repCount).toBe(0);
    expect(reps).toHaveLength(0);
  });

  it("flags a rep that does not curl high enough", () => {
    const { reps } = feed(curl(0, { bottom: 160, top: 80, frames: 30 }));

    expect(reps).toHaveLength(0); // 80 never reaches the 65 up threshold
  });

  it("flags a rushed rep", () => {
    // Same movement compressed into 6 frames, about 0.4 seconds total.
    const { reps } = feed(curl(0, { bottom: 160, top: 40, frames: 6 }));

    expect(reps).toHaveLength(1);

    const evaluation = evaluateRep(reps[0]);
    expect(evaluation.issues).toContain("lifting-too-fast");
    expect(evaluation.issues).toContain("lowering-too-fast");
  });

  it("summarizes a mixed three-rep session", () => {
    const frames = [
      ...curl(0, { bottom: 160, top: 40, frames: 30 }),
      ...curl(3000, { bottom: 160, top: 40, frames: 6 }),
      ...curl(6000, { bottom: 160, top: 40, frames: 30 }),
    ];

    const { state, reps } = feed(frames);

    expect(state.repCount).toBe(3);

    const summary = summarizeSession(reps);
    expect(summary.totalReps).toBe(3);
    expect(summary.goodReps).toBe(2); // the rushed one fails
    expect(summary.averageRomScore).toBe(100);
  });

  it("ignores dropped tracking without losing the rep in progress", () => {
    let state = createCurlState();
    const frames = curl(0, { bottom: 160, top: 40, frames: 30 });

    frames.forEach((frame, index) => {
      const angle = calculateAngle(SHOULDER, ELBOW, wristAt(frame.angleTarget));
      // Simulate the arm being occluded for a stretch mid-rep.
      const isValid = index < 10 || index > 14;

      state = updateCurlState(state, {
        angle: isValid ? angle : Number.NaN,
        timestampMs: frame.timestampMs,
        isValid,
      });
    });

    expect(state.repCount).toBe(1);
  });
});
