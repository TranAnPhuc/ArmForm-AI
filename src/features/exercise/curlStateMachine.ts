/**
 * Biceps curl phase tracking and rep counting.
 *
 * Pure and dependency-free: takes an elbow angle plus a timestamp and returns
 * the next state. No React, no MediaPipe, no camera.
 */

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
  /** When the current phase began, used later for tempo. */
  phaseStartedAt: number;
  /**
   * Whether the arm has reached the contracted position since the last
   * completed rep. A rep only counts if it did.
   */
  hasReachedUp: boolean;
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

  const phase = nextPhase(state.phase, input.angle, thresholds);
  if (phase === state.phase) return state;

  // Entering the contracted position arms the rep; only then can it complete.
  const hasReachedUp = phase === "up" ? true : state.hasReachedUp;
  const completesRep = phase === "down" && hasReachedUp;

  return {
    phase,
    repCount: completesRep ? state.repCount + 1 : state.repCount,
    phaseStartedAt: input.timestampMs,
    hasReachedUp: completesRep ? false : hasReachedUp,
  };
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
