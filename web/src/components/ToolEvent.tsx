import type { ToolEvent as ToolEventType } from "../types";

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

const s = {
  toolCall: { color: "#facc15", padding: "2px 8px", background: "#1c1917", borderRadius: 4, fontSize: 12, fontFamily: "monospace" } as React.CSSProperties,
  toolResult: { color: "#4ade80", padding: "2px 8px", background: "#0c1a0c", borderRadius: 4, fontSize: 12, fontFamily: "monospace", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as React.CSSProperties,
};
