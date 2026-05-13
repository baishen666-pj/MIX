import { useState, useEffect, useCallback } from "react";
import { s } from "../styles";

interface Session {
  id: string;
  updated_at: string;
  title?: string;
  message_count?: number;
}

interface ConversationSidebarProps {
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export function ConversationSidebar({ currentSessionId, onSelectSession, onNewSession }: ConversationSidebarProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchSessions = useCallback(async () => {
    try {
      const url = searchQuery
        ? `/api/sessions/search?q=${encodeURIComponent(searchQuery)}`
        : "/api/sessions";
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      setSessions(data.sessions ?? []);
    } catch {
      // Error handled silently
    }
  }, [searchQuery]);

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 10000);
    return () => clearInterval(interval);
  }, [fetchSessions]);

  const handleDelete = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await fetch(`/api/sessions/${id}`, { method: "DELETE" });
      fetchSessions();
    } catch {
      // Error handled silently
    }
  }, [fetchSessions]);

  const handleExport = useCallback(async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/sessions/${id}/export?format=markdown`);
      const text = await res.text();
      const blob = new Blob([text], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `session-${id.slice(0, 8)}.md`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Error handled silently
    }
  }, []);

  if (collapsed) {
    return (
      <div style={s.sidebarCollapsed}>
        <button onClick={() => setCollapsed(false)} style={s.sidebarToggle} aria-label="Expand sidebar">
          &#9776;
        </button>
        <button onClick={onNewSession} style={s.sidebarToggle} aria-label="New session">
          +
        </button>
      </div>
    );
  }

  return (
    <div style={s.sidebar}>
      <div style={s.sidebarHeader}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Sessions</span>
        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={onNewSession} style={s.sidebarToggle} aria-label="New session">+</button>
          <button onClick={() => setCollapsed(true)} style={s.sidebarToggle} aria-label="Collapse sidebar">
            &#9664;
          </button>
        </div>
      </div>
      <input
        type="text"
        placeholder="Search sessions..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        style={s.searchInput}
        aria-label="Search sessions"
      />
      <div style={s.sidebarList}>
        {sessions.length === 0 && (
          <div style={s.empty}>{searchQuery ? "No results" : "No sessions yet"}</div>
        )}
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => onSelectSession(session.id)}
            style={session.id === currentSessionId ? s.sidebarItemActive : s.sidebarItem}
            className="sidebar-item-hover"
          >
            <div style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 13 }}>
              {session.title ?? `Session (${session.message_count ?? 0} msgs)`}
            </div>
            <div style={{ display: "flex", gap: 2 }}>
              <button
                onClick={(e) => handleExport(session.id, e)}
                style={s.sidebarActionBtn}
                aria-label="Export session"
                title="Export as Markdown"
              >
                &#8615;
              </button>
              <button
                onClick={(e) => handleDelete(session.id, e)}
                style={s.sidebarDeleteBtn}
                aria-label="Delete session"
              >
                &#10005;
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
