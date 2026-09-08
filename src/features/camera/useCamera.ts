/**
 * Owns the webcam: permission, the MediaStream, and the video element.
 *
 * It knows nothing about poses, angles or reps — ARCHITECTURE.md keeps the
 * camera layer free of exercise logic. Errors are thrown, not swallowed, so the
 * screen composing the workout stays the single place that decides what the
 * user is told.
 */

import { useEffect, useRef, useState, type MutableRefObject } from "react";

export interface CameraController {
  /** Attach this to the <video> element that shows the stream. */
  videoRef: MutableRefObject<HTMLVideoElement | null>;
  /** True once a stream is playing, false after `stop`. */
  isActive: boolean;
  /**
   * Width / height of the real video frame.
   *
   * Webcams are usually 4:3, not 16:9. Sizing the frame from the actual video
   * keeps a canvas overlay aligned with what the user sees.
   */
  aspectRatio: number;
  /** Starts the stream and resolves with the ready video element. Throws on failure. */
  start: () => Promise<HTMLVideoElement>;
  stop: () => void;
}

const DEFAULT_ASPECT_RATIO = 16 / 9;

/** Some browsers, and any page served without HTTPS, have no camera API at all. */
export function isCameraSupported(): boolean {
  return Boolean(navigator.mediaDevices?.getUserMedia);
}

export function useCamera(): CameraController {
  const [isActive, setIsActive] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(DEFAULT_ASPECT_RATIO);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  async function start(): Promise<HTMLVideoElement> {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    streamRef.current = stream;

    const video = videoRef.current;
    if (!video) {
      // Nothing can display the stream, so hand it back instead of leaking it.
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      throw new Error("Video element is not mounted.");
    }

    video.srcObject = stream;
    await waitForVideoReady(video);

    if (video.videoHeight > 0) {
      setAspectRatio(video.videoWidth / video.videoHeight);
    }

    setIsActive(true);
    return video;
  }

  function stop(): void {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
  }

  // Releasing the camera on unmount is this hook's job: it is the only owner of
  // the stream, so nothing else can know when the hardware is free again.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, []);

  return { videoRef, isActive, aspectRatio, start, stop };
}

/** Resolves once the video has enough data for its dimensions to be real. */
function waitForVideoReady(video: HTMLVideoElement): Promise<void> {
  if (video.readyState >= 2) return Promise.resolve();

  return new Promise((resolve) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
  });
}
