/**
 * The per-frame pipeline: video frame -> pose -> elbow angle -> curl state
 * machine -> rep metrics -> what the screen shows.
 *
 * It owns the animation loop and the exercise state that changes on every
 * frame. The screen above it decides *when* reps count; this decides *how* a
 * frame becomes a rep. None of the counting logic lives here either — it is
 * called from here, and every piece of it is pure and tested on its own.
 */

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { ArmSide } from "../pose/landmarks";
import { readArm, type ArmTrackingStatus } from "../pose/poseEngine";
import { calculateAngle } from "../exercise/angle";
import {
  createCurlState,
  updateCurlState,
  type CurlPhase,
  type CurlState,
} from "../exercise/curlStateMachine";
import type { RepMetrics } from "../exercise/formEvaluation";
import { clearCanvas, drawArm } from "./canvasOverlay";
import { createRepEntry, type RepEntry } from "./repHistory";
// TEMPORARY — left-arm investigation. Remove with armDiagnostics.ts.
import * as armDiagnostics from "../pose/armDiagnostics";

/** The angle changes every frame; refreshing the readout ~10x a second is
 * plenty for a human to read and keeps React out of the detection loop. */
const UI_REFRESH_MS = 100;

/** "idle" is a UI state, not a tracking result: the loop is not running. */
export type TrackingStatus = ArmTrackingStatus | "idle";

export interface WorkoutDisplay {
  angle: number | null;
  phase: CurlPhase;
  /** Reps of the set in progress. */
  repCount: number;
  feedback: string | null;
  romScore: number | null;
}

export const EMPTY_DISPLAY: WorkoutDisplay = {
  angle: null,
  phase: "unknown",
  repCount: 0,
  feedback: null,
  romScore: null,
};

export interface WorkoutLoopOptions {
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  landmarkerRef: MutableRefObject<PoseLandmarker | null>;
  side: ArmSide;
  /** False during rest: frames are still drawn, but no rep is counted. */
  isCounting: boolean;
}

export interface WorkoutLoop {
  trackingStatus: TrackingStatus;
  display: WorkoutDisplay;
  /** Every rep of the set in progress, ready to render. */
  repHistory: RepEntry[];
  /**
   * The same reps as a mutable buffer, read when a set or the workout ends.
   *
   * The loop writes to it synchronously and reads it back on the next frame,
   * where React state would still hold the previous value.
   */
  repsRef: MutableRefObject<RepMetrics[]>;
  start: () => void;
  stop: () => void;
  /** Forgets the set in progress, keeping the loop running. */
  resetSet: () => void;
}

