import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { RepList } from "./RepList";
import { createRepEntry } from "../features/workout/repHistory";
import type { RepMetrics } from "../features/exercise/formEvaluation";

/** Full range, controlled tempo: the evaluator finds nothing to complain about. */
const CLEAN_REP: RepMetrics = {
  minAngle: 60,
  maxAngle: 150,
  liftingMs: 900,
  loweringMs: 1200,
};

/** Never reached the top, so the evaluator asks for a higher curl. */
const SHALLOW_REP: RepMetrics = {
  minAngle: 90,
  maxAngle: 150,
  liftingMs: 900,
  loweringMs: 1200,
};

describe("RepList", () => {
  it("renders nothing before the first rep", () => {
    const { container } = render(<RepList entries={[]} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("renders one row per completed rep, in order", () => {
    render(
      <RepList
        entries={[createRepEntry(1, CLEAN_REP), createRepEntry(2, SHALLOW_REP)]}
      />,
    );

    // One row per rep, plus the header row.
    const rows = screen.getAllByRole("row");
    expect(rows).toHaveLength(3);

    expect(within(rows[1]).getByText("Good rep")).toBeInTheDocument();
    expect(
      within(rows[2]).getByText("Curl slightly higher"),
    ).toBeInTheDocument();
  });

  it("shows the range-of-motion score and phase durations of each rep", () => {
    render(<RepList entries={[createRepEntry(1, SHALLOW_REP)]} />);

    const row = screen.getAllByRole("row")[1];

    expect(within(row).getByText("75%")).toBeInTheDocument();
    expect(within(row).getByText("0.9s")).toBeInTheDocument();
    expect(within(row).getByText("1.2s")).toBeInTheDocument();
  });

  it("shows a dash for a phase that could not be timed", () => {
    const untimed: RepMetrics = { ...CLEAN_REP, liftingMs: null };

    render(<RepList entries={[createRepEntry(1, untimed)]} />);

    const row = screen.getAllByRole("row")[1];
    expect(within(row).getByText("—")).toBeInTheDocument();
  });
});
