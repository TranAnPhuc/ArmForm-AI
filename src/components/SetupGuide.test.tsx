import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SetupGuide } from "./SetupGuide";

describe("SetupGuide", () => {
  it("tells the user to stand side-on", () => {
    render(<SetupGuide />);

    expect(screen.getByText(/stand side-on/i)).toBeInTheDocument();
  });

  it("lists the steps in order", () => {
    render(<SetupGuide />);

    expect(screen.getByRole("list")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("states that video never leaves the device", () => {
    render(<SetupGuide />);

    expect(
      screen.getByText(/processed entirely on your device/i),
    ).toBeInTheDocument();
  });
});
