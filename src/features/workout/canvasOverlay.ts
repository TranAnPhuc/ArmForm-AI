/**
 * Drawing the arm skeleton on the canvas that sits over the video.
 *
 * Pure rendering: it decides how the arm looks, never whether a rep happened.
 */

import type { Point2D } from "../exercise/angle";

const BONE_COLOR = "#818cf8";
const JOINT_COLOR = "#f8fafc";
const BONE_WIDTH = 4;
const JOINT_RADIUS = 6;

/** Draws shoulder -> elbow -> wrist as a line with a dot at each joint. */
export function drawArm(
  ctx: CanvasRenderingContext2D,
  points: Point2D[],
): void {
  ctx.strokeStyle = BONE_COLOR;
  ctx.lineWidth = BONE_WIDTH;
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.stroke();

  ctx.fillStyle = JOINT_COLOR;
  points.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, JOINT_RADIUS, 0, Math.PI * 2);
    ctx.fill();
  });
}

export function clearCanvas(canvas: HTMLCanvasElement | null): void {
  const ctx = canvas?.getContext("2d");
  if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

/** Matches the drawing surface to the real video frame, in pixels. */
export function resizeCanvasToVideo(
  canvas: HTMLCanvasElement | null,
  video: HTMLVideoElement,
): void {
  if (!canvas) return;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
}
