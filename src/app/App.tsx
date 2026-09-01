import { useEffect, useRef, useState } from "react";

function App() {
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setIsCameraOn(true);
    } catch (err) {
      setError(describeCameraError(err));
    } finally {
      setIsStarting(false);
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsCameraOn(false);
  }

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
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

      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="aspect-video w-full max-w-xl rounded-lg bg-slate-900 object-cover"
      />

      <button
        type="button"
        onClick={isCameraOn ? stopCamera : startCamera}
        disabled={isStarting}
        className="rounded-md bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {buttonLabel}
      </button>

      {error !== null && <p className="text-sm text-red-400">{error}</p>}
    </main>
  );
}

function describeCameraError(err: unknown): string {
  const name = err instanceof DOMException ? err.name : "";

  switch (name) {
    case "NotAllowedError":
      return "Camera permission denied. Allow camera access and try again.";
    case "NotFoundError":
      return "No camera was found on this device.";
    case "NotReadableError":
      return "The camera is already in use by another application.";
    default:
      return "Could not start the camera. Please try again.";
  }
}

export default App;
