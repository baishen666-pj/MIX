import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { EmptyState } from "../components/EmptyState";

describe("EmptyState", () => {
  it("renders icon, title, and description", () => {
    render(<EmptyState icon="⚡" title="No data" description="Try again later" />);
    expect(screen.getByText("⚡")).toBeInTheDocument();
    expect(screen.getByText("No data")).toBeInTheDocument();
    expect(screen.getByText("Try again later")).toBeInTheDocument();
  });

  it("renders with different icons", () => {
    const { rerender } = render(<EmptyState icon="🔍" title="Search" description="No results" />);
    expect(screen.getByText("🔍")).toBeInTheDocument();
    rerender(<EmptyState icon="💬" title="Chat" description="Start talking" />);
    expect(screen.getByText("💬")).toBeInTheDocument();
  });
});
