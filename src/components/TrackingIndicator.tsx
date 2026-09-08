/**
 * What the camera can currently see.
 *
 * Tracking quality decides whether a rep is counted at all, so the user has to
 * be able to tell at a glance — mid-exercise, from a few steps away — whether
 * the system is following them or has lost the arm.
 */

import type { TrackingStatus } from "../features/workout/useWorkoutLoop";

interface Presentation {
  /** A shape, not only a colour: colour alone excludes anyone who cannot see it. */
  mark: string;
  label: string;
  detail: string;
  className: string;
}

const PRESENTATION: Record<Exclude<TrackingStatus, "idle">, Presentation> = {
  tracking: {
    mark: "●",
    label: "Tracking",
    detail: "Reps are being counted.",
    className: "border-emerald-700 bg-emerald-950/80 text-emerald-300",
  },
  "arm-unclear": {
    mark: "◐",
    label: "Arm unclear",
    detail: "Turn side-on so the shoulder, elbow and wrist are all visible.",
    className: "border-amber-700 bg-amber-950/80 text-amber-300",
  },
  "no-person": {
    mark: "○",
    label: "No person",
    detail: "Step into the camera view.",
    className: "border-rose-800 bg-rose-950/80 text-rose-300",
  },
};

export function TrackingIndicator({ status }: { status: TrackingStatus }) {
  if (status === "idle") return null;

  const { mark, label, detail, className } = PRESENTATION[status];

  return (
    <div
      // Announced to screen readers when it changes, without interrupting.
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${className}`}
    >
      <span aria-hidden="true">{mark}</span>
      <span className="font-medium">{label}</span>
      <span className="hidden text-xs opacity-80 sm:inline">{detail}</span>
    </div>
  );
}
