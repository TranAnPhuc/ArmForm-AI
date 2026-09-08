import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

describe("App", () => {
  it("renders the ArmForm AI screen", () => {
    render(<App />);

    expect(screen.getByText("ArmForm AI")).toBeInTheDocument();
    expect(screen.getByText("Biceps Curl Form Tracker")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Start Workout" }),
    ).toBeInTheDocument();
  });

  it("shows the setup guide before the first workout", () => {
    render(<App />);

    expect(screen.getByText(/stand side-on/i)).toBeInTheDocument();
  });

  it("marks the selected arm as pressed", () => {
    render(<App />);

    // Right is the default.
    expect(screen.getByRole("button", { name: /right arm/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /left arm/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("moves the pressed state when the other arm is chosen", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: /left arm/i }));

    expect(screen.getByRole("button", { name: /left arm/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /right arm/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("starts on set 1 with no reps", () => {
    render(<App />);

    expect(screen.getByText("Set")).toBeInTheDocument();
    expect(screen.getByText("Reps")).toBeInTheDocument();
  });

  it("does not show a tracking indicator before the camera starts", () => {
    render(<App />);

    expect(screen.queryByText("Tracking")).not.toBeInTheDocument();
    expect(screen.queryByText("No person")).not.toBeInTheDocument();
  });
});
