import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ToolEvent } from "../components/ToolEvent";
import type { ToolEvent as ToolEventType } from "../types";

describe("ToolEvent", () => {
  it("renders tool_call event with name prefix", () => {
    const event: ToolEventType = { type: "tool_call", name: "bash", tool_call_id: "tc-1" };
    render(<ToolEvent event={event} />);
    expect(screen.getByText("> bash")).toBeInTheDocument();
  });

  it("renders tool_result event with content preview", () => {
    const event: ToolEventType = { type: "tool_result", name: "python", content: "Hello World output", tool_call_id: "tc-2" };
    render(<ToolEvent event={event} />);
    expect(screen.getByText(/python: Hello World output/)).toBeInTheDocument();
  });

  it("truncates long tool_result content to 100 chars", () => {
    const longContent = "x".repeat(200);
    const event: ToolEventType = { type: "tool_result", name: "bash", content: longContent, tool_call_id: "tc-3" };
    render(<ToolEvent event={event} />);
    const text = screen.getByText(/bash:/).textContent;
    expect(text!.length).toBeLessThan(120);
  });
});
