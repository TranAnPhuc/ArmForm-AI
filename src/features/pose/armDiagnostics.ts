/**
 * TEMPORARY — instrumentation for the left-arm under-counting investigation.
 * Delete once the root cause is proven. To remove: delete this file and its
 * test, then `grep -rn "armDiagnostics" src/`.
 *
 * The question it exists to answer: when a rep is missed, which stage lost it?
 *
 *   landmarks -> visibility gate -> pixels -> angle -> state machine -> rep
 *
 * The decisive measurement is the angle computed for EVERY frame that has a
 * pose, including the frames the visibility gate rejects. `readArm` cannot
 * provide that — it returns null points on rejection — so this module reads the
 * raw landmarks itself and repeats the same pixel conversion the production
 * path uses. Nothing here feeds back into the pipeline.
 */

import { calculateAngle, type Point2D } from "../exercise/angle";
import {
  DEFAULT_THRESHOLDS,
  type CurlPhase,
} from "../exercise/curlStateMachine";
import { ARM_LANDMARKS, MIN_VISIBILITY, type ArmSide } from "./landmarks";
import type { FrameSize, PoseLandmark } from "./poseEngine";

/** Samples from the first moments are noisy: the model is still warming up. */
const WARMUP_MS = 500;

export type GateResult = "pass" | "reject" | "no-pose";
export type BlockingLandmark = "shoulder" | "elbow" | "wrist" | "multiple";

/** What one frame looked like, independent of whether the pipeline used it. */
export interface FrameAnalysis {
  hasPose: boolean;
  /** [shoulder, elbow, wrist], or null when no pose was detected. */
  visibilities: number[] | null;
  minVisibility: number | null;
  /** Pixel coordinates, present even when the gate rejected the frame. */
  points: Point2D[] | null;
  /** Elbow angle from those pixels. NaN when unmeasurable. */
  rawAngle: number;
  gate: GateResult;
  /** Which landmark failed the gate, when one did. */
  blockedBy: BlockingLandmark | null;
}

/** A frame plus what the pipeline did with it. */
export interface FrameSample extends FrameAnalysis {
  t: number;
  side: ArmSide;
  /** False while resting: the state machine never sees the frame. */
  isCounting: boolean;
  prevPhase: CurlPhase;
  newPhase: CurlPhase;
  repCount: number;
}

export type PipelineContext = Pick<
  FrameSample,
  "side" | "isCounting" | "prevPhase" | "newPhase" | "repCount"
>;

const POINT_NAMES = ["shoulder", "elbow", "wrist"] as const;

/**
 * Reads one arm exactly as the pipeline does, but reports what it found instead
 * of withholding it. Pure: no clock, no DOM, no MediaPipe types.
 */
export function analyzeArmFrame(
  landmarks: PoseLandmark[] | undefined,
  side: ArmSide,
  frame: FrameSize,
): FrameAnalysis {
  if (!landmarks) {
    return {
      hasPose: false,
      visibilities: null,
      minVisibility: null,
      points: null,
      rawAngle: Number.NaN,
      gate: "no-pose",
      blockedBy: null,
    };
  }

  const indices = ARM_LANDMARKS[side];
  const arm = [
    landmarks[indices.shoulder],
    landmarks[indices.elbow],
    landmarks[indices.wrist],
  ];

  const visibilities = arm.map((point) => point?.visibility ?? 0);
  const minVisibility = Math.min(...visibilities);

  // Same conversion as poseEngine.readArm: normalized x scales with width and
  // y with height, so the angle is only meaningful in pixels.
  const points = arm.every((point) => point !== undefined)
    ? arm.map((point) => ({
        x: point.x * frame.width,
        y: point.y * frame.height,
      }))
    : null;

  const rawAngle = points
    ? calculateAngle(points[0], points[1], points[2])
    : Number.NaN;

  const failing = visibilities
    .map((v, i) => (v < MIN_VISIBILITY ? POINT_NAMES[i] : null))
    .filter((name): name is (typeof POINT_NAMES)[number] => name !== null);

  return {
    hasPose: true,
    visibilities,
    minVisibility,
    points,
    rawAngle,
    gate: failing.length === 0 ? "pass" : "reject",
    blockedBy:
      failing.length === 0
        ? null
        : failing.length > 1
          ? "multiple"
          : failing[0],
  };
}

export interface Stat {
  min: number;
  avg: number;
  max: number;
}

export interface DiagnosticSummary {
  side: ArmSide;
  durationSec: number;
  frames: {
    total: number;
    withPose: number;
    noPose: number;
    passedGate: number;
    rejectedByGate: number;
    validRatio: number;
    notCounting: number;
    fps: number;
  };
  visibility: Record<string, Stat & { framesBelowGate: number }>;
  blockedBy: Record<string, number>;
  angle: {
    /** Across every frame with measurable landmarks, gate ignored. */
    raw: Stat | null;
    /** Across only the frames the state machine actually received. */
    valid: Stat | null;
  };
  thresholds: {
    up: number;
    down: number;
    rawUpHits: number;
    rawDownHits: number;
    validUpHits: number;
    validDownHits: number;
    /** Frames that reached a threshold but were thrown away by the gate. */
    upHitsRejected: number;
    downHitsRejected: number;
    /** Reached a threshold while resting, so the machine never saw it. */
    upHitsNotCounting: number;
    downHitsNotCounting: number;
  };
  transitions: {
    total: number;
    counts: Record<string, number>;
    log: TransitionEntry[];
  };
  repsCounted: number;
}

