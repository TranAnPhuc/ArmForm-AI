import { describe, expect, it } from "vitest";
import { formatCountdown, formatSeconds } from "./duration";

describe("formatSeconds", () => {
  it("shows a dash for a phase that was never timed", () => {
    expect(formatSeconds(null)).toBe("—");
  });

  it("shows 0.0s for a phase that really took no time", () => {
    // Distinct from null on purpose: measured-and-instant is not unmeasured.
    expect(formatSeconds(0)).toBe("0.0s");
  });

  it("renders milliseconds as seconds with one decimal", () => {
    expect(formatSeconds(1500)).toBe("1.5s");
    expect(formatSeconds(940)).toBe("0.9s");
  });
});

describe("formatCountdown", () => {
  it("pads the seconds", () => {
    expect(formatCountdown(65_000)).toBe("1:05");
    expect(formatCountdown(120_000)).toBe("2:00");
    expect(formatCountdown(45_000)).toBe("0:45");
  });

  it("rounds up, so the clock never reads 0:00 while time remains", () => {
    expect(formatCountdown(1)).toBe("0:01");
    expect(formatCountdown(1500)).toBe("0:02");
  });

  it("reads 0:00 only when the rest is over", () => {
    expect(formatCountdown(0)).toBe("0:00");
    expect(formatCountdown(-5000)).toBe("0:00");
  });
});
