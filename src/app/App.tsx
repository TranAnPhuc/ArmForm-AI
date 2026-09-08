import { useEffect, useRef, useState } from "react";
import { describeStartError } from "../features/camera/cameraErrors";
import { isCameraSupported, useCamera } from "../features/camera/useCamera";
import type { ArmSide } from "../features/pose/landmarks";
import { readArm, type ArmTrackingStatus } from "../features/pose/poseEngine";
import { usePoseLandmarker } from "../features/pose/usePoseLandmarker";
import { calculateAngle } from "../features/exercise/angle";
import {
  createCurlState,
  updateCurlState,
  type CurlPhase,
  type CurlState,
} from "../features/exercise/curlStateMachine";
import {
  evaluateRep,
  summarizeSession,
  type RepMetrics,
  type SessionSummary,
} from "../features/exercise/formEvaluation";
import {
  clearCanvas,
  drawArm,
  resizeCanvasToVideo,
} from "../features/workout/canvasOverlay";

/** The angle changes every frame; refreshing the readout ~10x a second is
 * plenty for a human to read and keeps React out of the detection loop. */
const UI_REFRESH_MS = 100;

/** "idle" is a UI state, not a tracking result: the workout has not started. */
type TrackingStatus = ArmTrackingStatus | "idle";

const TRACKING_MESSAGE: Record<TrackingStatus, string> = {
  idle: "",
  "no-person": "No person detected. Step into the camera view.",
  "arm-unclear": "Arm not clearly visible. Turn side-on to the camera.",
  tracking: "Tracking",
};

const PHASE_LABEL: Record<CurlPhase, string> = {
  unknown: "—",
  down: "Down",
  lifting: "Lifting",
  up: "Up",
  lowering: "Lowering",
};

interface WorkoutDisplay {
  angle: number | null;
  phase: CurlPhase;
  repCount: number;
  feedback: string | null;
  romScore: number | null;
}

const EMPTY_DISPLAY: WorkoutDisplay = {
  angle: null,
  phase: "unknown",
  repCount: 0,
  feedback: null,
  romScore: null,
};

