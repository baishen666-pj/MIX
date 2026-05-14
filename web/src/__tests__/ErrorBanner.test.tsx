import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorBanner } from "../components/ErrorBanner";

describe("ErrorBanner", () => {
  it("shows error message", () => {
    render(<ErrorBanner message="Something went wrong" onDismiss={vi.fn()} />);
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("calls onDismiss when close button clicked", () => {
    const onDismiss = vi.fn();
    render(<ErrorBanner message="Error" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText("×"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });
});
