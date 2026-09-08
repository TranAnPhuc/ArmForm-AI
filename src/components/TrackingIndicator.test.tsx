import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TrackingIndicator } from "./TrackingIndicator";

describe("TrackingIndicator", () => {
  it("shows nothing while the loop is idle", () => {
    const { container } = render(<TrackingIndicator status="idle" />);

    expect(container).toBeEmptyDOMElement();
  });

  it("reports that tracking is working", () => {
    render(<TrackingIndicator status="tracking" />);

    expect(screen.getByRole("status")).toHaveTextContent("Tracking");
  });

  it("tells the user how to fix an unclear arm", () => {
    render(<TrackingIndicator status="arm-unclear" />);

    expect(screen.getByRole("status")).toHaveTextContent("Arm unclear");
    expect(screen.getByRole("status")).toHaveTextContent(/side-on/i);
  });

  it("tells the user to step into view when nobody is detected", () => {
    render(<TrackingIndicator status="no-person" />);

    expect(screen.getByRole("status")).toHaveTextContent("No person");
  });

  it("announces changes politely rather than interrupting", () => {
    render(<TrackingIndicator status="tracking" />);

    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });

  it("distinguishes states by text, not colour alone", () => {
    const { rerender } = render(<TrackingIndicator status="tracking" />);
    const tracking = screen.getByRole("status").textContent;

    rerender(<TrackingIndicator status="no-person" />);
    const noPerson = screen.getByRole("status").textContent;

    expect(tracking).not.toEqual(noPerson);
  });
});
