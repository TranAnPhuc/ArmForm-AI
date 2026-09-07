import { describe, expect, it } from "vitest";
import {
  createCurlState,
  updateCurlState,
  type CurlState,
} from "./curlStateMachine";

/** Feeds a sequence of angles through the machine, one per 100ms. */
function run(angles: number[], initial: CurlState = createCurlState()): CurlState {
  return angles.reduce(
    (state, angle, index) =>
      updateCurlState(state, {
        angle,
        timestampMs: index * 100,
        isValid: true,
      }),
    initial,
  );
}

/** A full curl: extended -> contracted -> extended. */
const ONE_REP = [160, 100, 40, 100, 160];

describe("createCurlState", () => {
  it("starts in unknown with no reps", () => {
    const state = createCurlState();

    expect(state.phase).toBe("unknown");
    expect(state.repCount).toBe(0);
    expect(state.hasReachedUp).toBe(false);
  });
});

describe("updateCurlState — phases", () => {
  it("stays unknown when tracking starts mid-movement", () => {
    expect(run([100, 110, 120]).phase).toBe("unknown");
  });

  it("enters down when the arm is extended", () => {
    expect(run([160]).phase).toBe("down");
  });

  it("enters up when the arm is contracted", () => {
    expect(run([40]).phase).toBe("up");
  });

  it("reports lifting between thresholds after being down", () => {
    expect(run([160, 100]).phase).toBe("lifting");
  });

  it("reports lowering between thresholds after being up", () => {
    expect(run([160, 100, 40, 100]).phase).toBe("lowering");
  });

  it("treats the thresholds themselves as inclusive", () => {
    expect(run([145]).phase).toBe("down");
    expect(run([160, 65]).phase).toBe("up");
  });
});

describe("updateCurlState — rep counting", () => {
  it("counts one rep for a full cycle", () => {
    expect(run(ONE_REP).repCount).toBe(1);
  });

  it("counts three reps for three cycles", () => {
    expect(run([...ONE_REP, ...ONE_REP, ...ONE_REP]).repCount).toBe(3);
  });

  it("does not count a rep before the arm reaches the top", () => {
    // Extended, lifted partway, lowered again — never contracted.
    expect(run([160, 100, 120, 160]).repCount).toBe(0);
  });

  it("does not count the very first extension as a rep", () => {
    expect(run([160]).repCount).toBe(0);
  });

  it("does not count repeatedly while held at the top", () => {
    expect(run([160, 40, 40, 40, 40]).repCount).toBe(0);
  });

  it("does not count repeatedly while held at the bottom", () => {
    expect(run([...ONE_REP, 160, 160, 160]).repCount).toBe(1);
  });

  it("counts a rep even if the arm drops straight from up to down", () => {
    // At 15fps a fast lowering can skip the intermediate band entirely.
    expect(run([160, 40, 160]).repCount).toBe(1);
  });

  it("requires reaching the top again for a second rep", () => {
    expect(run([...ONE_REP, 100, 160]).repCount).toBe(1);
  });
});

describe("updateCurlState — jitter resistance", () => {
  it("ignores noise around the down threshold", () => {
    // Measured angle std was ~6 degrees; this swings wider and still must not
    // leave the down phase, because the up threshold is 80 degrees away.
    const noisy = [160, 144, 148, 143, 150, 141, 160];
    const state = run(noisy);

    expect(state.repCount).toBe(0);
    expect(state.phase).not.toBe("up");
  });

  it("ignores noise around the up threshold", () => {
    const state = run([160, 40, 66, 64, 70, 60, 40]);

    expect(state.repCount).toBe(0);
  });
});

describe("updateCurlState — invalid input", () => {
  it("ignores frames marked invalid", () => {
    const down = run([160]);
    const next = updateCurlState(down, {
      angle: 40,
      timestampMs: 999,
      isValid: false,
    });

    expect(next).toBe(down);
  });

  it("ignores NaN angles", () => {
    const down = run([160]);
    const next = updateCurlState(down, {
      angle: Number.NaN,
      timestampMs: 999,
      isValid: true,
    });

    expect(next).toBe(down);
  });

  it("does not let lost tracking fabricate a rep", () => {
    let state = run([160, 40]);
    // Tracking drops out while the arm is at the top, then returns extended.
    for (let i = 0; i < 5; i++) {
      state = updateCurlState(state, {
        angle: Number.NaN,
        timestampMs: 1000 + i,
        isValid: false,
      });
    }

    expect(state.repCount).toBe(0);
    expect(state.phase).toBe("up");
  });
});

describe("updateCurlState — timestamps", () => {
  it("records when the phase changed", () => {
    const down = updateCurlState(createCurlState(), {
      angle: 160,
      timestampMs: 500,
      isValid: true,
    });

    expect(down.phaseStartedAt).toBe(500);
  });

  it("keeps the original timestamp while the phase is unchanged", () => {
    const down = updateCurlState(createCurlState(), {
      angle: 160,
      timestampMs: 500,
      isValid: true,
    });
    const later = updateCurlState(down, {
      angle: 158,
      timestampMs: 900,
      isValid: true,
    });

    expect(later.phaseStartedAt).toBe(500);
  });
});

describe("updateCurlState — purity", () => {
  it("does not mutate the state it is given", () => {
    const state = run([160]);
    const snapshot = { ...state };

    updateCurlState(state, { angle: 40, timestampMs: 1, isValid: true });

    expect(state).toEqual(snapshot);
  });
});
