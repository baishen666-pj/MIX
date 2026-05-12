import { useState, useCallback } from "react";
import type { Message } from "../types";
import { ToolEvent } from "./ToolEvent";
import { s } from "../styles";

interface MessageBubbleProps {
  message: Message;
  onRetry?: (content: string) => void;
  onDelete?: (id: string) => void;
}

export function MessageBubble({ message, onRetry, onDelete }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [message.content]);

  return (
    <div
      style={isUser ? s.userBubble : s.botBubble}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {message.content}
      </div>
      {message.toolEvents && message.toolEvents.length > 0 && (
        <div style={s.toolEvents}>
          {message.toolEvents.map((ev, i) => (
            <ToolEvent key={i} event={ev} />
          ))}
        </div>
      )}
      {message.streaming && <span style={s.cursor}>|</span>}
      {hovered && !message.streaming && (
        <div style={s.messageActions}>
          <button onClick={handleCopy} style={s.msgActionBtn}>
            {copied ? "Copied" : "Copy"}
          </button>
          {isUser && onRetry && (
            <button onClick={() => onRetry(message.content)} style={s.msgActionBtn}>
              Retry
            </button>
          )}
          {onDelete && (
            <button onClick={() => onDelete(message.id)} style={s.msgActionBtn}>
              Delete
            </button>
          )}
        </div>
      )}
    </div>
  );
}
