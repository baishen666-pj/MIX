import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryView } from "../components/MemoryView";
import type { MemoryEntry } from "../types";

describe("MemoryView", () => {
  it("shows loading state", () => {
    render(<MemoryView memories={[]} loading={true} error={null} onSearch={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText("Searching...")).toBeInTheDocument();
  });

  it("shows error message", () => {
    render(<MemoryView memories={[]} loading={false} error="Search failed" onSearch={vi.fn()} onRefresh={vi.fn()} />);
    expect(screen.getByText("Search failed")).toBeInTheDocument();
  });

  it("renders memory entries", () => {
    const memories: MemoryEntry[] = [
      {
        id: "m1",
        type: "fact",
        content: "User prefers dark mode",
        tags: ["ui", "preference"],
        created_at: "2026-01-15T10:00:00Z",
      },
    ];
    render(<MemoryView memories={memories} loading={false} error={null} onSearch={vi.fn()} onRefresh={vi.fn()} />);

    expect(screen.getByText("fact")).toBeInTheDocument();
    expect(screen.getByText(/User prefers dark mode/)).toBeInTheDocument();
    expect(screen.getByText("ui, preference")).toBeInTheDocument();
  });

  it("calls onSearch when search button is clicked", () => {
    const onSearch = vi.fn();
    render(<MemoryView memories={[]} loading={false} error={null} onSearch={onSearch} onRefresh={vi.fn()} />);

    const input = screen.getByPlaceholderText("Search memories...");
    fireEvent.change(input, { target: { value: "dark mode" } });
    fireEvent.click(screen.getByText("Search"));

    expect(onSearch).toHaveBeenCalledWith("dark mode");
  });

  it("calls onSearch on Enter key", () => {
    const onSearch = vi.fn();
    render(<MemoryView memories={[]} loading={false} error={null} onSearch={onSearch} onRefresh={vi.fn()} />);

    const input = screen.getByPlaceholderText("Search memories...");
    fireEvent.change(input, { target: { value: "test query" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSearch).toHaveBeenCalledWith("test query");
  });

  it("does not search with empty query", () => {
    const onSearch = vi.fn();
    render(<MemoryView memories={[]} loading={false} error={null} onSearch={onSearch} onRefresh={vi.fn()} />);

    fireEvent.click(screen.getByText("Search"));
    expect(onSearch).not.toHaveBeenCalled();
  });

  it("filters by type", () => {
    const memories: MemoryEntry[] = [
      { id: "m1", type: "fact", content: "fact 1", tags: [], created_at: "2026-01-01T00:00:00Z" },
      { id: "m2", type: "preference", content: "pref 1", tags: [], created_at: "2026-01-01T00:00:00Z" },
    ];
    render(<MemoryView memories={memories} loading={false} error={null} onSearch={vi.fn()} onRefresh={vi.fn()} />);

    // Both visible initially
    expect(screen.getByText("fact 1")).toBeInTheDocument();
    expect(screen.getByText("pref 1")).toBeInTheDocument();

    // Filter to preference only
    const select = screen.getByDisplayValue("All types");
    fireEvent.change(select, { target: { value: "preference" } });

    expect(screen.queryByText("fact 1")).not.toBeInTheDocument();
    expect(screen.getByText("pref 1")).toBeInTheDocument();
  });

  it("shows Load more button when entries exceed page size", () => {
    const memories: MemoryEntry[] = Array.from({ length: 15 }, (_, i) => ({
      id: `m${i}`,
      type: "fact",
      content: `Memory ${i}`,
      tags: [],
      created_at: "2026-01-01T00:00:00Z",
    }));
    render(<MemoryView memories={memories} loading={false} error={null} onSearch={vi.fn()} onRefresh={vi.fn()} />);

    expect(screen.getByText(/Load more.*5 remaining/)).toBeInTheDocument();
  });
});
