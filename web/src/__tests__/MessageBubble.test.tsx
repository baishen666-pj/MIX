import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageBubble } from "../components/MessageBubble";
import type { Message } from "../types";

describe("MessageBubble", () => {
  it("renders user message", () => {
    const msg: Message = { id: "1", role: "user", content: "Hello" };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders assistant message with markdown", () => {
    const msg: Message = { id: "2", role: "assistant", content: "**bold text**" };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("bold text")).toBeInTheDocument();
  });

  it("renders tool events", () => {
    const msg: Message = {
      id: "3",
      role: "assistant",
      content: "Checking",
      toolEvents: [
        { type: "tool_call", name: "bash", tool_call_id: "tc-1" },
      ],
    };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("> bash")).toBeInTheDocument();
  });

  it("shows streaming cursor when streaming", () => {
    const msg: Message = { id: "4", role: "assistant", content: "Loading", streaming: true };
    render(<MessageBubble message={msg} />);
    expect(screen.getByText("|")).toBeInTheDocument();
  });

  it("shows copy button when not streaming", () => {
    const msg: Message = { id: "5", role: "assistant", content: "Done" };
    render(<MessageBubble message={msg} />);
    expect(screen.getByLabelText("Copy message")).toBeInTheDocument();
  });

  it("shows retry button for user messages when onRetry provided", () => {
    const onRetry = vi.fn();
    const msg: Message = { id: "6", role: "user", content: "Retry me" };
    render(<MessageBubble message={msg} onRetry={onRetry} />);
    const retryBtn = screen.getByLabelText("Retry message");
    fireEvent.click(retryBtn);
    expect(onRetry).toHaveBeenCalledWith("Retry me");
  });

  it("shows delete button when onDelete provided", () => {
    const onDelete = vi.fn();
    const msg: Message = { id: "7", role: "assistant", content: "Bye" };
    render(<MessageBubble message={msg} onDelete={onDelete} />);
    fireEvent.click(screen.getByLabelText("Delete message"));
    expect(onDelete).toHaveBeenCalledWith("7");
  });
});
