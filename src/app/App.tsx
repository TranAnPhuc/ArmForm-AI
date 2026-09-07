import { useEffect, useRef, useState } from "react";
import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
} from "@mediapipe/tasks-vision";
import {
  ARM_LANDMARKS,
  MIN_VISIBILITY,
  type ArmSide,
} from "../features/pose/landmarks";
import { calculateAngle, type Point2D } from "../features/exercise/angle";
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

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

/** The angle changes every frame; refreshing the readout ~10x a second is
 * plenty for a human to read and keeps React out of the detection loop. */
const UI_REFRESH_MS = 100;

type TrackingStatus = "idle" | "no-person" | "arm-unclear" | "tracking";

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
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<ArmSide>("right");
  const [trackingStatus, setTrackingStatus] = useState<TrackingStatus>("idle");
  // Webcams are usually 4:3, not 16:9. Matching the frame to the real video
  // ratio keeps the canvas overlay aligned with what the user sees.
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const [display, setDisplay] = useState<WorkoutDisplay>(EMPTY_DISPLAY);
  const [summary, setSummary] = useState<SessionSummary | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
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

  async function startCamera() {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not supported by this browser or connection.");
      return;
    }

    setIsStarting(true);
    resetWorkout();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await waitForVideoReady(video);

      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
      }

      if (video.videoHeight > 0) {
        setAspectRatio(video.videoWidth / video.videoHeight);
      }

      poseLandmarkerRef.current ??= await createPoseLandmarker();

      setIsCameraOn(true);
      rafIdRef.current = requestAnimationFrame(detectFrame);
    } catch (err) {
      setError(describeStartError(err));
    } finally {
      setIsStarting(false);
    }
  }

  function stopCamera() {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    lastFrameTimeRef.current = -1;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    clearCanvas(canvasRef.current);

    setIsCameraOn(false);
    setTrackingStatus("idle");
    setSummary(summarizeSession(repsRef.current));
  }

  function detectFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const landmarker = poseLandmarkerRef.current;
    const ctx = canvas?.getContext("2d");

    if (!video || !canvas || !landmarker || !ctx || video.readyState < 2) {
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
    const result = landmarker.detectForVideo(video, now);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Per-frame landmarks stay local: nothing outside this tick reads them,
    // so they never touch state or a ref.
    const pose = result.landmarks[0];

    let angle: number | null = null;
    let isValid = false;

    if (!pose) {
      setTrackingStatus("no-person");
    } else {
      const indices = ARM_LANDMARKS[sideRef.current];
      const arm = [
        pose[indices.shoulder],
        pose[indices.elbow],
        pose[indices.wrist],
      ];

      if (arm.some((point) => (point?.visibility ?? 0) < MIN_VISIBILITY)) {
        setTrackingStatus("arm-unclear");
      } else {
        const points = toPixels(arm, canvas);
        drawArm(ctx, points);
        setTrackingStatus("tracking");

        // The angle must be measured in pixels: normalized x scales with width
        // and y with height, so on a non-square frame the two axes are not
        // comparable and the angle would be distorted.
        angle = calculateAngle(points[0], points[1], points[2]);
        isValid = !Number.isNaN(angle);
      }
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

  useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      poseLandmarkerRef.current?.close();
      poseLandmarkerRef.current = null;
    };
  }, []);

  const buttonLabel = isStarting
    ? "Loading model..."
    : isCameraOn
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

      <div className="relative w-full max-w-xl" style={{ aspectRatio }}>
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="h-full w-full rounded-lg bg-slate-900 object-contain"
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full rounded-lg"
        />
        {isCameraOn && (
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
        onClick={isCameraOn ? stopCamera : startCamera}
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

function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return Promise.resolve();

  return new Promise((resolve) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
  });
}

async function createPoseLandmarker(): Promise<PoseLandmarker> {
  const vision = await FilesetResolver.forVisionTasks(WASM_PATH);

  return PoseLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate: "GPU" },
    runningMode: "VIDEO",
    numPoses: 1,
  });
}

function toPixels(
  arm: NormalizedLandmark[],
  canvas: HTMLCanvasElement,
): Point2D[] {
  return arm.map((point) => ({
    x: point.x * canvas.width,
    y: point.y * canvas.height,
  }));
}

function drawArm(ctx: CanvasRenderingContext2D, points: Point2D[]): void {
  ctx.strokeStyle = "#818cf8";
  ctx.lineWidth = 4;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  ctx.fillStyle = "#f8fafc";
  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.fill();
  });
}

function clearCanvas(canvas: HTMLCanvasElement | null): void {
  const ctx = canvas?.getContext("2d");
  if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function describeStartError(err: unknown): string {
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

export default App;
