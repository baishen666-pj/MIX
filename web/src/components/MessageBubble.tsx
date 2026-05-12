import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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

  const handleCopyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
  }, []);

  return (
    <div
      style={isUser ? s.userBubble : s.botBubble}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {isUser ? (
        <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
          {message.content}
        </div>
      ) : (
        <div className="markdown-body">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const isInline = !className;
                const codeStr = String(children).replace(/\n$/, "");
                if (isInline) {
                  return <code style={s.inlineCode} {...props}>{children}</code>;
                }
                return (
                  <div style={{ position: "relative" }}>
                    <button
                      onClick={() => handleCopyCode(codeStr)}
                      style={s.codeCopyBtn}
                      title="Copy code"
                    >
                      Copy
                    </button>
                    <pre style={s.codeBlock}>
                      <code className={className} {...props}>{children}</code>
                    </pre>
                  </div>
                );
              },
              pre({ children }) {
                return <>{children}</>;
              },
              a({ href, children }) {
                return (
                  <a href={href} target="_blank" rel="noopener noreferrer" style={s.mdLink}>
                    {children}
                  </a>
                );
              },
              table({ children }) {
                return (
                  <div style={{ overflowX: "auto" }}>
                    <table style={s.mdTable}>{children}</table>
                  </div>
                );
              },
              blockquote({ children }) {
                return <blockquote style={s.mdBlockquote}>{children}</blockquote>;
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      )}
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
