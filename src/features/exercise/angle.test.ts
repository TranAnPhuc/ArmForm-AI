import { describe, expect, it } from "vitest";
import { calculateAngle, type Point2D } from "./angle";

const shoulder: Point2D = { x: 0, y: 0 };

describe("calculateAngle", () => {
  it("returns 180 degrees for a straight arm", () => {
    expect(calculateAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBe(
      180,
    );
  });

  it("returns 90 degrees for a right angle", () => {
    expect(
      calculateAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }),
    ).toBeCloseTo(90);
  });

  it("returns 0 degrees when the arm is folded back on itself", () => {
    expect(calculateAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 })).toBe(
      0,
    );
  });

  it("returns 45 degrees for a diagonal", () => {
    expect(
      calculateAngle({ x: 1, y: 1 }, { x: 0, y: 0 }, { x: 1, y: 0 }),
    ).toBeCloseTo(45);
  });

  it("is unaffected by translation", () => {
    const base = calculateAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 });
    const moved = calculateAngle(
      { x: 10, y: -5 },
      { x: 11, y: -5 },
      { x: 11, y: -4 },
    );

    expect(moved).toBeCloseTo(base);
  });

  it("is unaffected by scale", () => {
    const small = calculateAngle({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 });
    const large = calculateAngle(
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    );

    expect(large).toBeCloseTo(small);
  });

  it("handles the normalized 0-1 coordinates MediaPipe produces", () => {
    const angle = calculateAngle(
      { x: 0.5, y: 0.2 },
      { x: 0.5, y: 0.5 },
      { x: 0.5, y: 0.8 },
    );

    expect(angle).toBeCloseTo(180);
  });

  it("never returns a value outside 0-180", () => {
    const cases: [Point2D, Point2D, Point2D][] = [
      [{ x: -3, y: 4 }, shoulder, { x: 5, y: -2 }],
      [{ x: 0.1, y: 0.9 }, { x: 0.4, y: 0.4 }, { x: 0.9, y: 0.1 }],
      [{ x: -1, y: -1 }, { x: -2, y: -2 }, { x: -3, y: -1 }],
    ];

    for (const [a, b, c] of cases) {
      const angle = calculateAngle(a, b, c);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThanOrEqual(180);
    }
  });

  it("returns NaN when the first point sits on the vertex", () => {
    expect(
      calculateAngle({ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 2 }),
    ).toBeNaN();
  });

  it("returns NaN when the last point sits on the vertex", () => {
    expect(
      calculateAngle({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 1, y: 1 }),
    ).toBeNaN();
  });
});
