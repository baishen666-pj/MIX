import { useState, useRef, useEffect, useCallback } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
}

interface StreamChunk {
  id: string;
  session_id: string;
  delta: string;
  done: boolean;
}

export function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const ws = new WebSocket(`${protocol}//${host}/ws/chat`);

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connect, 3000);
    };

    ws.onmessage = (event) => {
      const chunk: StreamChunk = JSON.parse(event.data);
      if (chunk.session_id && !sessionId) {
        setSessionId(chunk.session_id);
      }

      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant" && last.streaming) {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              content: last.content + chunk.delta,
              streaming: !chunk.done,
            },
          ];
        }
        if (chunk.delta) {
          return [
            ...prev,
            { id: chunk.id, role: "assistant", content: chunk.delta, streaming: !chunk.done },
          ];
        }
        return prev;
      });
    };

    wsRef.current = ws;
  }, [sessionId]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
  }, [connect]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || !wsRef.current) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    wsRef.current.send(JSON.stringify({
      message: text,
      session_id: sessionId || undefined,
    }));
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>MIX</h1>
        <span style={styles.status}>{connected ? "connected" : "disconnected"}</span>
      </header>

      <main style={styles.messages}>
        {messages.length === 0 && (
          <div style={styles.empty}>Send a message to start chatting</div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} style={msg.role === "user" ? styles.userBubble : styles.assistantBubble}>
            {msg.content}
            {msg.streaming && <span style={styles.cursor}>|</span>}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer style={styles.inputBar}>
        <input
          style={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Type a message..."
          disabled={!connected}
        />
        <button style={styles.sendBtn} onClick={send} disabled={!connected || !input.trim()}>
          Send
        </button>
      </footer>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 800,
    margin: "0 auto",
    height: "100vh",
    display: "flex",
    flexDirection: "column",
    fontFamily: "system-ui, -apple-system, sans-serif",
    background: "#0a0a0a",
    color: "#e5e5e5",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 20px",
    borderBottom: "1px solid #262626",
  },
  title: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
    letterSpacing: 2,
    color: "#fff",
  },
  status: {
    fontSize: 12,
    color: "#737373",
    textTransform: "uppercase",
  },
  messages: {
    flex: 1,
    overflowY: "auto",
    padding: 20,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  empty: {
    margin: "auto",
    color: "#525252",
    fontSize: 14,
  },
  userBubble: {
    alignSelf: "flex-end",
    background: "#2563eb",
    color: "#fff",
    padding: "10px 16px",
    borderRadius: 16,
    maxWidth: "70%",
    fontSize: 14,
    lineHeight: 1.5,
  },
  assistantBubble: {
    alignSelf: "flex-start",
    background: "#1a1a1a",
    border: "1px solid #262626",
    padding: "10px 16px",
    borderRadius: 16,
    maxWidth: "70%",
    fontSize: 14,
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  },
  cursor: {
    animation: "blink 1s step-end infinite",
  },
  inputBar: {
    display: "flex",
    gap: 8,
    padding: "12px 20px",
    borderTop: "1px solid #262626",
  },
  input: {
    flex: 1,
    background: "#1a1a1a",
    border: "1px solid #333",
    borderRadius: 8,
    padding: "10px 14px",
    color: "#e5e5e5",
    fontSize: 14,
    outline: "none",
  },
  sendBtn: {
    background: "#2563eb",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
};
