import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ChatView } from "../components/ChatView";
import type { Message } from "../types";

describe("ChatView", () => {
  it("renders empty state when no messages", () => {
    render(
      <ChatView messages={[]} connected={true} onSend={vi.fn()} thinking={false} />
    );
    expect(screen.getByText("Send a message to start")).toBeInTheDocument();
  });

  it("renders messages with correct content", () => {
    const messages: Message[] = [
      { id: "1", role: "user", content: "Hello bot" },
      { id: "2", role: "assistant", content: "Hi there!" },
    ];
    render(
      <ChatView messages={messages} connected={true} onSend={vi.fn()} thinking={false} />
    );
    expect(screen.getByText("Hello bot")).toBeInTheDocument();
    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("calls onSend when send button is clicked with text", () => {
    const onSend = vi.fn();
    render(
      <ChatView messages={[]} connected={true} onSend={onSend} thinking={false} />
    );

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "test message" } });
    fireEvent.click(screen.getByText("Send"));

    expect(onSend).toHaveBeenCalledWith("test message");
  });

  it("calls onSend on Enter key", () => {
    const onSend = vi.fn();
    render(
      <ChatView messages={[]} connected={true} onSend={onSend} thinking={false} />
    );

    const input = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.keyDown(input, { key: "Enter", shiftKey: false });

    expect(onSend).toHaveBeenCalledWith("hello");
  });

  it("does not call onSend when input is empty", () => {
    const onSend = vi.fn();
    render(
      <ChatView messages={[]} connected={true} onSend={onSend} thinking={false} />
    );

    fireEvent.click(screen.getByText("Send"));
    expect(onSend).not.toHaveBeenCalled();
  });

  it("disables input when not connected", () => {
    render(
      <ChatView messages={[]} connected={false} onSend={vi.fn()} thinking={false} />
    );

    const input = screen.getByPlaceholderText("Type a message...");
    expect(input).toBeDisabled();
  });

  it("shows thinking animation when thinking is true", () => {
    render(
      <ChatView messages={[]} connected={true} onSend={vi.fn()} thinking={true} />
    );
    // React converts camelCase style properties to kebab-case in the DOM
    const main = screen.getByRole("main");
    expect(main.innerHTML).toContain("animation-delay");
  });

  it("renders tool events in messages", () => {
    const messages: Message[] = [
      {
        id: "1",
        role: "assistant",
        content: "Let me check",
        toolEvents: [
          { type: "tool_call", name: "bash", tool_call_id: "tc-1" },
          { type: "tool_result", name: "bash", content: "output here", tool_call_id: "tc-1" },
        ],
      },
    ];
    render(
      <ChatView messages={messages} connected={true} onSend={vi.fn()} thinking={false} />
    );
    expect(screen.getByText("> bash")).toBeInTheDocument();
    expect(screen.getByText(/bash: output here/)).toBeInTheDocument();
  });

  it("clears input after sending", () => {
    const onSend = vi.fn();
    render(
      <ChatView messages={[]} connected={true} onSend={onSend} thinking={false} />
    );

    const input = screen.getByPlaceholderText("Type a message...") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "hello" } });
    fireEvent.click(screen.getByText("Send"));

    expect(input.value).toBe("");
  });
});
