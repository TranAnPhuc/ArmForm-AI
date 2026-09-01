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

const WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_PATH =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

type TrackingStatus = "idle" | "no-person" | "arm-unclear" | "tracking";

const TRACKING_MESSAGE: Record<TrackingStatus, string> = {
  idle: "",
  "no-person": "No person detected. Step into the camera view.",
  "arm-unclear": "Arm not clearly visible. Turn side-on to the camera.",
  tracking: "Tracking arm.",
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

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // requestAnimationFrame runs at ~60fps but a webcam delivers ~30fps, so half
  // the ticks would re-detect an already-processed frame under a new timestamp
  // and make MediaPipe invent motion that never happened.
  const lastFrameTimeRef = useRef(-1);

  // The animation loop is created once and would otherwise close over a stale
  // `side`, so it reads the current value through a ref instead.
  const sideRef = useRef<ArmSide>(side);
  useEffect(() => {
    sideRef.current = side;
  }, [side]);

  async function startCamera() {
    setError(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera is not supported by this browser or connection.");
      return;
    }

    setIsStarting(true);

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

    const result = landmarker.detectForVideo(video, performance.now());
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Per-frame landmarks stay local: nothing outside this tick reads them,
    // so they never touch state or a ref.
    const pose = result.landmarks[0];

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
        drawArm(ctx, canvas, arm);
        setTrackingStatus("tracking");
      }
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
    ? "Starting..."
    : isCameraOn
      ? "Stop Workout"
      : "Start Workout";

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 text-slate-100">
      <h1 className="text-4xl font-bold">ArmForm AI</h1>
      <p className="text-lg text-slate-300">Biceps Curl Form Tracker</p>

      <div className="flex gap-2">
        {(["left", "right"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSide(option)}
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
      </div>

      <button
        type="button"
        onClick={isCameraOn ? stopCamera : startCamera}
        disabled={isStarting}
        className="rounded-md bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {buttonLabel}
      </button>

      {isCameraOn && (
        <p className="text-sm text-slate-400">
          {TRACKING_MESSAGE[trackingStatus]}
        </p>
      )}

      {error !== null && <p className="text-sm text-red-400">{error}</p>}
    </main>
  );
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

function drawArm(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  arm: NormalizedLandmark[],
): void {
  const points = arm.map((point) => ({
    x: point.x * canvas.width,
    y: point.y * canvas.height,
  }));

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
