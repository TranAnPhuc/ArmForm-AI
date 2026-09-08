/**
 * The shape of a whole workout: sets of reps separated by rest.
 *
 * A reducer rather than loose state, because these values only make sense
 * together — ending a set changes the phase, the set number, the recorded sets
 * and the rest deadline in one move, and no caller should be able to change
 * one without the others.
 *
 * Pure: the current time is passed in, never read here. That is the same rule
 * the curl state machine follows, and it is what lets these transitions be
 * tested without fake timers.
 */

import {
  summarizeSession,
  type RepMetrics,
  type SessionSummary,
} from "../exercise/formEvaluation";

export type WorkoutPhase = "idle" | "working" | "resting" | "finished";

/** Rest lengths offered in the UI, in milliseconds. */
export const REST_OPTIONS_MS = [30_000, 60_000, 90_000, 120_000];
export const DEFAULT_REST_MS = 60_000;

export interface CompletedSet {
  /** 1-based position in the workout. */
  number: number;
  reps: RepMetrics[];
  summary: SessionSummary;
}

export interface WorkoutState {
  phase: WorkoutPhase;
  /** The set being performed, or — while resting — the one about to start. */
  setNumber: number;
  completedSets: CompletedSet[];
  /**
   * When the current rest ends. Null unless resting.
   *
   * A deadline, not a countdown: browsers throttle timers in a background tab,
   * so a counter decremented on every tick would drift behind real time. A
   * deadline is simply correct again on the next tick, however late it arrives.
   */
  restEndsAt: number | null;
  /** What the countdown should show. Zero unless resting. */
  restRemainingMs: number;
}

export type WorkoutAction =
  | { type: "start" }
  /** Ends the current set. Ignored when the set has no reps to record. */
  | { type: "finish-set"; now: number; reps: RepMetrics[]; restMs: number }
  | { type: "tick"; now: number }
  | { type: "skip-rest" }
  /** Ends the workout, recording the set in progress if it has any reps. */
  | { type: "finish-workout"; reps: RepMetrics[] }
  | { type: "reset" };

export const INITIAL_WORKOUT_STATE: WorkoutState = {
  phase: "idle",
  setNumber: 1,
  completedSets: [],
  restEndsAt: null,
  restRemainingMs: 0,
};

export function workoutReducer(
  state: WorkoutState,
  action: WorkoutAction,
): WorkoutState {
  switch (action.type) {
    case "start":
      return { ...INITIAL_WORKOUT_STATE, phase: "working" };

    case "finish-set": {
      // An empty set is not a set. Recording one would put a 0-rep row in the
      // history and inflate the set number for no reason.
      if (state.phase !== "working" || action.reps.length === 0) return state;

      return {
        phase: "resting",
        setNumber: state.setNumber + 1,
        completedSets: [
          ...state.completedSets,
          createSet(state.setNumber, action.reps),
        ],
        restEndsAt: action.now + action.restMs,
        restRemainingMs: action.restMs,
      };
    }

    case "tick": {
      if (state.phase !== "resting" || state.restEndsAt === null) return state;

      const remaining = Math.max(0, state.restEndsAt - action.now);
      if (remaining === 0) {
        return {
          ...state,
          phase: "working",
          restEndsAt: null,
          restRemainingMs: 0,
        };
      }

      // Returning the same object when nothing moved keeps React from
      // re-rendering on a tick that changed nothing.
      if (remaining === state.restRemainingMs) return state;

      return { ...state, restRemainingMs: remaining };
    }

    case "skip-rest":
      if (state.phase !== "resting") return state;

      return {
        ...state,
        phase: "working",
        restEndsAt: null,
        restRemainingMs: 0,
      };

    case "finish-workout": {
      if (state.phase === "idle" || state.phase === "finished") return state;

      // Only a set actually in progress can still be recorded; during rest the
      // previous set was already banked when it ended.
      const recordsSet = state.phase === "working" && action.reps.length > 0;

      return {
        phase: "finished",
        setNumber: state.setNumber,
        completedSets: recordsSet
          ? [...state.completedSets, createSet(state.setNumber, action.reps)]
          : state.completedSets,
        restEndsAt: null,
        restRemainingMs: 0,
      };
    }

    case "reset":
      return INITIAL_WORKOUT_STATE;
  }
}

/** Every rep of every completed set, judged as one session. */
export function summarizeWorkout(sets: CompletedSet[]): SessionSummary {
  return summarizeSession(sets.flatMap((set) => set.reps));
}

/**
 * Copies the reps on the way in: the caller collects them in a mutable buffer
 * it goes on writing to, and a recorded set must never change afterwards.
 */
function createSet(number: number, reps: RepMetrics[]): CompletedSet {
  return { number, reps: [...reps], summary: summarizeSession(reps) };
}
