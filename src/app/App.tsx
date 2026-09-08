import { useEffect, useReducer, useRef, useState } from "react";
import { describeStartError } from "../features/camera/cameraErrors";
import { isCameraSupported, useCamera } from "../features/camera/useCamera";
import type { ArmSide } from "../features/pose/landmarks";
import { usePoseLandmarker } from "../features/pose/usePoseLandmarker";
import type { CurlPhase } from "../features/exercise/curlStateMachine";
import { resizeCanvasToVideo } from "../features/workout/canvasOverlay";
import { formatCountdown, formatSeconds } from "../features/workout/duration";
import {
  formatWeightKg,
  MAX_WEIGHT_KG,
  parseWeightKg,
} from "../features/workout/weight";
import {
  DEFAULT_REST_MS,
  INITIAL_WORKOUT_STATE,
  REST_OPTIONS_MS,
  summarizeWorkout,
  workoutReducer,
} from "../features/workout/workoutSession";
import {
  useWorkoutLoop,
  type TrackingStatus,
} from "../features/workout/useWorkoutLoop";
import { RepList } from "../components/RepList";
import { SetList } from "../components/SetList";
// TEMPORARY — left-arm investigation. Remove with armDiagnostics.ts.
import * as armDiagnostics from "../features/pose/armDiagnostics";

/** How long one diagnostic run records for. Long enough for five reps. */
const DIAGNOSTIC_SECONDS = 20;

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

/** How often the rest countdown is recomputed. Finer than the second it shows,
 * so the displayed value never lags a full second behind. */
const REST_TICK_MS = 250;

