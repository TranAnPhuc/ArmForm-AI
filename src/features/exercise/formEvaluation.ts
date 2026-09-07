/**
 * Turns the raw numbers of a completed rep into range-of-motion and tempo
 * feedback. Pure: no React, no MediaPipe, no clock of its own.
 */

export interface RepMetrics {
  /** Smallest elbow angle reached — how high the curl went. */
  minAngle: number;
  /** Largest elbow angle reached — how far the arm extended. */
  maxAngle: number;
  /**
   * Milliseconds spent lifting, from leaving "down" to reaching "up".
   * Null when the phase could not be timed — not the same as zero.
   */
  liftingMs: number | null;
  /**
   * Milliseconds spent lowering, from leaving "up" to reaching "down".
   * Null when the phase could not be timed — not the same as zero.
   */
  loweringMs: number | null;
}

export interface FormRules {
  /** Below this maximum angle the arm never really extended. */
  minExtensionAngle: number;
  /** Above this minimum angle the curl never really reached the top. */
  maxContractionAngle: number;
  /** A phase faster than this is uncontrolled. */
  minPhaseMs: number;
}

/**
 * Starting values. Extension and contraction mirror the state machine
 * thresholds; the tempo floor is advisory, per EXERCISE_RULES.md.
 */
export const DEFAULT_FORM_RULES: FormRules = {
  minExtensionAngle: 145,
  maxContractionAngle: 65,
  minPhaseMs: 500,
};

export type FeedbackCode =
  | "good-rep"
  | "extend-further"
  | "curl-higher"
  | "lifting-too-fast"
  | "lowering-too-fast";

export const FEEDBACK_MESSAGE: Record<FeedbackCode, string> = {
  "good-rep": "Good rep",
  "extend-further": "Extend your arm further",
  "curl-higher": "Curl slightly higher",
  "lifting-too-fast": "Lifting too fast — slow down",
  "lowering-too-fast": "Lowering too fast — control the weight",
};

export interface RepEvaluation {
  /** 0-100. How much of the expected range the rep actually covered. */
  romScore: number;
  /** Every issue found, most important first. Empty means a clean rep. */
  issues: FeedbackCode[];
  /** The single message to show the user. */
  message: string;
}

/**
 * Range of motion as a percentage of the expected sweep.
 *
 * The expected sweep runs from the contraction threshold to the extension
 * threshold; a rep covering that whole span scores 100.
 */
export function calculateRomScore(
  metrics: RepMetrics,
  rules: FormRules = DEFAULT_FORM_RULES,
): number {
  const expectedRange = rules.minExtensionAngle - rules.maxContractionAngle;
  if (expectedRange <= 0) return 0;

  const actualRange = metrics.maxAngle - metrics.minAngle;
  const ratio = actualRange / expectedRange;

  return Math.round(Math.min(1, Math.max(0, ratio)) * 100);
}

/**
 * Evaluates one completed rep.
 *
 * Range-of-motion problems are reported before tempo problems: a rep that never
 * reached the top is a bigger issue than one that got there too quickly, and
 * showing one clear message beats showing four at once.
 */
export function evaluateRep(
  metrics: RepMetrics,
  rules: FormRules = DEFAULT_FORM_RULES,
): RepEvaluation {
  const issues: FeedbackCode[] = [];

  if (metrics.maxAngle < rules.minExtensionAngle) issues.push("extend-further");
  if (metrics.minAngle > rules.maxContractionAngle) issues.push("curl-higher");

  // A tempo rule can only fire on a phase we actually timed. An unmeasured
  // phase says nothing about how fast the user moved.
  if (metrics.liftingMs !== null && metrics.liftingMs < rules.minPhaseMs) {
    issues.push("lifting-too-fast");
  }
  if (metrics.loweringMs !== null && metrics.loweringMs < rules.minPhaseMs) {
    issues.push("lowering-too-fast");
  }

  const message = issues.length === 0
    ? FEEDBACK_MESSAGE["good-rep"]
    : FEEDBACK_MESSAGE[issues[0]];

  return {
    romScore: calculateRomScore(metrics, rules),
    issues,
    message,
  };
}

export interface SessionSummary {
  totalReps: number;
  goodReps: number;
  averageRomScore: number;
  /** Null when no rep in the session had a measurable lifting phase. */
  averageLiftingMs: number | null;
  /** Null when no rep in the session had a measurable lowering phase. */
  averageLoweringMs: number | null;
  bestRomScore: number;
}

/** Aggregates a finished session. Returns zeroes for an empty session. */
export function summarizeSession(
  reps: RepMetrics[],
  rules: FormRules = DEFAULT_FORM_RULES,
): SessionSummary {
  if (reps.length === 0) {
    return {
      totalReps: 0,
      goodReps: 0,
      averageRomScore: 0,
      averageLiftingMs: null,
      averageLoweringMs: null,
      bestRomScore: 0,
    };
  }

  const evaluations = reps.map((rep) => evaluateRep(rep, rules));
  const scores = evaluations.map((e) => e.romScore);

  return {
    totalReps: reps.length,
    goodReps: evaluations.filter((e) => e.issues.length === 0).length,
    averageRomScore: Math.round(average(scores)),
    averageLiftingMs: averageMeasured(reps.map((r) => r.liftingMs)),
    averageLoweringMs: averageMeasured(reps.map((r) => r.loweringMs)),
    bestRomScore: Math.max(...scores),
  };
}

function average(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Averages only the durations that were actually measured. */
function averageMeasured(values: (number | null)[]): number | null {
  const measured = values.filter((v): v is number => v !== null);
  if (measured.length === 0) return null;

  return Math.round(average(measured));
}
