import type { Message } from "../types";
import { ToolEvent } from "./ToolEvent";

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user";
  return (
    <div style={isUser ? s.userBubble : s.botBubble}>
      <div>{message.content}</div>
      {message.toolEvents && message.toolEvents.length > 0 && (
        <div style={s.toolEvents}>
          {message.toolEvents.map((ev, i) => (
            <ToolEvent key={i} event={ev} />
          ))}
        </div>
      )}
      {message.streaming && <span style={s.cursor}>|</span>}
    </div>
  );
}

const s = {
  userBubble: { alignSelf: "flex-end", background: "#2563eb", color: "#fff", padding: "10px 16px", borderRadius: 16, maxWidth: "70%", fontSize: 14, lineHeight: 1.5 } as React.CSSProperties,
  botBubble: { alignSelf: "flex-start", background: "#1a1a1a", border: "1px solid #262626", padding: "10px 16px", borderRadius: 16, maxWidth: "70%", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" } as React.CSSProperties,
  toolEvents: { marginTop: 8, fontSize: 12, fontFamily: "monospace", display: "flex", flexDirection: "column", gap: 2 } as React.CSSProperties,
  cursor: { animation: "blink 1s step-end infinite" } as React.CSSProperties,
};
