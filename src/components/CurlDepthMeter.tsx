/**
 * How deep the current curl is, against the depth a rep actually requires.
 *
 * A rep only counts once the elbow passes the contraction threshold. Without
 * seeing that line, a curl that stops just short looks identical to one that
 * counts — the rep simply never appears, with no explanation. Showing the
 * target turns an invisible rule into something the user can aim at.
 */

import type { CurlPhase } from "../features/exercise/curlStateMachine";

interface CurlDepthMeterProps {
  /** 0 at full extension, 100 at the depth a rep needs. Null when untracked. */
  depthPercent: number | null;
  phase: CurlPhase;
}

export function CurlDepthMeter({ depthPercent, phase }: CurlDepthMeterProps) {
  const reached = depthPercent !== null && depthPercent >= 100;
  const isLifting = phase === "lifting" || phase === "up";

  return (
    <div className="w-full max-w-xl">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        <span className="uppercase tracking-wide text-slate-400">
          Curl depth
        </span>
        <span
          className={`font-mono tabular-nums ${
            reached ? "text-emerald-300" : "text-slate-400"
          }`}
        >
          {depthPercent === null ? "—" : `${depthPercent}%`}
          {reached && <span className="ml-1">deep enough</span>}
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Curl depth toward a counted rep"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={depthPercent ?? 0}
        aria-valuetext={
          depthPercent === null
            ? "Not tracking"
            : `${depthPercent} percent${reached ? ", deep enough to count" : ""}`
        }
        className="relative h-2.5 w-full overflow-hidden rounded-full bg-slate-800"
      >
        <div
          className={`h-full transition-[width] duration-100 ${
            reached
              ? "bg-emerald-400"
              : isLifting
                ? "bg-indigo-400"
                : "bg-slate-600"
          }`}
          style={{ width: `${depthPercent ?? 0}%` }}
        />
      </div>

      <p className="mt-1 text-xs text-slate-500">
        A rep counts once the curl reaches 100% and the arm returns to full
        extension.
      </p>
    </div>
  );
}
