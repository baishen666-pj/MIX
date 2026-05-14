import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmDialog } from "../components/ConfirmDialog";

describe("ConfirmDialog", () => {
  it("shows message and buttons", () => {
    render(<ConfirmDialog message="Delete this item?" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("Delete this item?")).toBeInTheDocument();
    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button clicked", () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog message="Sure?" onConfirm={onConfirm} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByText("Delete"));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it("calls onCancel when cancel button clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog message="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("calls onCancel when backdrop clicked", () => {
    const onCancel = vi.fn();
    render(<ConfirmDialog message="Sure?" onConfirm={vi.fn()} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("alertdialog").parentElement!);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("supports custom confirm label", () => {
    render(<ConfirmDialog message="Sure?" confirmLabel="Yes, remove" onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("Yes, remove")).toBeInTheDocument();
  });
});
