import { describe, expect, it } from "vitest";
import {
  calculateRomScore,
  evaluateRep,
  summarizeSession,
  type RepMetrics,
} from "./formEvaluation";

/** A clean rep: full extension, full contraction, controlled tempo. */
const GOOD_REP: RepMetrics = {
  minAngle: 50,
  maxAngle: 160,
  liftingMs: 1200,
  loweringMs: 1400,
};

function repWith(overrides: Partial<RepMetrics>): RepMetrics {
  return { ...GOOD_REP, ...overrides };
}

describe("calculateRomScore", () => {
  it("scores 100 for a rep covering the full expected range", () => {
    expect(calculateRomScore(GOOD_REP)).toBe(100);
  });

  it("scores 100 and never above for an exceptionally wide rep", () => {
    expect(calculateRomScore(repWith({ minAngle: 20, maxAngle: 175 }))).toBe(
      100,
    );
  });

  it("scores about half for a rep covering half the range", () => {
    // Expected sweep is 145 - 65 = 80 degrees; this covers 40.
    expect(calculateRomScore(repWith({ minAngle: 100, maxAngle: 140 }))).toBe(
      50,
    );
  });

  it("scores 0 for no movement at all", () => {
    expect(calculateRomScore(repWith({ minAngle: 120, maxAngle: 120 }))).toBe(
      0,
    );
  });

  it("never returns a negative score", () => {
    expect(
      calculateRomScore(repWith({ minAngle: 160, maxAngle: 50 })),
    ).toBeGreaterThanOrEqual(0);
  });
});

describe("evaluateRep", () => {
  it("reports a good rep when everything is within limits", () => {
    const result = evaluateRep(GOOD_REP);

    expect(result.issues).toEqual([]);
    expect(result.message).toBe("Good rep");
  });

  it("flags insufficient extension", () => {
    const result = evaluateRep(repWith({ maxAngle: 120 }));

    expect(result.issues).toContain("extend-further");
    expect(result.message).toBe("Extend your arm further");
  });

  it("flags insufficient contraction", () => {
    const result = evaluateRep(repWith({ minAngle: 90 }));

    expect(result.issues).toContain("curl-higher");
  });

  it("flags lifting that is too fast", () => {
    expect(evaluateRep(repWith({ liftingMs: 200 })).issues).toContain(
      "lifting-too-fast",
    );
  });

  it("flags lowering that is too fast", () => {
    expect(evaluateRep(repWith({ loweringMs: 200 })).issues).toContain(
      "lowering-too-fast",
    );
  });

  it("reports every issue but shows the range-of-motion one first", () => {
    const result = evaluateRep({
      minAngle: 90,
      maxAngle: 120,
      liftingMs: 100,
      loweringMs: 100,
    });

    expect(result.issues).toHaveLength(4);
    expect(result.message).toBe("Extend your arm further");
  });

  it("treats the thresholds themselves as acceptable", () => {
    const result = evaluateRep({
      minAngle: 65,
      maxAngle: 145,
      liftingMs: 500,
      loweringMs: 500,
    });

    expect(result.issues).toEqual([]);
  });
});

describe("summarizeSession", () => {
  it("returns zeroes for an empty session", () => {
    const summary = summarizeSession([]);

    expect(summary.totalReps).toBe(0);
    expect(summary.averageRomScore).toBe(0);
    expect(summary.bestRomScore).toBe(0);
  });

  it("counts total and good reps separately", () => {
    const summary = summarizeSession([
      GOOD_REP,
      repWith({ maxAngle: 120 }),
      GOOD_REP,
    ]);

    expect(summary.totalReps).toBe(3);
    expect(summary.goodReps).toBe(2);
  });

  it("averages tempo across reps", () => {
    const summary = summarizeSession([
      repWith({ liftingMs: 1000, loweringMs: 2000 }),
      repWith({ liftingMs: 2000, loweringMs: 4000 }),
    ]);

    expect(summary.averageLiftingMs).toBe(1500);
    expect(summary.averageLoweringMs).toBe(3000);
  });

  it("reports the best range-of-motion score achieved", () => {
    const summary = summarizeSession([
      repWith({ minAngle: 100, maxAngle: 140 }),
      GOOD_REP,
    ]);

    expect(summary.bestRomScore).toBe(100);
    expect(summary.averageRomScore).toBe(75);
  });
});

describe("evaluateRep — regression F3: unmeasurable tempo", () => {
  it("does not accuse the user of lifting too fast when lifting was not measured", () => {
    const result = evaluateRep(repWith({ liftingMs: null }));

    expect(result.issues).not.toContain("lifting-too-fast");
  });

  it("does not accuse the user of lowering too fast when lowering was not measured", () => {
    const result = evaluateRep(repWith({ loweringMs: null }));

    expect(result.issues).not.toContain("lowering-too-fast");
  });

  it("still reports a good rep when only tempo data is missing", () => {
    const result = evaluateRep(repWith({ liftingMs: null, loweringMs: null }));

    expect(result.issues).toEqual([]);
    expect(result.message).toBe("Good rep");
  });

  it("still evaluates range of motion when tempo is missing", () => {
    const result = evaluateRep(
      repWith({ liftingMs: null, loweringMs: null, maxAngle: 120 }),
    );

    expect(result.issues).toEqual(["extend-further"]);
  });

  it("ignores unmeasured durations when averaging a session", () => {
    const summary = summarizeSession([
      repWith({ liftingMs: null, loweringMs: null }),
      repWith({ liftingMs: 1000, loweringMs: 2000 }),
    ]);

    expect(summary.averageLiftingMs).toBe(1000);
    expect(summary.averageLoweringMs).toBe(2000);
  });

  it("reports null averages when no rep had measurable tempo", () => {
    const summary = summarizeSession([
      repWith({ liftingMs: null, loweringMs: null }),
    ]);

    expect(summary.averageLiftingMs).toBeNull();
    expect(summary.averageLoweringMs).toBeNull();
  });
});
