import { describe, expect, it } from "vitest";
import {
  INITIAL_WORKOUT_STATE,
  summarizeWorkout,
  workoutReducer,
  type WorkoutState,
} from "./workoutSession";
import type { RepMetrics } from "../exercise/formEvaluation";

/** Full range, controlled tempo: a rep the evaluator has no complaint about. */
const GOOD_REP: RepMetrics = {
  minAngle: 60,
  maxAngle: 150,
  liftingMs: 900,
  loweringMs: 1200,
};

/** Never reached the top, so it counts but is not a good rep. */
const SHALLOW_REP: RepMetrics = { ...GOOD_REP, minAngle: 90 };

const REST_MS = 60_000;

function working(): WorkoutState {
  return workoutReducer(INITIAL_WORKOUT_STATE, { type: "start" });
}

/** A workout resting after one finished set of two reps. */
function resting(now = 1000): WorkoutState {
  return workoutReducer(working(), {
    type: "finish-set",
    now,
    reps: [GOOD_REP, SHALLOW_REP],
    restMs: REST_MS,
  });
}

describe("workoutReducer — starting", () => {
  it("begins at set 1 with nothing recorded", () => {
    expect(INITIAL_WORKOUT_STATE.phase).toBe("idle");

    const state = working();

    expect(state.phase).toBe("working");
    expect(state.setNumber).toBe(1);
    expect(state.completedSets).toEqual([]);
    expect(state.restEndsAt).toBeNull();
  });

  it("clears a previous workout when starting again", () => {
    const finished = workoutReducer(resting(), {
      type: "finish-workout",
      reps: [],
    });

    expect(workoutReducer(finished, { type: "start" })).toEqual({
      ...INITIAL_WORKOUT_STATE,
      phase: "working",
    });
  });
});

describe("workoutReducer — finishing a set", () => {
  it("records the set, advances the number and starts the rest", () => {
    const state = resting(1000);

    expect(state.phase).toBe("resting");
    expect(state.setNumber).toBe(2);
    expect(state.restEndsAt).toBe(1000 + REST_MS);
    expect(state.restRemainingMs).toBe(REST_MS);

    expect(state.completedSets).toHaveLength(1);
    expect(state.completedSets[0].number).toBe(1);
    expect(state.completedSets[0].summary.totalReps).toBe(2);
    expect(state.completedSets[0].summary.goodReps).toBe(1);
  });

  it("ignores a set with no reps", () => {
    const state = working();

    expect(
      workoutReducer(state, {
        type: "finish-set",
        now: 1000,
        reps: [],
        restMs: REST_MS,
      }),
    ).toBe(state);
  });

  it("ignores a second finish while already resting", () => {
    const state = resting();

    expect(
      workoutReducer(state, {
        type: "finish-set",
        now: 5000,
        reps: [GOOD_REP],
        restMs: REST_MS,
      }),
    ).toBe(state);
  });

  it("copies the reps, so later writes to the caller's buffer cannot change a recorded set", () => {
    const buffer: RepMetrics[] = [GOOD_REP];
    const state = workoutReducer(working(), {
      type: "finish-set",
      now: 0,
      reps: buffer,
      restMs: REST_MS,
    });

    buffer.push(SHALLOW_REP);

    expect(state.completedSets[0].reps).toHaveLength(1);
  });
});

describe("workoutReducer — resting", () => {
  it("counts down while time remains", () => {
    const state = workoutReducer(resting(1000), { type: "tick", now: 21_000 });

    expect(state.phase).toBe("resting");
    expect(state.restRemainingMs).toBe(40_000);
  });

  it("returns to working once the deadline passes", () => {
    const state = workoutReducer(resting(1000), { type: "tick", now: 61_000 });

    expect(state.phase).toBe("working");
    expect(state.restEndsAt).toBeNull();
    expect(state.restRemainingMs).toBe(0);
  });

  it("recovers correctly from a very late tick, as a throttled tab produces", () => {
    const state = workoutReducer(resting(1000), {
      type: "tick",
      now: 500_000,
    });

    expect(state.phase).toBe("working");
    expect(state.restRemainingMs).toBe(0);
  });

  it("returns the same state when a tick changes nothing", () => {
    const state = resting(1000);

    expect(workoutReducer(state, { type: "tick", now: 1000 })).toBe(state);
  });

  it("ignores ticks when not resting", () => {
    const state = working();

    expect(workoutReducer(state, { type: "tick", now: 99_000 })).toBe(state);
  });

  it("skips the rest on request", () => {
    const state = workoutReducer(resting(), { type: "skip-rest" });

    expect(state.phase).toBe("working");
    expect(state.restEndsAt).toBeNull();
    expect(state.setNumber).toBe(2);
  });

  it("ignores a skip when not resting", () => {
    const state = working();

    expect(workoutReducer(state, { type: "skip-rest" })).toBe(state);
  });
});

describe("workoutReducer — finishing the workout", () => {
  it("records the set in progress", () => {
    const state = workoutReducer(working(), {
      type: "finish-workout",
      reps: [GOOD_REP],
    });

    expect(state.phase).toBe("finished");
    expect(state.completedSets).toHaveLength(1);
  });

  it("does not record a set in progress that has no reps", () => {
    const state = workoutReducer(working(), {
      type: "finish-workout",
      reps: [],
    });

    expect(state.phase).toBe("finished");
    expect(state.completedSets).toEqual([]);
  });

  it("does not double-record the previous set when finishing during rest", () => {
    const state = workoutReducer(resting(), {
      type: "finish-workout",
      reps: [GOOD_REP],
    });

    expect(state.phase).toBe("finished");
    expect(state.completedSets).toHaveLength(1);
  });

  it("ignores a finish before the workout started", () => {
    expect(
      workoutReducer(INITIAL_WORKOUT_STATE, {
        type: "finish-workout",
        reps: [GOOD_REP],
      }),
    ).toBe(INITIAL_WORKOUT_STATE);
  });
});

describe("workoutReducer — purity", () => {
  it("never mutates the state it was given", () => {
    const state = resting(1000);
    const snapshot = structuredClone(state);

    workoutReducer(state, { type: "tick", now: 30_000 });
    workoutReducer(state, { type: "skip-rest" });
    workoutReducer(state, { type: "finish-workout", reps: [GOOD_REP] });

    expect(state).toEqual(snapshot);
  });

  it("resets to the initial state", () => {
    expect(workoutReducer(resting(), { type: "reset" })).toEqual(
      INITIAL_WORKOUT_STATE,
    );
  });
});

describe("summarizeWorkout", () => {
  it("judges every rep of every set as one session", () => {
    const first = resting(0);
    const second = workoutReducer(
      workoutReducer(first, { type: "skip-rest" }),
      { type: "finish-set", now: 0, reps: [GOOD_REP], restMs: REST_MS },
    );

    const summary = summarizeWorkout(second.completedSets);

    expect(summary.totalReps).toBe(3);
    expect(summary.goodReps).toBe(2);
  });

  it("returns an empty summary for a workout with no sets", () => {
    expect(summarizeWorkout([]).totalReps).toBe(0);
  });
});