function App() {
  const camera = useCamera();
  const landmarker = usePoseLandmarker();

  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<ArmSide>("right");
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("idle");
  const [display, setDisplay] = useState<WorkoutDisplay>(EMPTY_DISPLAY);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // requestAnimationFrame runs at ~60fps but a webcam delivers ~30fps, so half
  // the ticks would re-detect an already-processed frame under a new timestamp
  // and make MediaPipe invent motion that never happened.
  const lastFrameTimeRef = useRef(-1);

  // Exercise state lives in a ref, not React state: it updates every frame and
  // the detection loop must read the current value, never a stale closure.
  const curlStateRef = useRef<CurlState>(createCurlState());
  const repsRef = useRef<RepMetrics[]>([]);
  const lastUiUpdateRef = useRef(0);

  // The animation loop is created once and would otherwise close over a stale
  // `side`, so it reads the current value through a ref instead.
  const sideRef = useRef<ArmSide>(side);
  useEffect(() => {
    sideRef.current = side;
  }, [side]);

  function resetWorkout() {
    curlStateRef.current = createCurlState(performance.now());
    repsRef.current = [];
    lastUiUpdateRef.current = 0;
    setDisplay(EMPTY_DISPLAY);
    setSummary(null);
  }

  function selectSide(next: ArmSide) {
    setSide(next);
    // Switching arms would mix two different movements into one count, and a
    // summary left over from the other arm would be misleading.
    resetWorkout();
  }

  async function startWorkout() {
    setError(null);

    if (!isCameraSupported()) {
      setError("Camera is not supported by this browser or connection.");
      return;
    }

    setIsStarting(true);
    resetWorkout();

    try {
      const video = await camera.start();
      resizeCanvasToVideo(canvasRef.current, video);

      await landmarker.ensureLoaded();

      rafIdRef.current = requestAnimationFrame(detectFrame);
    } catch (err) {
      // The camera may already be live when the model fails to load, so release
      // it rather than leaving the light on with nothing reading the frames.
      camera.stop();
      setError(describeStartError(err));
    } finally {
      setIsStarting(false);
    }
  }

  function stopWorkout() {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    lastFrameTimeRef.current = -1;

    camera.stop();
    clearCanvas(canvasRef.current);

    setTrackingStatus("idle");
    setSummary(summarizeSession(repsRef.current));
  }

  function detectFrame() {
    const video = camera.videoRef.current;
    const canvas = canvasRef.current;
    const detector = landmarker.landmarkerRef.current;
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

    const previous = curlStateRef.current;
    const next = updateCurlState(previous, {
      angle: angle ?? Number.NaN,
      timestampMs: now,
      isValid,
    });
    curlStateRef.current = next;

    const repCompleted = next.repCount > previous.repCount;
    if (repCompleted && next.lastRep) {
      repsRef.current.push(next.lastRep);
    }

    // Reps and phase changes surface immediately; the angle readout is throttled.
    const shouldRefresh =
      repCompleted ||
      next.phase !== previous.phase ||
      now - lastUiUpdateRef.current >= UI_REFRESH_MS;

    if (shouldRefresh) {
      lastUiUpdateRef.current = now;
      const evaluation =
        repCompleted && next.lastRep ? evaluateRep(next.lastRep) : null;

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
  // them; the only resource this screen owns is the animation loop.
  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, []);

  const buttonLabel = isStarting
    ? "Loading model..."
    : camera.isActive
      ? "Stop Workout"
      : "Start Workout";

  return (
    <main className="flex min-h-screen flex-col items-center gap-4 bg-slate-950 px-4 py-8 text-slate-100">
      <header className="text-center">
        <h1 className="text-4xl font-bold">ArmForm AI</h1>
        <p className="text-lg text-slate-300">Biceps Curl Form Tracker</p>
      </header>

      <div className="flex gap-2">
        {(["left", "right"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => selectSide(option)}
            className={`rounded-md px-4 py-2 text-sm font-medium capitalize ${
              side === option
                ? "bg-slate-200 text-slate-900"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700"
            }`}
          >
            {option} arm
          </button>
        ))}
      </div>

      <div
        className="relative w-full max-w-xl"
        style={{ aspectRatio: camera.aspectRatio }}
      >
        <video
          ref={camera.videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full rounded-lg bg-slate-900 object-contain"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full rounded-lg"
        />
        {camera.isActive && (
          <span className="absolute left-3 top-3 rounded bg-slate-950/80 px-2 py-1 text-xs text-slate-300">
            {TRACKING_MESSAGE[trackingStatus]}
          </span>
        )}
      </div>

      <section className="grid w-full max-w-xl grid-cols-3 gap-2 text-center">
        <Stat label="Reps" value={String(display.repCount)} />
        <Stat
          label="Elbow angle"
          value={display.angle === null ? "—" : `${Math.round(display.angle)}°`}
        />
        <Stat label="Phase" value={PHASE_LABEL[display.phase]} />
      </section>

      {display.feedback !== null && (
        <p className="text-center text-base font-medium text-indigo-300">
          {display.feedback}
          {display.romScore !== null && (
            <span className="ml-2 text-sm text-slate-400">
              ROM {display.romScore}%
            </span>
          )}
        </p>
      )}

      <button
        type="button"
        onClick={camera.isActive ? stopWorkout : startWorkout}
        disabled={isStarting}
        className="rounded-md bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {buttonLabel}
      </button>

      {error !== null && <p className="text-sm text-red-400">{error}</p>}

      {summary !== null && summary.totalReps > 0 && (
        <section className="w-full max-w-xl rounded-lg border border-slate-800 p-4">
          <h2 className="mb-3 text-lg font-semibold">Session summary</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <SummaryRow label="Total reps" value={String(summary.totalReps)} />
            <SummaryRow
              label="Good reps"
              value={`${summary.goodReps} / ${summary.totalReps}`}
            />
            <SummaryRow label="Avg ROM" value={`${summary.averageRomScore}%`} />
            <SummaryRow label="Best ROM" value={`${summary.bestRomScore}%`} />
            <SummaryRow
              label="Avg lifting"
              value={formatSeconds(summary.averageLiftingMs)}
            />
            <SummaryRow
              label="Avg lowering"
              value={formatSeconds(summary.averageLoweringMs)}
            />
          </dl>
        </section>
      )}

      {summary !== null && summary.totalReps === 0 && (
        <p className="text-sm text-slate-400">
          No complete reps recorded this session.
        </p>
      )}
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-900 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-slate-400">{label}</dt>
      <dd className="font-medium tabular-nums">{value}</dd>
    </div>
  );
}

/** Null means the phase was never timed, which is not the same as 0.0s. */
function formatSeconds(ms: number | null): string {
  if (ms === null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

export default App;
