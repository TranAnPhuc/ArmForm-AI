import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { SetList } from "./SetList";
import {
  INITIAL_WORKOUT_STATE,
  workoutReducer,
  type CompletedSet,
} from "../features/workout/workoutSession";
import type { RepMetrics } from "../features/exercise/formEvaluation";

const GOOD_REP: RepMetrics = {
  minAngle: 60,
  maxAngle: 150,
  liftingMs: 900,
  loweringMs: 1200,
};

/** Never reached the top: counts as a rep, not as a good one. */
const SHALLOW_REP: RepMetrics = { ...GOOD_REP, minAngle: 90 };

/** Builds sets the same way the app does, through the reducer. */
function completedSets(...reps: RepMetrics[][]): CompletedSet[] {
  let state = workoutReducer(INITIAL_WORKOUT_STATE, { type: "start" });

  for (const setReps of reps) {
    state = workoutReducer(state, {
      type: "finish-set",
      now: 0,
      reps: setReps,
      restMs: 60_000,
    });
    state = workoutReducer(state, { type: "skip-rest" });
  }

  return state.completedSets;
}

describe("SetList", () => {
  it("renders nothing before the first set is finished", () => {
    const { container } = render(<SetList sets={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders one row per set, in order", () => {
    render(
      <SetList sets={completedSets([GOOD_REP, SHALLOW_REP], [GOOD_REP])} />,
    );

    const rows = screen.getAllByRole("row");
    // Two sets, plus the header row.
    expect(rows).toHaveLength(3);

    expect(within(rows[1]).getByText("1")).toBeInTheDocument();
    expect(within(rows[2]).getByText("2")).toBeInTheDocument();
  });

  it("shows the reps, good reps and average range of motion of each set", () => {
    render(<SetList sets={completedSets([GOOD_REP, SHALLOW_REP])} />);

    const row = screen.getAllByRole("row")[1];

    expect(within(row).getByText("2")).toBeInTheDocument();
    expect(within(row).getByText("1 / 2")).toBeInTheDocument();
    // 100% for the full rep, 75% for the shallow one.
    expect(within(row).getByText("88%")).toBeInTheDocument();
  });
});
