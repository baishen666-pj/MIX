import { useState, useRef, useEffect, useCallback } from "react";

type Tab = "chat" | "skills" | "memory" | "settings";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  toolEvents?: ToolEvent[];
}

interface ToolEvent {
  type: "tool_call" | "tool_result";
  name?: string;
  content?: string;
  tool_call_id?: string;
}

interface Skill {
  name: string;
  version: string;
  description: string;
  trigger: string[];
  handler: string;
}

interface MemoryEntry {
  id: string;
  type: string;
  content: string;
  tags: string[];
  created_at: string;
}

interface StreamChunk {
  id: string;
  session_id: string;
  delta: string;
  done: boolean;
  type?: string;
  tool_call?: { function: { name: string; arguments: string } };
  tool_call_id?: string;
  name?: string;
  content?: string;
  tool_calls?: unknown[];
}

export function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string>("");
  const [connected, setConnected] = useState(false);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const apiBase = "";

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/skills`);
      const data = await res.json();
      setSkills(data.skills || []);
    } catch { /* ignore */ }
  }, []);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch(`${apiBase}/api/health`);
      const data = await res.json();
      setSettings(data);
    } catch { /* ignore */ }
  }, []);

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
      const chunk: StreamChunk = JSON.parse(event.data as string);
      if (chunk.session_id && !sessionId) {
        setSessionId(chunk.session_id);
      }

      setMessages((prev) => {
        const last = prev[prev.length - 1];

        if (chunk.type === "tool_call" && last?.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              toolEvents: [...(last.toolEvents || []), { type: "tool_call", name: chunk.tool_call?.function?.name }],
            },
          ];
        }

        if (chunk.type === "tool_result" && last?.role === "assistant") {
          return [
            ...prev.slice(0, -1),
            {
              ...last,
              toolEvents: [
                ...(last.toolEvents || []),
                { type: "tool_result", name: chunk.name, content: chunk.content },
              ],
            },
          ];
        }

        if (last?.role === "assistant" && last.streaming) {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + (chunk.delta || ""), streaming: !chunk.done },
          ];
        }
        if (chunk.delta) {
          return [
            ...prev,
            { id: chunk.id, role: "assistant", content: chunk.delta, streaming: !chunk.done, toolEvents: [] },
          ];
        }
        return prev;
      });
    };

    wsRef.current = ws;
  }, [sessionId]);

  useEffect(() => {
    connect();
    fetchSkills();
    fetchSettings();
    return () => wsRef.current?.close();
  }, [connect, fetchSkills, fetchSettings]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = () => {
    const text = input.trim();
    if (!text || !wsRef.current) return;
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: "user", content: text }]);
    setInput("");
    wsRef.current.send(JSON.stringify({ message: text, session_id: sessionId || undefined }));
  };

  const searchMemory = async () => {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`${apiBase}/api/memory/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, limit: 20 }),
      });
      const data = await res.json();
      setMemories(data);
    } catch { /* ignore */ }
  };

  return (
    <div style={s.container}>
      <header style={s.header}>
        <h1 style={s.title}>MIX</h1>
        <nav style={s.nav}>
          {(["chat", "skills", "memory", "settings"] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={tab === t ? s.navActive : s.navBtn}>
              {t}
            </button>
          ))}
        </nav>
        <span style={s.status}>{connected ? "on" : "off"}</span>
      </header>

      {tab === "chat" && (
        <>
          <main style={s.messages}>
            {messages.length === 0 && <div style={s.empty}>Send a message to start</div>}
            {messages.map((msg) => (
              <div key={msg.id} style={msg.role === "user" ? s.userBubble : s.botBubble}>
                <div>{msg.content}</div>
                {msg.toolEvents && msg.toolEvents.length > 0 && (
                  <div style={s.toolEvents}>
                    {msg.toolEvents.map((ev, i) => (
                      <div key={i} style={ev.type === "tool_call" ? s.toolCall : s.toolResult}>
                        {ev.type === "tool_call" ? `> ${ev.name}` : `< ${ev.name}: ${ev.content?.slice(0, 100)}`}
                      </div>
                    ))}
                  </div>
                )}
                {msg.streaming && <span style={s.cursor}>|</span>}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </main>
          <footer style={s.inputBar}>
            <input style={s.input} value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()} placeholder="Type a message..." disabled={!connected} />
            <button style={s.sendBtn} onClick={send} disabled={!connected || !input.trim()}>Send</button>
          </footer>
        </>
      )}

      {tab === "skills" && (
        <main style={s.panel}>
          <h2 style={s.panelTitle}>Skills</h2>
          {skills.length === 0 ? <p style={s.empty}>No skills loaded</p> : skills.map((sk) => (
            <div key={sk.name} style={s.card}>
              <div style={s.cardHeader}>{sk.name} <span style={s.badge}>{sk.version}</span></div>
              <div style={s.cardDesc}>{sk.description}</div>
              <div style={s.cardTriggers}>{sk.trigger.map((t) => <code key={t}>{t}</code>)}</div>
            </div>
          ))}
        </main>
      )}

      {tab === "memory" && (
        <main style={s.panel}>
          <h2 style={s.panelTitle}>Memory</h2>
          <div style={s.searchBar}>
            <input style={s.input} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchMemory()} placeholder="Search memories..." />
            <button style={s.sendBtn} onClick={searchMemory}>Search</button>
          </div>
          {memories.map((m) => (
            <div key={m.id} style={s.card}>
              <div style={s.cardHeader}>{m.type} <span style={s.badge}>{m.tags.join(", ") || "no tags"}</span></div>
              <div style={s.cardDesc}>{m.content.slice(0, 200)}</div>
              <div style={s.cardMeta}>{new Date(m.created_at).toLocaleString()}</div>
            </div>
          ))}
        </main>
      )}

      {tab === "settings" && (
        <main style={s.panel}>
          <h2 style={s.panelTitle}>System Status</h2>
          <pre style={s.pre}>{JSON.stringify(settings, null, 2)}</pre>
        </main>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  container: { maxWidth: 800, margin: "0 auto", height: "100vh", display: "flex", flexDirection: "column", fontFamily: "system-ui, -apple-system, sans-serif", background: "#0a0a0a", color: "#e5e5e5" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: "1px solid #262626" },
  title: { margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: 2, color: "#fff" },
  nav: { display: "flex", gap: 4 },
  navBtn: { background: "none", border: "none", color: "#737373", padding: "6px 12px", fontSize: 13, cursor: "pointer", borderRadius: 6 },
  navActive: { background: "#1a1a1a", border: "1px solid #333", color: "#fff", padding: "6px 12px", fontSize: 13, cursor: "pointer", borderRadius: 6 },
  status: { fontSize: 11, color: "#525252" },
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
  panel: { flex: 1, overflowY: "auto", padding: 20 },
  panelTitle: { margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#fff" },
  searchBar: { display: "flex", gap: 8, marginBottom: 16 },
  card: { background: "#1a1a1a", border: "1px solid #262626", borderRadius: 10, padding: 14, marginBottom: 10 },
  cardHeader: { fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 },
  badge: { fontSize: 11, background: "#262626", color: "#a3a3a3", padding: "2px 8px", borderRadius: 4 },
  cardDesc: { fontSize: 13, color: "#a3a3a3", lineHeight: 1.4 },
  cardTriggers: { marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" },
  cardMeta: { fontSize: 11, color: "#525252", marginTop: 4 },
  pre: { background: "#1a1a1a", border: "1px solid #262626", borderRadius: 8, padding: 16, fontSize: 13, overflow: "auto", color: "#a3a3a3" },
};
