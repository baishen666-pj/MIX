import { useState } from "react";
import type { MemoryEntry } from "../types";

interface MemoryViewProps {
  memories: MemoryEntry[];
  loading: boolean;
  error: string | null;
  onSearch: (query: string) => void;
}

const PAGE_SIZE = 10;

export function MemoryView({ memories, loading, error, onSearch }: MemoryViewProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const filtered = typeFilter === "all" ? memories : memories.filter((m) => m.type === typeFilter);
  const visible = filtered.slice(0, visibleCount);

  const handleSearch = () => {
    if (!query.trim()) return;
    setVisibleCount(PAGE_SIZE);
    onSearch(query);
  };

  return (
    <main style={s.panel}>
      <h2 style={s.panelTitle}>Memory</h2>
      <div style={s.searchBar}>
        <input
          style={s.input}
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
        <div key={m.id} style={s.card}>
          <div style={s.cardHeader}>
            {m.type} <span style={s.badge}>{m.tags.join(", ") || "no tags"}</span>
          </div>
          <div style={s.cardDesc}>{m.content.slice(0, 200)}</div>
          <div style={s.cardMeta}>{new Date(m.created_at).toLocaleString()}</div>
        </div>
      ))}
      {visible.length < filtered.length && (
        <button style={s.loadMore} onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}>
          Load more ({filtered.length - visible.length} remaining)
        </button>
      )}
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  panel: { flex: 1, overflowY: "auto", padding: 20 },
  panelTitle: { margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#fff" },
  searchBar: { display: "flex", gap: 8, marginBottom: 12 },
  input: { flex: 1, background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "10px 14px", color: "#e5e5e5", fontSize: 14, outline: "none" },
  searchBtn: { background: "#2563eb", color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  filterBar: { display: "flex", gap: 8, marginBottom: 16 },
  filterSelect: { background: "#1a1a1a", border: "1px solid #333", borderRadius: 6, padding: "6px 10px", color: "#a3a3a3", fontSize: 12, outline: "none" },
  empty: { color: "#525252", fontSize: 14, textAlign: "center", padding: 20 },
  error: { color: "#fca5a5", fontSize: 13, padding: 12, background: "#451a1a", borderRadius: 8, marginBottom: 12 },
  card: { background: "#1a1a1a", border: "1px solid #262626", borderRadius: 10, padding: 14, marginBottom: 10 },
  cardHeader: { fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 },
  badge: { fontSize: 11, background: "#262626", color: "#a3a3a3", padding: "2px 8px", borderRadius: 4 },
  cardDesc: { fontSize: 13, color: "#a3a3a3", lineHeight: 1.4 },
  cardMeta: { fontSize: 11, color: "#525252", marginTop: 4 },
  loadMore: { background: "#1a1a1a", border: "1px solid #333", borderRadius: 8, padding: "8px 16px", color: "#a3a3a3", fontSize: 13, cursor: "pointer", width: "100%", marginTop: 8 },
};