export interface TransitionEntry {
  t: number;
  from: CurlPhase;
  to: CurlPhase;
  angle: number;
  visibilities: number[] | null;
  repCount: number;
}

/**
 * Turns the collected frames into the comparison between arms. Pure, so the
 * arithmetic that the conclusion rests on is unit-tested rather than trusted.
 */
export function summarizeDiagnostic(
  samples: FrameSample[],
): DiagnosticSummary | null {
  if (samples.length < 2) return null;

  const side = samples[samples.length - 1].side;
  const durationSec = (samples[samples.length - 1].t - samples[0].t) / 1000;

  const posed = samples.filter((s) => s.hasPose);
  const passed = samples.filter((s) => s.gate === "pass");
  const rejected = samples.filter((s) => s.gate === "reject");

  // What the state machine actually received: through the gate AND counting.
  const reachedMachine = passed.filter((s) => s.isCounting);

  const visibility: DiagnosticSummary["visibility"] = {};
  POINT_NAMES.forEach((name, i) => {
    const values = posed.map((s) => s.visibilities?.[i] ?? 0);
    visibility[name] = {
      ...stat(values),
      framesBelowGate: values.filter((v) => v < MIN_VISIBILITY).length,
    };
  });

  const blockedBy: Record<string, number> = {};
  rejected.forEach((s) => {
    const key = s.blockedBy ?? "unknown";
    blockedBy[key] = (blockedBy[key] ?? 0) + 1;
  });

  const rawAngles = posed.map((s) => s.rawAngle).filter(Number.isFinite);
  const validAngles = reachedMachine
    .map((s) => s.rawAngle)
    .filter(Number.isFinite);

  const { upAngle, downAngle } = DEFAULT_THRESHOLDS;
  const isUp = (s: FrameSample) =>
    Number.isFinite(s.rawAngle) && s.rawAngle <= upAngle;
  const isDown = (s: FrameSample) =>
    Number.isFinite(s.rawAngle) && s.rawAngle >= downAngle;

  const transitionSamples = samples.filter((s) => s.prevPhase !== s.newPhase);
  const counts: Record<string, number> = {};
  transitionSamples.forEach((s) => {
    const key = `${s.prevPhase} → ${s.newPhase}`;
    counts[key] = (counts[key] ?? 0) + 1;
  });

  return {
    side,
    durationSec: round(durationSec),
    frames: {
      total: samples.length,
      withPose: posed.length,
      noPose: samples.length - posed.length,
      passedGate: passed.length,
      rejectedByGate: rejected.length,
      validRatio: round((passed.length / samples.length) * 100),
      notCounting: samples.filter((s) => !s.isCounting).length,
      fps: round(samples.length / durationSec),
    },
    visibility,
    blockedBy,
    angle: {
      raw: rawAngles.length > 0 ? stat(rawAngles) : null,
      valid: validAngles.length > 0 ? stat(validAngles) : null,
    },
    thresholds: {
      up: upAngle,
      down: downAngle,
      rawUpHits: posed.filter(isUp).length,
      rawDownHits: posed.filter(isDown).length,
      validUpHits: reachedMachine.filter(isUp).length,
      validDownHits: reachedMachine.filter(isDown).length,
      upHitsRejected: rejected.filter(isUp).length,
      downHitsRejected: rejected.filter(isDown).length,
      upHitsNotCounting: posed.filter((s) => !s.isCounting && isUp(s)).length,
      downHitsNotCounting: posed.filter((s) => !s.isCounting && isDown(s))
        .length,
    },
    transitions: {
      total: transitionSamples.length,
      counts,
      log: transitionSamples.map((s) => ({
        t: round((s.t - samples[0].t) / 1000),
        from: s.prevPhase,
        to: s.newPhase,
        angle: round(s.rawAngle),
        visibilities: s.visibilities?.map(round) ?? null,
        repCount: s.repCount,
      })),
    },
    repsCounted: samples[samples.length - 1].repCount,
  };
}

