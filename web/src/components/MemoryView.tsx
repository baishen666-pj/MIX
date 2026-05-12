import { useState } from "react";
import type { MemoryEntry } from "../types";
import { s } from "../styles";

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
          <div style={s.cardHeader}>
            {m.type} <span style={s.badge}>{m.tags.join(", ") || "no tags"}</span>
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
