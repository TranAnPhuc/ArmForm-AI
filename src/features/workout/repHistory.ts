/**
 * One completed repetition, ready to be shown to the user.
 *
 * The state machine produces raw metrics and the form evaluator judges them;
 * this pairs the two with the position of the rep in the session, which is the
 * only thing the UI needs to render a row.
 */

import {
  evaluateRep,
  type RepEvaluation,
  type RepMetrics,
} from "../exercise/formEvaluation";

export interface RepEntry {
  /** 1-based position in the session, as counted by the state machine. */
  number: number;
  metrics: RepMetrics;
  evaluation: RepEvaluation;
}

export function createRepEntry(number: number, metrics: RepMetrics): RepEntry {
  return { number, metrics, evaluation: evaluateRep(metrics) };
}
