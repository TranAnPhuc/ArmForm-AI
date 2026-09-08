/**
 * Translates whatever getUserMedia (or the model loader) threw into a message
 * a user can act on.
 *
 * Pure and dependency-free so every branch can be tested without a camera.
 */

export function describeStartError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";

  switch (name) {
    case "NotAllowedError":
      return "Camera permission denied. Allow camera access and try again.";
    case "NotFoundError":
      return "No camera was found on this device.";
    case "NotReadableError":
      return "The camera is already in use by another application.";
    default:
      return err instanceof Error && err.message
        ? `Could not start tracking: ${err.message}`
        : "Could not start tracking. Please try again.";
  }
}
