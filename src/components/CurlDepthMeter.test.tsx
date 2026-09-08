import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { CurlDepthMeter } from "./CurlDepthMeter";

describe("CurlDepthMeter", () => {
  it("shows a dash when nothing is being tracked", () => {
    render(<CurlDepthMeter depthPercent={null} phase="unknown" />);

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuetext",
      "Not tracking",
    );
  });

  it("shows how deep the curl currently is", () => {
    render(<CurlDepthMeter depthPercent={62} phase="lifting" />);

    expect(screen.getByText("62%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "62",
    );
  });

  it("says when the curl is deep enough to count", () => {
    render(<CurlDepthMeter depthPercent={100} phase="up" />);

    expect(screen.getByText(/deep enough/i)).toBeInTheDocument();
  });

  it("does not claim deep enough while the curl is short", () => {
    // The exact case the diagnostic caught: a curl that stops just short.
    render(<CurlDepthMeter depthPercent={94} phase="lifting" />);

    expect(screen.queryByText(/deep enough/i)).not.toBeInTheDocument();
  });

  it("explains what makes a rep count", () => {
    render(<CurlDepthMeter depthPercent={0} phase="down" />);

    expect(screen.getByText(/a rep counts once/i)).toBeInTheDocument();
  });

  it("exposes the range to assistive technology", () => {
    render(<CurlDepthMeter depthPercent={40} phase="lifting" />);
    const bar = screen.getByRole("progressbar");

    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar).toHaveAccessibleName(/curl depth/i);
  });
});
