import type { CompletedSet } from "../features/workout/workoutSession";

interface SetListProps {
  sets: CompletedSet[];
}

/**
 * Every completed set of the workout.
 *
 * The rep list answers "how was that rep"; this answers "how is the workout
 * going" — the question set 3 raises when it is noticeably worse than set 1.
 */
export function SetList({ sets }: SetListProps) {
  if (sets.length === 0) return null;

  return (
    <section className="w-full max-w-xl rounded-lg border border-slate-800 p-4">
      <h2 className="mb-3 text-lg font-semibold">Sets</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="py-1 pr-2 font-medium">
                Set
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                Reps
              </th>
              <th scope="col" className="py-1 pr-2 font-medium">
                Good
              </th>
              <th scope="col" className="py-1 font-medium">
                Avg ROM
              </th>
            </tr>
          </thead>
          <tbody>
            {sets.map((set) => (
              <tr key={set.number} className="border-t border-slate-800">
                <td className="py-1 pr-2 tabular-nums text-slate-400">
                  {set.number}
                </td>
                <td className="py-1 pr-2 tabular-nums">
                  {set.summary.totalReps}
                </td>
                <td className="py-1 pr-2 tabular-nums">
                  {set.summary.goodReps} / {set.summary.totalReps}
                </td>
                <td className="py-1 tabular-nums">
                  {set.summary.averageRomScore}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