function App() {
  const camera = useCamera();
  const landmarker = usePoseLandmarker();

  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [side, setSide] = useState<ArmSide>("right");

  // Phase, set number, recorded sets and the rest deadline only make sense
  // together, so they move as one — the case CLAUDE.md reserves useReducer for.
  const [workout, dispatch] = useReducer(workoutReducer, INITIAL_WORKOUT_STATE);
  const [restMs, setRestMs] = useState(DEFAULT_REST_MS);
  const [notice, setNotice] = useState<string | null>(null);
  // TEMPORARY diagnostic state.
  const [isDiagnosing, setIsDiagnosing] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // This screen decides *when* reps count; the loop decides *how* a frame
  // becomes one. Rest is the whole difference: the arm still moves, but none
  // of that movement is exercise.
  const loop = useWorkoutLoop({
    videoRef: camera.videoRef,
    canvasRef,
    landmarkerRef: landmarker.landmarkerRef,
    side,
    isCounting: workout.phase === "working",
  });

  // The raw text, not the number: the user must be able to type "1" on the way
  // to "12" without the field rejecting the keystroke.
  const [weightInput, setWeightInput] = useState("");
  const weightKg = parseWeightKg(weightInput);
  const hasWeightError = weightInput.trim() !== "" && weightKg === null;

  // A rest is a deadline, so one interval is enough: however late a tick
  // arrives, the reducer works out the truth from the clock it is handed.
  useEffect(() => {
    if (workout.phase !== "resting") return;

    const id = setInterval(
      () => dispatch({ type: "tick", now: performance.now() }),
      REST_TICK_MS,
    );

    return () => clearInterval(id);
  }, [workout.phase]);

  // The weight is deliberately left alone: it describes the dumbbell in the
  // user's hand, which a reset does not change.
  function resetWorkout() {
    loop.resetSet();
    setNotice(null);
    dispatch({ type: "reset" });
  }

  function finishSet() {
    if (loop.repsRef.current.length === 0) {
      setNotice("Complete a rep before finishing the set.");
      return;
    }

    setNotice(null);
    dispatch({
      type: "finish-set",
      now: performance.now(),
      reps: loop.repsRef.current,
      restMs,
    });
    loop.resetSet();
  }

  function skipRest() {
    dispatch({ type: "skip-rest" });
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

      dispatch({ type: "start" });
      loop.start();
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
    loop.stop();
    camera.stop();

    setNotice(null);
    // Reps done since the last rest belong to a set nobody finished; the
    // reducer banks them so they are not silently lost.
    dispatch({ type: "finish-workout", reps: loop.repsRef.current });
  }

  // Derived, not stored: the summary is only ever a view of the recorded sets,
  // and a second copy could disagree with them.
  const summary =
    workout.phase === "finished"
      ? summarizeWorkout(workout.completedSets)
      : null;

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

        <label className="flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-300">
          <span>Weight</span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            max={MAX_WEIGHT_KG}
            step={0.5}
            value={weightInput}
            onChange={(event) => setWeightInput(event.target.value)}
            placeholder="—"
            aria-label="Weight in kilograms"
            className="w-20 rounded bg-slate-900 px-2 py-1 text-right tabular-nums text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span>kg</span>
        </label>

        <label className="flex items-center gap-2 rounded-md bg-slate-800 px-3 py-2 text-sm text-slate-300">
          <span>Rest</span>
          <select
            value={restMs}
            onChange={(event) => setRestMs(Number(event.target.value))}
            aria-label="Rest between sets"
            className="rounded bg-slate-900 px-2 py-1 text-slate-100 outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {REST_OPTIONS_MS.map((option) => (
              <option key={option} value={option}>
                {formatCountdown(option)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {hasWeightError && (
        <p className="text-sm text-amber-300">
          Enter a weight between 0 and {MAX_WEIGHT_KG} kg, or leave it blank.
        </p>
      )}

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
            {TRACKING_MESSAGE[loop.trackingStatus]}
          </span>
        )}
      </div>

      <section className="grid w-full max-w-xl grid-cols-2 gap-2 text-center sm:grid-cols-4">
        <Stat label="Set" value={String(workout.setNumber)} />
        <Stat label="Reps" value={String(loop.display.repCount)} />
        <Stat
          label="Elbow angle"
          value={
            loop.display.angle === null
              ? "—"
              : `${Math.round(loop.display.angle)}°`
          }
        />
        <Stat label="Phase" value={PHASE_LABEL[loop.display.phase]} />
      </section>

      {workout.phase === "resting" ? (
        <section className="flex w-full max-w-xl flex-col items-center gap-2 rounded-lg border border-slate-800 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Rest — next up set {workout.setNumber}
          </p>
          <p className="text-5xl font-semibold tabular-nums">
            {formatCountdown(workout.restRemainingMs)}
          </p>
          <button
            type="button"
            onClick={skipRest}
            className="rounded-md bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
          >
            Skip rest
          </button>
        </section>
      ) : (
        loop.display.feedback !== null && (
          <p className="text-center text-base font-medium text-indigo-300">
            {loop.display.feedback}
            {loop.display.romScore !== null && (
              <span className="ml-2 text-sm text-slate-400">
                ROM {loop.display.romScore}%
              </span>
            )}
          </p>
        )
      )}

      <div className="flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={camera.isActive ? stopWorkout : startWorkout}
          disabled={isStarting}
          className="rounded-md bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {buttonLabel}
        </button>

        {workout.phase === "working" && (
          <button
            type="button"
            onClick={finishSet}
            className="rounded-md bg-slate-800 px-6 py-3 font-medium text-slate-100 hover:bg-slate-700"
          >
            Finish set
          </button>
        )}
      </div>

      {/* TEMPORARY diagnostic control — remove with armDiagnostics.ts. */}
      {camera.isActive && (
        <button
          type="button"
          disabled={isDiagnosing}
          onClick={() => {
            setIsDiagnosing(true);
            armDiagnostics.startRecording(
              DIAGNOSTIC_SECONDS,
              performance.now(),
              () => setIsDiagnosing(false),
            );
          }}
          className="rounded-md border border-amber-700 px-4 py-2 text-xs text-amber-300 disabled:opacity-50"
        >
          {isDiagnosing
            ? `Recording ${DIAGNOSTIC_SECONDS}s — do 5 reps now`
            : `Diagnose ${side} arm (${DIAGNOSTIC_SECONDS}s)`}
        </button>
      )}

      {notice !== null && <p className="text-sm text-amber-300">{notice}</p>}

      {error !== null && <p className="text-sm text-red-400">{error}</p>}

      <SetList sets={workout.completedSets} />

      <RepList entries={loop.repHistory} />

      {summary !== null && summary.totalReps > 0 && (
        <section className="w-full max-w-xl rounded-lg border border-slate-800 p-4">
          <h2 className="mb-3 text-lg font-semibold">Workout summary</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
            <SummaryRow
              label="Sets"
              value={String(workout.completedSets.length)}
            />
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
            <SummaryRow label="Weight" value={formatWeightKg(weightKg)} />
          </dl>
        </section>
      )}

      {summary !== null && summary.totalReps === 0 && (
        <p className="text-sm text-slate-400">
          No complete reps recorded this workout.
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

export default App;
