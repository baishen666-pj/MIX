import { useState, useCallback } from "react";
import type { MemoryEntry } from "../types";
import { s } from "../styles";

interface MemoryViewProps {
  memories: MemoryEntry[];
  loading: boolean;
  error: string | null;
  onSearch: (query: string) => void;
  onRefresh: () => void;
}

const PAGE_SIZE = 10;

export function MemoryView({ memories, loading, error, onSearch, onRefresh }: MemoryViewProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [showCreate, setShowCreate] = useState(false);
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState("context");
  const [newTags, setNewTags] = useState("");

  const filtered = typeFilter === "all" ? memories : memories.filter((m) => m.type === typeFilter);
  const visible = filtered.slice(0, visibleCount);

  const handleSearch = () => {
    if (!query.trim()) return;
    setVisibleCount(PAGE_SIZE);
    onSearch(query);
  };

  const handleCreate = useCallback(async () => {
    if (!newContent.trim()) return;
    try {
      await fetch("/api/memory/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newContent, source: "web-ui" }),
      });
      setShowCreate(false);
      setNewContent("");
      setNewTags("");
      onRefresh();
    } catch {
      // Error handled silently
    }
  }, [newContent, onRefresh]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/memory/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      // Find and delete by id
      const res = await fetch(`/api/memory/${id}`, { method: "DELETE" });
      if (res.ok) onRefresh();
    } catch {
      // Error handled silently
    }
  }, [onRefresh]);

  return (
    <main style={s.panel}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={s.panelTitle}>Memory</h2>
        <button style={s.sendBtn} onClick={() => setShowCreate(!showCreate)}>
          {showCreate ? "Cancel" : "Create"}
        </button>
      </div>

      {showCreate && (
        <div style={{ ...s.card, padding: 12, marginBottom: 12 }}>
          <textarea
            style={s.textarea}
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Enter memory content..."
            rows={3}
          />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <select style={s.filterSelect} value={newType} onChange={(e) => setNewType(e.target.value)}>
              <option value="fact">Fact</option>
              <option value="preference">Preference</option>
              <option value="context">Context</option>
            </select>
            <input
              style={{ ...s.input, flex: 1 }}
              placeholder="Tags (comma separated)..."
              value={newTags}
              onChange={(e) => setNewTags(e.target.value)}
            />
            <button style={s.sendBtn} onClick={handleCreate} disabled={!newContent.trim()}>
              Save
            </button>
          </div>
        </div>
      )}

      <div style={s.searchBar}>
        <input
          style={s.input}
          className="focus-ring"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search memories..."
        />
        <button style={s.searchBtn} onClick={handleSearch}>Search</button>
      </div>
      <div style={s.filterBar}>
        <select style={s.filterSelect} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="fact">Fact</option>
          <option value="preference">Preference</option>
          <option value="context">Context</option>
          <option value="skill_result">Skill Result</option>
          <option value="user_model">User Model</option>
        </select>
      </div>
      {loading && <div style={s.empty}>Searching...</div>}
      {error && <div style={s.error}>{error}</div>}
      {visible.map((m) => (
        <div key={m.id} style={s.card} className="card-hover">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={s.cardHeader}>
              {m.type} <span style={s.badge}>{m.tags.join(", ") || "no tags"}</span>
            </div>
            <button onClick={() => handleDelete(m.id)} style={s.msgActionBtn}>Delete</button>
          </div>
          <div style={s.cardDesc}>{m.content.slice(0, 200)}</div>
          <div style={s.cardMeta}>{new Date(m.created_at).toLocaleString()}</div>
        </div>
      ))}
      {visible.length < filtered.length && (
        <button style={s.loadMoreBtn} onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
          Load more ({filtered.length - visible.length} remaining)
        </button>
      )}
    </main>
  );
}
