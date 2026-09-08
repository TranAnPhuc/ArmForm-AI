import { describe, expect, it } from "vitest";
import { formatSeconds } from "./duration";

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
