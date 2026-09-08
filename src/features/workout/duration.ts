/**
 * Displaying phase durations. Shared by the live rep list and the session
 * summary so a duration never reads differently in two places.
 */

/** Null means the phase was never timed, which is not the same as 0.0s. */
export function formatSeconds(ms: number | null): string {
  if (ms === null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}
