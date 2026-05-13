import { useState, useRef, useEffect } from "react";
import type { Message } from "../types";
import { MessageBubble } from "./MessageBubble";
import { useVoiceInput } from "../hooks/useVoiceInput";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleTranscription = (text: string) => {
    if (text.trim()) onSend(text.trim());
  };

  const { recording, startRecording, stopRecording, error: voiceError } = useVoiceInput(handleTranscription);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 150) + "px";
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text || !connected) return;
    onSend(text);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const toggleVoice = () => {
    if (recording) stopRecording();
    else startRecording();
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
        {voiceError && <div style={{ color: "var(--color-error, red)", textAlign: "center", padding: 4, fontSize: "var(--font-size-sm)" }}>{voiceError}</div>}
        <div ref={messagesEndRef} />
      </main>
      <footer style={s.inputBar}>
        <button
          style={recording ? s.voiceBtnActive : s.voiceBtn}
          onClick={toggleVoice}
          disabled={!connected}
          title={recording ? "Stop recording" : "Voice input"}
          aria-label={recording ? "Stop recording" : "Voice input"}
        >
          {recording ? "●" : "🎤"}
        </button>
        <textarea
          ref={textareaRef}
          style={s.textarea}
          className="focus-ring"
          value={input}
          rows={1}
          onChange={(e) => { setInput(e.target.value); autoResize(); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Type a message... (Shift+Enter for new line)"
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
