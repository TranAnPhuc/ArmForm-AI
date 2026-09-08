import { describe, expect, it } from "vitest";
import { formatWeightKg, MAX_WEIGHT_KG, parseWeightKg } from "./weight";

describe("parseWeightKg", () => {
  it("reads a whole number", () => {
    expect(parseWeightKg("10")).toBe(10);
  });

  it("reads a decimal, since dumbbells come in half kilos", () => {
    expect(parseWeightKg("12.5")).toBe(12.5);
  });

  it("ignores surrounding whitespace", () => {
    expect(parseWeightKg("  8  ")).toBe(8);
  });

  it("treats an empty field as no weight recorded", () => {
    expect(parseWeightKg("")).toBeNull();
    expect(parseWeightKg("   ")).toBeNull();
  });

  it("rejects text", () => {
    expect(parseWeightKg("heavy")).toBeNull();
    expect(parseWeightKg("10kg")).toBeNull();
  });

  it("rejects zero and negative weights", () => {
    expect(parseWeightKg("0")).toBeNull();
    expect(parseWeightKg("-5")).toBeNull();
  });

  it("accepts the heaviest allowed weight but nothing above it", () => {
    expect(parseWeightKg(String(MAX_WEIGHT_KG))).toBe(MAX_WEIGHT_KG);
    expect(parseWeightKg(String(MAX_WEIGHT_KG + 1))).toBeNull();
  });

  it("rejects values that are numbers but not quantities", () => {
    expect(parseWeightKg("Infinity")).toBeNull();
    expect(parseWeightKg("NaN")).toBeNull();
  });
});

describe("formatWeightKg", () => {
  it("shows a dash when no weight was recorded", () => {
    expect(formatWeightKg(null)).toBe("—");
  });

  it("does not add a decimal to a whole number of kilos", () => {
    expect(formatWeightKg(10)).toBe("10 kg");
  });

  it("keeps one decimal for a fractional weight", () => {
    expect(formatWeightKg(12.5)).toBe("12.5 kg");
  });
});
