import { describe, expect, it } from "vitest";
import { describeStartError } from "./cameraErrors";

describe("describeStartError", () => {
  it("explains a denied permission", () => {
    const err = new DOMException("denied", "NotAllowedError");

    expect(describeStartError(err)).toBe(
      "Camera permission denied. Allow camera access and try again.",
    );
  });

  it("explains a missing camera", () => {
    const err = new DOMException("none", "NotFoundError");

    expect(describeStartError(err)).toBe(
      "No camera was found on this device.",
    );
  });

  it("explains a camera held by another application", () => {
    const err = new DOMException("busy", "NotReadableError");

    expect(describeStartError(err)).toBe(
      "The camera is already in use by another application.",
    );
  });

  it("still says tracking failed for an unrecognised DOMException", () => {
    const err = new DOMException("overconstrained", "OverconstrainedError");

    // Deliberately loose: DOMException extends Error in browsers but not in
    // jsdom, so only the "Could not start tracking" prefix is portable.
    expect(describeStartError(err)).toMatch(/^Could not start tracking/);
  });

  it("includes the message of a plain Error, such as a failed model download", () => {
    const err = new Error("Failed to fetch the pose model");

    expect(describeStartError(err)).toBe(
      "Could not start tracking: Failed to fetch the pose model",
    );
  });

  it("stays generic when an Error carries no message", () => {
    expect(describeStartError(new Error(""))).toBe(
      "Could not start tracking. Please try again.",
    );
  });

  it("stays generic when the thrown value is not an Error at all", () => {
    expect(describeStartError("boom")).toBe(
      "Could not start tracking. Please try again.",
    );
    expect(describeStartError(undefined)).toBe(
      "Could not start tracking. Please try again.",
    );
  });
});