export function useWorkoutLoop({
  videoRef,
  canvasRef,
  landmarkerRef,
  side,
  isCounting,
}: WorkoutLoopOptions): WorkoutLoop {
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("idle");
  const [display, setDisplay] = useState<WorkoutDisplay>(EMPTY_DISPLAY);
  const [repHistory, setRepHistory] = useState<RepEntry[]>([]);

  const rafIdRef = useRef<number | null>(null);

  // requestAnimationFrame runs at ~60fps but a webcam delivers ~30fps, so half
  // the ticks would re-detect an already-processed frame under a new timestamp
  // and make MediaPipe invent motion that never happened.
  const lastFrameTimeRef = useRef(-1);

  // Exercise state lives in a ref, not React state: it updates every frame and
  // the loop must read the current value, never a stale closure.
  const curlStateRef = useRef<CurlState>(createCurlState());
  const repsRef = useRef<RepMetrics[]>([]);
  const lastUiUpdateRef = useRef(0);

  // The loop is created once and would otherwise close over the props as they
  // were then, so the values that change while it runs arrive through refs.
  const sideRef = useRef<ArmSide>(side);
  useEffect(() => {
    sideRef.current = side;
  }, [side]);

  const isCountingRef = useRef(isCounting);
  useEffect(() => {
    isCountingRef.current = isCounting;
  }, [isCounting]);

  function resetSet() {
    curlStateRef.current = createCurlState(performance.now());
    repsRef.current = [];
    lastUiUpdateRef.current = 0;
    setDisplay(EMPTY_DISPLAY);
    setRepHistory([]);
  }

  function start() {
    // Starting twice would leave two loops fighting over the same canvas.
    if (rafIdRef.current !== null) return;

    lastFrameTimeRef.current = -1;
    rafIdRef.current = requestAnimationFrame(detectFrame);
  }

  function stop() {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    lastFrameTimeRef.current = -1;
    clearCanvas(canvasRef.current);
    setTrackingStatus("idle");
  }

  function detectFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const detector = landmarkerRef.current;
    const ctx = canvas?.getContext("2d");

    if (!video || !canvas || !detector || !ctx || video.readyState < 2) {
      rafIdRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    // Same video frame as last tick: nothing new to detect, leave the overlay as is.
    if (video.currentTime === lastFrameTimeRef.current) {
      rafIdRef.current = requestAnimationFrame(detectFrame);
      return;
    }
    lastFrameTimeRef.current = video.currentTime;

    const now = performance.now();
    const result = detector.detectForVideo(video, now);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Per-frame landmarks stay local: nothing outside this tick reads them,
    // so they never touch state or a ref.
    const reading = readArm(result.landmarks[0], sideRef.current, {
      width: canvas.width,
      height: canvas.height,
    });
    setTrackingStatus(reading.status);

    // TEMPORARY — observation only, computed solely while recording so a normal
    // frame pays nothing. It re-reads the raw landmarks because `reading` has
    // already discarded the coordinates of a rejected frame, and those are
    // exactly the frames under investigation.
    const diagAnalysis = armDiagnostics.isRecording()
      ? armDiagnostics.analyzeArmFrame(result.landmarks[0], sideRef.current, {
          width: canvas.width,
          height: canvas.height,
        })
      : null;

    let angle: number | null = null;
    let isValid = false;

    if (reading.points) {
      drawArm(ctx, reading.points);
      angle = calculateAngle(
        reading.points[0],
        reading.points[1],
        reading.points[2],
      );
      isValid = !Number.isNaN(angle);
    }

    // Reps only count while a set is under way. During rest the arm still moves
    // — racking the dumbbell, reaching for a drink — and none of that is
    // exercise, so the state machine must not see those frames at all.
    if (!isCountingRef.current) {
      // TEMPORARY — a frame the state machine never sees is still evidence.
      if (diagAnalysis) {
        const held = curlStateRef.current;
        armDiagnostics.record(
          diagAnalysis,
          {
            side: sideRef.current,
            isCounting: false,
            prevPhase: held.phase,
            newPhase: held.phase,
            repCount: held.repCount,
          },
          now,
        );
      }

      if (now - lastUiUpdateRef.current >= UI_REFRESH_MS) {
        lastUiUpdateRef.current = now;
        setDisplay((current) => ({ ...current, angle }));
      }

      rafIdRef.current = requestAnimationFrame(detectFrame);
      return;
    }

    const previous = curlStateRef.current;
    const next = updateCurlState(previous, {
      angle: angle ?? Number.NaN,
      timestampMs: now,
      isValid,
    });
    curlStateRef.current = next;

    // TEMPORARY — records what the state machine did with this frame.
    if (diagAnalysis) {
      armDiagnostics.record(
        diagAnalysis,
        {
          side: sideRef.current,
          isCounting: true,
          prevPhase: previous.phase,
          newPhase: next.phase,
          repCount: next.repCount,
        },
        now,
      );
    }

    const repCompleted = next.repCount > previous.repCount;

    // `repsRef` is the source of truth for whoever ends the set; `repHistory`
    // is the same reps in the form the list renders. A deliberate duplication.
    let completed: RepEntry | null = null;
    if (repCompleted && next.lastRep) {
      repsRef.current.push(next.lastRep);

      const entry = createRepEntry(next.repCount, next.lastRep);
      completed = entry;
      setRepHistory((current) => [...current, entry]);
    }

    // Reps and phase changes surface immediately; the angle readout is throttled.
    const shouldRefresh =
      repCompleted ||
      next.phase !== previous.phase ||
      now - lastUiUpdateRef.current >= UI_REFRESH_MS;

    if (shouldRefresh) {
      lastUiUpdateRef.current = now;
      const evaluation = completed?.evaluation ?? null;

      setDisplay((current) => ({
        angle,
        phase: next.phase,
        repCount: next.repCount,
        feedback: evaluation ? evaluation.message : current.feedback,
        romScore: evaluation ? evaluation.romScore : current.romScore,
      }));
    }

    rafIdRef.current = requestAnimationFrame(detectFrame);
  }

  // The camera stream and the landmarker are released by the hooks that own
  // them; the only resource this loop owns is the animation frame.
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  return {
    trackingStatus,
    display,
    repHistory,
    repsRef,
    start,
    stop,
    resetSet,
  };
}
