import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
});
