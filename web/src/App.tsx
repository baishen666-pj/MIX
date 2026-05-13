import { useCallback, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import type { Tab, Skill } from "./types";
import type { MemoryEntry } from "./types";
import { useStore } from "./store";
import { useWebSocket } from "./hooks/useWebSocket";
import { useApi, usePostApi } from "./hooks/useApi";
import { SkillsSchema, HealthSchema } from "./schemas/api";
import { useLocale } from "./i18n";
import type { TranslationKey } from "./i18n/en";
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

const VALID_TABS: Tab[] = ["chat", "skills", "memory", "dashboard", "agents", "tools", "knowledge", "settings"];

const WS_URL = `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws/chat`;

function isValidTab(value: string): value is Tab {
  return VALID_TABS.includes(value as Tab);
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const {
    theme, setTheme,
    locale, setLocale: setStoreLocale,
    thinking, setThinking,
    apiError, setApiError,
    memories, setMemories,
  } = useStore();

  const { t, setLocale: setI18nLocale } = useLocale();

  // Derive tab from URL, default to "chat"
  const pathTab = location.pathname.slice(1) || "chat";
  const tab: Tab = isValidTab(pathTab) ? pathTab : "chat";

  // Sync locale between store and i18n context
  useEffect(() => {
    setI18nLocale(locale as "en" | "zh");
  }, [locale, setI18nLocale]);

  const handleTabSwitch = useCallback((tabKey: Tab) => {
    navigate("/" + tabKey);
  }, [navigate]);

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  const handleLocaleToggle = useCallback(() => {
    const next = locale === "en" ? "zh" : "en";
    setStoreLocale(next);
    setI18nLocale(next);
  }, [locale, setStoreLocale, setI18nLocale]);

  const { messages, connected, send, sessionId, loadHistory, clearMessages, ttfb } = useWebSocket(WS_URL);

  const { data: skillsData, loading: skillsLoading, error: skillsError } = useApi("/api/skills", SkillsSchema);
  const { data: healthData, loading: healthLoading, error: healthError } = useApi("/api/health", HealthSchema);

  const { loading: searchLoading, error: searchError, post: searchMemories } = usePostApi<MemoryEntry[]>();

  const handleSearch = useCallback(async (query: string) => {
    setThinking(true);
    const result = await searchMemories("/api/memory/search", { query, limit: 20 });
    setThinking(false);
    if (result) setMemories(Array.isArray(result) ? result : []);
  }, [searchMemories, setThinking, setMemories]);

  const handleSend = useCallback((text: string) => {
    setThinking(true);
    send(text);
  }, [send, setThinking]);

  useEffect(() => {
    if (!thinking) return;
    const last = messages[messages.length - 1];
    if (last && !last.streaming) {
      setThinking(false);
    }
  }, [messages, thinking, setThinking]);

  const handleNewSession = useCallback(() => {
    clearMessages();
  }, [clearMessages]);

  const handleSelectSession = useCallback((id: string) => {
    loadHistory(id);
  }, [loadHistory]);

  const skills = (skillsData?.skills ?? []) as Skill[];

  const tabLabel = (tabKey: Tab) => {
    const icons: Record<Tab, string> = {
      chat: "\u{1F4AC}",
      skills: "\u{2699}\u{FE0F}",
      memory: "\u{1F9E0}",
      dashboard: "\u{1F4CA}",
      agents: "\u{1F916}",
      tools: "\u{1F527}",
      knowledge: "\u{1F4DA}",
      settings: "\u{2699}\u{FE0F}",
    };
    const keys: Record<Tab, TranslationKey> = {
      chat: "tab.chat",
      skills: "tab.skills",
      memory: "tab.memory",
      dashboard: "tab.dashboard",
      agents: "tab.agents",
      tools: "tab.tools",
      knowledge: "tab.knowledge",
      settings: "tab.settings",
    };
    return `${icons[tabKey]} ${t(keys[tabKey])}`;
  };

  return (
    <div style={s.sidebarWrapper}>
      <ConversationSidebar
        currentSessionId={sessionId}
        onSelectSession={handleSelectSession}
        onNewSession={handleNewSession}
      />
      <div className="mix-container">
        <header className="mix-header">
          <h1 style={s.title}>MIX</h1>
          <nav style={s.nav} role="tablist" aria-label="Main navigation">
            {VALID_TABS.map((tabKey) => (
              <button key={tabKey} onClick={() => handleTabSwitch(tabKey)} style={tab === tabKey ? s.navActive : s.navBtn} role="tab" aria-selected={tab === tabKey}>
                {tabLabel(tabKey)}
              </button>
            ))}
          </nav>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {ttfb !== null && <span style={s.status}>{ttfb}ms</span>}
            <span style={connected ? s.status : s.statusError}>{connected ? t("status.on") : t("status.off")}</span>
            <button onClick={handleLocaleToggle} style={themeBtnStyle} aria-label="Toggle language">
              {locale === "en" ? "中" : "EN"}
            </button>
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
