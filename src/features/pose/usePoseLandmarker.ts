/**
 * Owns the lifetime of the MediaPipe landmarker: loaded lazily on first use,
 * kept across workouts, and closed exactly once on unmount.
 *
 * Loading errors are thrown so the screen that starts the workout reports them
 * the same way it reports camera errors.
 */

import { useEffect, useRef, type MutableRefObject } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import { createPoseLandmarker } from "./poseDetector";

export interface PoseLandmarkerController {
  /** Read inside the detection loop; null until `ensureLoaded` has resolved. */
  landmarkerRef: MutableRefObject<PoseLandmarker | null>;
  /** Loads the model on first call, then returns the cached instance. */
  ensureLoaded: () => Promise<PoseLandmarker>;
}

export function usePoseLandmarker(): PoseLandmarkerController {
  const landmarkerRef = useRef<PoseLandmarker | null>(null);

  async function ensureLoaded(): Promise<PoseLandmarker> {
    // The model is several megabytes; downloading it once per session is enough.
    landmarkerRef.current ??= await createPoseLandmarker();
    return landmarkerRef.current;
  }

  useEffect(() => {
    return () => {
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  return { landmarkerRef, ensureLoaded };
}
