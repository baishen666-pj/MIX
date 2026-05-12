import { useState, useRef, useEffect } from "react";
import type { Message } from "../types";
import { MessageBubble } from "./MessageBubble";
import { s } from "../styles";

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
        {messages.map((msg, i) => (
          <div key={msg.id} className="msg-fade-in" style={{ animationDelay: `${Math.min(i * 0.03, 0.15)}s` }}>
            <MessageBubble message={msg} />
          </div>
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
          className="focus-ring"
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
