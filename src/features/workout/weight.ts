/**
 * The dumbbell weight the user is lifting.
 *
 * The camera cannot see how heavy the dumbbell is, so the user types it in.
 * Parsing and validating that text is pure, and therefore testable.
 */

/** Anything heavier is a typo, not a dumbbell curl. */
export const MAX_WEIGHT_KG = 500;

/**
 * Reads a weight in kilograms from user input.
 *
 * Returns null for anything unusable — empty, not a number, zero or negative,
 * or absurdly heavy. Null means "no weight recorded", which is a normal state:
 * the weight is optional metadata, never a precondition for tracking reps.
 */
export function parseWeightKg(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;

  const value = Number(trimmed);
  // Number("") is 0 and Number("abc") is NaN, so both checks are needed.
  if (!Number.isFinite(value)) return null;
  if (value <= 0 || value > MAX_WEIGHT_KG) return null;

  return value;
}

/** Displays a weight without a trailing ".0" on whole kilograms. */
export function formatWeightKg(kg: number | null): string {
  if (kg === null) return "—";
  return `${Number.isInteger(kg) ? kg : kg.toFixed(1)} kg`;
}
