import type { ToolEvent as ToolEventType } from "../types";
import { s } from "../styles";

interface ToolEventProps {
  event: ToolEventType;
}

export function ToolEvent({ event }: ToolEventProps) {
  if (event.type === "tool_call") {
    return <div style={s.toolCall}>&gt; {event.name}</div>;
  }
  return (
    <div style={s.toolResult}>
      &lt; {event.name}: {event.content?.slice(0, 100)}
    </div>
  );
}
