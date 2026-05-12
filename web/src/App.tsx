import { useState, useCallback } from "react";
import type { Tab, MemoryEntry, Skill } from "./types";
import { useWebSocket } from "./hooks/useWebSocket";
import { useApi, usePostApi } from "./hooks/useApi";
import { ChatView } from "./components/ChatView";
import { SkillsView } from "./components/SkillsView";
import { MemoryView } from "./components/MemoryView";
import { SettingsView } from "./components/SettingsView";
import { ErrorBanner } from "./components/ErrorBanner";

const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/chat`;

export function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [apiError, setApiError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);

  const { messages, connected, send } = useWebSocket(WS_URL);
  const { data: skillsData, loading: skillsLoading, error: skillsError } = useApi<Skill[]>("/api/skills");
  const { data: healthData, loading: healthLoading, error: healthError } = useApi<Record<string, unknown>>("/api/health");

  const [memories, setMemories] = useState<MemoryEntry[]>([]);
  const { loading: searchLoading, error: searchError, post: searchMemories } = usePostApi<MemoryEntry[]>();

  const handleSearch = useCallback(async (query: string) => {
    setThinking(true);
    const result = await searchMemories("/api/memory/search", { query, limit: 20 });
    setThinking(false);
    if (result) setMemories(Array.isArray(result) ? result : []);
  }, [searchMemories]);

  const handleSend = useCallback((text: string) => {
    setThinking(true);
    send(text);
    const checkDone = setInterval(() => {
      const last = messages[messages.length - 1];
      if (last && !last.streaming) {
        setThinking(false);
        clearInterval(checkDone);
      }
    }, 200);
    setTimeout(() => { clearInterval(checkDone); setThinking(false); }, 30000);
  }, [send, messages]);

  const skills = skillsData?.skills ?? (skillsData as unknown as Skill[]) ?? [];

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
        <span style={connected ? s.status : s.statusError}>{connected ? "on" : "off"}</span>
      </header>

      {tab === "chat" && (
        <ChatView messages={messages} connected={connected} onSend={handleSend} thinking={thinking} />
      )}

      {tab === "skills" && (
        <SkillsView skills={skills} loading={skillsLoading} error={skillsError} />
      )}

      {tab === "memory" && (
        <>
          {searchError && <ErrorBanner message={searchError} onDismiss={() => setApiError(null)} />}
          <MemoryView
            memories={memories}
            loading={searchLoading}
            error={null}
            onSearch={handleSearch}
          />
        </>
      )}

      {tab === "settings" && (
        <SettingsView
          health={healthData ?? {}}
          loading={healthLoading}
          error={healthError}
        />
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
  statusError: { fontSize: 11, color: "#ef4444" },
};
