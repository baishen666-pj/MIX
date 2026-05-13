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
import { RAGView } from "./components/RAGView";
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

  const { messages, connected, send, sessionId, loadHistory, clearMessages, ttfb } = useWebSocket(WS_URL);

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
  }, [send]);

  useEffect(() => {
    if (!thinking) return;
    const last = messages[messages.length - 1];
    if (last && !last.streaming) {
      setThinking(false);
    }
  }, [messages, thinking]);

  const handleNewSession = useCallback(() => {
    setCurrentSessionId("");
    clearMessages();
  }, [clearMessages]);

  const skills = skillsData?.skills ?? [];

  const tabLabel = (t: Tab) => {
    const labels: Record<Tab, string> = {
      chat: "\u{1F4AC} Chat",
      skills: "\u{2699}\u{FE0F} Skills",
      memory: "\u{1F9E0} Memory",
      dashboard: "\u{1F4CA} Dashboard",
      agents: "\u{1F916} Agents",
      tools: "\u{1F527} Tools",
      knowledge: "\u{1F4DA} Knowledge",
      settings: "\u{2699}\u{FE0F} Settings",
    };
    return labels[t] || t;
  };

  return (
    <div style={s.sidebarWrapper}>
      <ConversationSidebar
        currentSessionId={currentSessionId}
        onSelectSession={(id) => {
          setCurrentSessionId(id);
          loadHistory(id);
        }}
        onNewSession={handleNewSession}
      />
      <div style={s.container}>
        <header style={s.header}>
          <h1 style={s.title}>MIX</h1>
          <nav style={s.nav} role="tablist" aria-label="Main navigation">
            {(["chat", "skills", "memory", "dashboard", "agents", "tools", "knowledge", "settings"] as Tab[]).map((t) => (
              <button key={t} onClick={() => setTab(t)} style={tab === t ? s.navActive : s.navBtn} role="tab" aria-selected={tab === t}>
                {tabLabel(t)}
              </button>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {ttfb !== null && <span style={s.status}>{ttfb}ms</span>}
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

        {tab === "knowledge" && (
          <RAGView />
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
