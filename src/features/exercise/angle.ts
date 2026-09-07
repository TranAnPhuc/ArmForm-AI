/**
 * Joint angle maths for the exercise engine.
 *
 * Pure and dependency-free on purpose: no React, no MediaPipe. Anything that
 * can produce three points can use this, and it stays testable without a camera.
 */

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Angle ABC in degrees — the angle at vertex `b` between the segments BA and BC.
 *
 * For a biceps curl: a = shoulder, b = elbow, c = wrist.
 * A straight arm approaches 180 degrees, a fully contracted curl approaches 0.
 *
 * Returns NaN when the angle is undefined, i.e. when `a` or `c` sits exactly on
 * `b` and there is no segment to measure from. Callers must check with
 * Number.isNaN rather than assuming a number came back.
 */
export function calculateAngle(a: Point2D, b: Point2D, c: Point2D): number {
  const ba = { x: a.x - b.x, y: a.y - b.y };
  const bc = { x: c.x - b.x, y: c.y - b.y };

  const magnitude = Math.hypot(ba.x, ba.y) * Math.hypot(bc.x, bc.y);
  if (magnitude === 0) return Number.NaN;

  const dot = ba.x * bc.x + ba.y * bc.y;

  // Floating-point error can push the ratio a hair outside [-1, 1], which would
  // make Math.acos return NaN for a perfectly valid straight or folded arm.
  const cosine = Math.min(1, Math.max(-1, dot / magnitude));

  return (Math.acos(cosine) * 180) / Math.PI;
}
