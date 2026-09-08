/**
 * Displaying phase durations. Shared by the live rep list and the session
 * summary so a duration never reads differently in two places.
 */

/** Null means the phase was never timed, which is not the same as 0.0s. */
export function formatSeconds(ms: number | null): string {
  if (ms === null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

/**
 * A rest countdown as m:ss.
 *
 * Rounded up, so the clock shows "0:01" until the second has actually passed
 * and never reads 0:00 while there is still time left to rest.
 */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
