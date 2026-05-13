import { useState, useCallback, useEffect } from "react";
import type { Tab, MemoryEntry, Skill } from "./types";
import { useWebSocket } from "./hooks/useWebSocket";
import { useApi, usePostApi } from "./hooks/useApi";
import { ChatView } from "./components/ChatView";
import { SkillsView } from "./components/SkillsView";
import { MemoryView } from "./components/MemoryView";
import { KnowledgeBase } from "./components/KnowledgeBase";
import { SettingsView } from "./components/SettingsView";
import { DashboardView } from "./components/DashboardView";
import { AgentsView } from "./components/AgentsView";
import { ToolsView } from "./components/ToolsView";
import { ConversationSidebar } from "./components/ConversationSidebar";
import { ErrorBanner } from "./components/ErrorBanner";
import { s } from "./styles";

const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/chat`;

function getInitialTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  const stored = localStorage.getItem("mix-theme");
  if (stored === "light" || stored === "dark") return stored;
  return "dark";
}

export function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [apiError, setApiError] = useState<string | null>(null);
  const [thinking, setThinking] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(getInitialTheme);
  const [currentSessionId, setCurrentSessionId] = useState("");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("mix-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const { messages, connected, send, sessionId } = useWebSocket(WS_URL);

  useEffect(() => {
    if (sessionId && sessionId !== currentSessionId) {
      setCurrentSessionId(sessionId);
    }
  }, [sessionId, currentSessionId]);

  const { data: skillsData, loading: skillsLoading, error: skillsError } = useApi<{ skills: Skill[] }>("/api/skills");
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

  const handleNewSession = useCallback(() => {
    setCurrentSessionId("");
    window.location.reload();
  }, []);

  const skills = skillsData?.skills ?? [];

  return (
    <div style={s.sidebarWrapper}>
      <ConversationSidebar
        currentSessionId={currentSessionId}
        onSelectSession={(id) => setCurrentSessionId(id)}
        onNewSession={handleNewSession}
      />
      <div style={s.container}>
        <header style={s.header}>
          <h1 style={s.title}>MIX</h1>
          <nav style={s.nav}>
            {(["chat", "skills", "memory", "dashboard", "agents", "tools", "settings"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={tab === t ? s.navActive : s.navBtn}>
                {t}
              </button>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={connected ? s.status : s.statusError}>{connected ? "on" : "off"}</span>
            <button onClick={toggleTheme} style={themeBtnStyle} aria-label="Toggle theme">
              {theme === "dark" ? "☀" : "☾"}
            </button>
          </div>
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
            <KnowledgeBase onRefresh={() => handleSearch("")} />
            <MemoryView
              memories={memories}
              loading={searchLoading}
              error={null}
              onSearch={handleSearch}
              onRefresh={() => handleSearch("")}
            />
          </>
        )}

        {tab === "dashboard" && (
          <DashboardView />
        )}

        {tab === "agents" && (
          <AgentsView />
        )}

        {tab === "tools" && (
          <ToolsView />
        )}

        {tab === "settings" && (
          <SettingsView
            health={healthData ?? {}}
            loading={healthLoading}
            error={healthError}
          />
        )}
      </div>
    </div>
  );
}

const themeBtnStyle: React.CSSProperties = {
  background: "none",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-md)",
  color: "var(--color-text-secondary)",
  cursor: "pointer",
  fontSize: 16,
  padding: "2px 8px",
  lineHeight: 1,
  transition: "background var(--transition-fast), border-color var(--transition-fast)",
};
