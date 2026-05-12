import type { Message } from "../types";
import { ToolEvent } from "./ToolEvent";
import { s } from "../styles";

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