/** The summary as the block of text to paste back. Pure and testable. */
export function formatSummary(s: DiagnosticSummary): string {
  const { frames: f, thresholds: t } = s;
  const lines: string[] = [];

  lines.push("=== ARM DIAGNOSTIC ===");
  lines.push("");
  lines.push(`Arm: ${s.side.toUpperCase()}`);
  lines.push(`Duration: ${s.durationSec}s`);
  lines.push("");
  lines.push("Frames:");
  lines.push(`  Pose frames:      ${f.withPose}`);
  lines.push(`  No-pose frames:   ${f.noPose}`);
  lines.push(`  Passed gate:      ${f.passedGate}`);
  lines.push(`  Rejected by gate: ${f.rejectedByGate}`);
  lines.push(`  Not counting:     ${f.notCounting}`);
  lines.push(`  Valid ratio:      ${f.validRatio}%`);
  lines.push(`  FPS:              ${f.fps}`);
  lines.push("");
  lines.push("Visibility (min / avg / below gate):");
  for (const name of POINT_NAMES) {
    const v = s.visibility[name];
    lines.push(
      `  ${name.padEnd(9)} ${v.min} / ${v.avg} / ${v.framesBelowGate} frames`,
    );
  }
  lines.push("");
  lines.push("Rejections by landmark:");
  const blockers = Object.entries(s.blockedBy);
  if (blockers.length === 0) lines.push("  none");
  for (const [name, count] of blockers) {
    lines.push(`  ${name.padEnd(9)} ${count}`);
  }
  lines.push("");
  lines.push("Angle:");
  lines.push(`  Raw   ${describeStat(s.angle.raw)}`);
  lines.push(`  Valid ${describeStat(s.angle.valid)}`);
  lines.push("");
  lines.push(`Threshold hits (UP <= ${t.up}, DOWN >= ${t.down}):`);
  lines.push(`  Raw UP:                 ${t.rawUpHits}`);
  lines.push(`  Raw DOWN:               ${t.rawDownHits}`);
  lines.push(`  Machine saw UP:         ${t.validUpHits}`);
  lines.push(`  Machine saw DOWN:       ${t.validDownHits}`);
  lines.push(`  UP lost to gate:        ${t.upHitsRejected}`);
  lines.push(`  DOWN lost to gate:      ${t.downHitsRejected}`);
  lines.push(`  UP lost to rest:        ${t.upHitsNotCounting}`);
  lines.push(`  DOWN lost to rest:      ${t.downHitsNotCounting}`);
  lines.push("");
  lines.push(`State transitions: ${s.transitions.total}`);
  for (const [key, count] of Object.entries(s.transitions.counts)) {
    lines.push(`  ${key.padEnd(22)} ${count}`);
  }
  lines.push("");
  lines.push(`Reps counted: ${s.repsCounted}`);
  lines.push("");
  lines.push("Transition log:");
  if (s.transitions.log.length === 0) lines.push("  none");
  for (const entry of s.transitions.log) {
    const vis = entry.visibilities?.join("/") ?? "—";
    lines.push(
      `  ${String(entry.t).padStart(6)}s  ${entry.from} → ${entry.to}` +
        `  angle ${entry.angle}  vis ${vis}  reps ${entry.repCount}`,
    );
  }

  return lines.join("\n");
}

function describeStat(s: Stat | null): string {
  if (!s) return "no measurable frames";
  return `min ${s.min}  avg ${s.avg}  max ${s.max}  range ${round(s.max - s.min)}`;
}

function stat(values: number[]): Stat {
  const sum = values.reduce((total, v) => total + v, 0);
  return {
    min: round(Math.min(...values)),
    avg: round(sum / values.length),
    max: round(Math.max(...values)),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// --- recorder -------------------------------------------------------------
// The only stateful part. Kept apart from the pure functions above so the
// analysis can be tested without it.

let samples: FrameSample[] = [];
let startedAt: number | null = null;
let durationMs = 0;
let onFinish: (() => void) | null = null;

/** The loop checks this first, so a frame costs nothing while not recording. */
export function isRecording(): boolean {
  return startedAt !== null;
}

export function startRecording(
  seconds: number,
  now: number,
  onDone?: () => void,
): void {
  samples = [];
  startedAt = now;
  durationMs = seconds * 1000;
  onFinish = onDone ?? null;
  console.log(`[arm-diag] recording ${seconds}s — perform your reps now`);
}

export function record(
  analysis: FrameAnalysis,
  context: PipelineContext,
  now: number,
): void {
  if (startedAt === null) return;

  const elapsed = now - startedAt;

  if (elapsed >= durationMs) {
    finish();
    return;
  }

  if (elapsed < WARMUP_MS) return;

  samples.push({ ...analysis, ...context, t: now });
}

function finish(): void {
  const summary = summarizeDiagnostic(samples);
  startedAt = null;

  if (!summary) {
    console.warn("[arm-diag] not enough samples — was the camera running?");
  } else {
    const text = formatSummary(summary);
    console.log(text);
    download(`armform-diag-${summary.side}.txt`, text);
  }

  onFinish?.();
  onFinish = null;
}

/** Saves the report to a file so it never has to survive a copy-paste. */
function download(filename: string, contents: string): void {
  try {
    const url = URL.createObjectURL(
      new Blob([contents], { type: "text/plain" }),
    );
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);

    console.log(`[arm-diag] saved ${filename} to your Downloads folder`);
  } catch {
    console.warn("[arm-diag] could not save a file — copy the text above");
  }
}
