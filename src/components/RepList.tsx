import type { RepEntry } from "../features/workout/repHistory";
import { formatSeconds } from "../features/workout/duration";

interface RepListProps {
  entries: RepEntry[];
}

/**
 * Every completed rep of the current session, newest at the bottom.
 *
 * The counter alone tells the user how many reps happened but not which ones
 * were sloppy. This is where a set becomes reviewable: one row per rep, with
 * the same verdict the live feedback gave at the time.
 */
export function RepList({ entries }: RepListProps) {
  if (entries.length === 0) return null;

  return (
    <section className="w-full max-w-xl rounded-lg border border-slate-800 p-4">
      <h2 className="mb-3 text-lg font-semibold">Completed reps</h2>

      {/* The table must scroll inside its own box rather than widen the page. */}
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-950 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="py-1 pr-2 font-medium">
                #
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                ROM
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                Lift
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                Lower
              </th>
              <th scope="col" className="py-1 font-medium">
                Feedback
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const isClean = entry.evaluation.issues.length === 0;

              return (
                <tr key={entry.number} className="border-t border-slate-800">
                  <td className="py-1 pr-2 tabular-nums text-slate-400">
                    {entry.number}
                  </td>
                  <td className="py-1 pr-2 tabular-nums">
                    {entry.evaluation.romScore}%
                  </td>
                  <td className="py-1 pr-2 tabular-nums">
                    {formatSeconds(entry.metrics.liftingMs)}
                  </td>
                  <td className="py-1 pr-2 tabular-nums">
                    {formatSeconds(entry.metrics.loweringMs)}
                  </td>
                  <td
                    className={
                      isClean ? "py-1 text-emerald-300" : "py-1 text-amber-300"
                    }
                  >
                    {entry.evaluation.message}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
