import { useState, useRef, useEffect } from "react";
import type { Message } from "../types";

interface ChatViewProps {
  messages: Message[];
  connected: boolean;
  onSend: (text: string) => void;
  thinking: boolean;
}

export function ChatView({ messages, connected, onSend, thinking }: ChatViewProps) {
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || !connected) return;
    onSend(text);
    setInput("");
  };

  return (
    <>
      <main style={s.messages}>
        {messages.length === 0 && !thinking && <div style={s.empty}>Send a message to start</div>}
        {messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}
        {thinking && (
          <div style={s.thinkingDots}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ ...s.dot, animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>
      <footer style={s.inputBar}>
        <input
          style={s.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Type a message..."
          disabled={!connected}
        />
        <button
          style={connected && input.trim() ? s.sendBtn : s.sendBtnDisabled}
          onClick={handleSend}
          disabled={!connected || !input.trim()}
        >
          Send
        </button>
      </footer>
    </>
  );
}

function MessageRow({ message }: { message: Message }) {
  const isUser = message.role === "user";
  return (
    <div style={isUser ? s.userBubble : s.botBubble}>
      <div>{message.content}</div>
      {message.toolEvents && message.toolEvents.length > 0 && (
        <div style={s.toolEvents}>
          {message.toolEvents.map((ev, i) => {
            if (ev.type === "tool_call") return <div key={i} style={s.toolCall}>&gt; {ev.name}</div>;
            return <div key={i} style={s.toolResult}>&lt; {ev.name}: {ev.content?.slice(0, 100)}</div>;
          })}
        </div>
      )}
      {message.streaming && <span style={s.cursor}>|</span>}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  messages: { flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 12 },
  empty: { margin: "auto", color: "#525252", fontSize: 14 },
  userBubble: { alignSelf: "flex-end", background: "#2563eb", color: "#fff", padding: "10px 16px", borderRadius: 16, maxWidth: "70%", fontSize: 14, lineHeight: 1.5 },
  botBubble: { alignSelf: "flex-start", background: "#1a1a1a", border: "1px solid #262626", padding: "10px 16px", borderRadius: 16, maxWidth: "70%", fontSize: 14, lineHeight: 1.5, whiteSpace: "pre-wrap" },
  toolEvents: { marginTop: 8, fontSize: 12, fontFamily: "monospace", display: "flex", flexDirection: "column", gap: 2 },
  toolCall: { color: "#facc15", padding: "2px 8px", background: "#1c1917", borderRadius: 4 },
  toolResult: { color: "#4ade80", padding: "2px 8px", background: "#0c1a0c", borderRadius: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  cursor: { animation: "blink 1s step-end infinite" },
  inputBar: { display: "flex", gap: 8, padding: "12px 20px", borderTop: "1px solid #262626" },
  input: { flex: 1, background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", color: "#e5e5e5", fontSize: 14, outline: "none" },
  sendBtn: { background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  sendBtnDisabled: { background: "#1a1a1a", color: "#525252", border: "1px solid #333", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "not-allowed" },
  thinkingDots: { display: "flex", gap: 4, padding: "10px 16px", alignSelf: "flex-start" },
  dot: { width: 6, height: 6, borderRadius: "50%", background: "#525252", animation: "pulse 1.4s ease-in-out infinite" },
};
