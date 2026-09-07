/**
 * Biceps curl phase tracking and rep counting.
 *
 * Pure and dependency-free: takes an elbow angle plus a timestamp and returns
 * the next state. No React, no MediaPipe, no camera.
 */

import type { RepMetrics } from "./formEvaluation";

export type CurlPhase = "unknown" | "down" | "lifting" | "up" | "lowering";

export interface CurlThresholds {
  /** At or above this angle the arm counts as extended. */
  downAngle: number;
  /** At or below this angle the arm counts as contracted. */
  upAngle: number;
}

/** Starting values from EXERCISE_RULES.md. Configurable, never hard-coded elsewhere. */
export const DEFAULT_THRESHOLDS: CurlThresholds = {
  downAngle: 145,
  upAngle: 65,
};

export interface CurlState {
  phase: CurlPhase;
  repCount: number;
  /** When the current phase began. */
  phaseStartedAt: number;
  /**
   * Whether the arm has reached the contracted position since the last
   * completed rep. A rep only counts if it did.
   */
  hasReachedUp: boolean;
  /** Smallest angle seen during the rep in progress. */
  minAngle: number;
  /** Largest angle seen during the rep in progress. */
  maxAngle: number;
  /** When the arm left the extended position, or null before it did. */
  liftStartedAt: number | null;
  /** When the arm first reached the contracted position this rep. */
  upReachedAt: number | null;
  /** Metrics of the most recently completed rep, or null before the first. */
  lastRep: RepMetrics | null;
}

export interface CurlInput {
  angle: number;
  timestampMs: number;
  /** False when pose confidence is too low to trust the angle. */
  isValid: boolean;
}

export function createCurlState(timestampMs = 0): CurlState {
  return {
    phase: "unknown",
    repCount: 0,
    phaseStartedAt: timestampMs,
    hasReachedUp: false,
    minAngle: Number.POSITIVE_INFINITY,
    maxAngle: Number.NEGATIVE_INFINITY,
    liftStartedAt: null,
    upReachedAt: null,
    lastRep: null,
  };
}

/**
 * Advances the state machine by one frame.
 *
 * Invalid or unmeasurable frames are ignored entirely: the previous state is
 * returned unchanged, so lost tracking can never fabricate a transition.
 *
 * The gap between the two thresholds acts as hysteresis. An angle drifting
 * around one threshold cannot oscillate between phases, because leaving a phase
 * requires crossing the whole 80-degree band to the opposite threshold.
 */
export function updateCurlState(
  state: CurlState,
  input: CurlInput,
  thresholds: CurlThresholds = DEFAULT_THRESHOLDS,
): CurlState {
  if (!input.isValid || Number.isNaN(input.angle)) return state;

  const { angle, timestampMs } = input;
  const minAngle = Math.min(state.minAngle, angle);
  const maxAngle = Math.max(state.maxAngle, angle);

  const phase = nextPhase(state.phase, angle, thresholds);

  // Range of motion accumulates on every valid frame, not only on transitions.
  if (phase === state.phase) return { ...state, minAngle, maxAngle };

  // Entering the contracted position arms the rep; only then can it complete.
  const hasReachedUp = phase === "up" ? true : state.hasReachedUp;
  const completesRep = phase === "down" && hasReachedUp;

  const liftStartedAt =
    state.phase === "down" && phase !== "down"
      ? timestampMs
      : state.liftStartedAt;
  const upReachedAt =
    phase === "up" && state.upReachedAt === null
      ? timestampMs
      : state.upReachedAt;

  if (!completesRep) {
    return {
      ...state,
      phase,
      phaseStartedAt: timestampMs,
      hasReachedUp,
      minAngle,
      maxAngle,
      liftStartedAt,
      upReachedAt,
    };
  }

  const lastRep: RepMetrics = {
    minAngle,
    maxAngle,
    liftingMs: elapsed(liftStartedAt, upReachedAt),
    loweringMs: elapsed(upReachedAt, timestampMs),
  };

  return {
    phase,
    repCount: state.repCount + 1,
    phaseStartedAt: timestampMs,
    hasReachedUp: false,
    // The next rep starts here, so the range restarts from the current angle.
    minAngle: angle,
    maxAngle: angle,
    liftStartedAt: null,
    upReachedAt: null,
    lastRep,
  };
}

/** Duration between two marks, or 0 when either mark was never recorded. */
function elapsed(from: number | null, to: number | null): number {
  if (from === null || to === null) return 0;
  return Math.max(0, to - from);
}

function nextPhase(
  current: CurlPhase,
  angle: number,
  thresholds: CurlThresholds,
): CurlPhase {
  if (angle >= thresholds.downAngle) return "down";
  if (angle <= thresholds.upAngle) return "up";

  // Between the thresholds the angle alone is ambiguous, so direction comes
  // from where the arm was: rising out of "down", falling out of "up".
  switch (current) {
    case "down":
    case "lifting":
      return "lifting";
    case "up":
    case "lowering":
      return "lowering";
    default:
      // Started mid-movement: wait for a threshold before assuming a direction.
      return "unknown";
  }
}
