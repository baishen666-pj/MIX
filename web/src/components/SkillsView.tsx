import type { Skill } from "../types";

interface SkillsViewProps {
  skills: Skill[];
  loading: boolean;
  error: string | null;
}

export function SkillsView({ skills, loading, error }: SkillsViewProps) {
  return (
    <main style={s.panel}>
      <h2 style={s.panelTitle}>Skills</h2>
      {loading && <div style={s.empty}>Loading...</div>}
      {error && <div style={s.error}>{error}</div>}
      {!loading && !error && skills.length === 0 && <div style={s.empty}>No skills loaded</div>}
      {skills.map((sk) => (
        <div key={sk.name} style={s.card}>
          <div style={s.cardHeader}>
            {sk.name} <span style={s.badge}>{sk.version}</span>
          </div>
          <div style={s.cardDesc}>{sk.description}</div>
          <div style={s.cardTriggers}>{sk.trigger.map((t) => <code key={t}>{t}</code>)}</div>
        </div>
      ))}
    </main>
  );
}

const s: Record<string, React.CSSProperties> = {
  panel: { flex: 1, overflowY: "auto", padding: 20 },
  panelTitle: { margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#fff" },
  empty: { color: "#525252", fontSize: 14, textAlign: "center", padding: 20 },
  error: { color: "#fca5a5", fontSize: 13, padding: 12, background: "#451a1a", borderRadius: 8 },
  card: { background: "#1a1a1a", border: "1px solid #262626", borderRadius: 10, padding: 14, marginBottom: 10 },
  cardHeader: { fontSize: 14, fontWeight: 600, color: "#fff", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 },
  badge: { fontSize: 11, background: "#262626", color: "#a3a3a3", padding: "2px 8px", borderRadius: 4 },
  cardDesc: { fontSize: 13, color: "#a3a3a3", lineHeight: 1.4 },
  cardTriggers: { marginTop: 8, display: "flex", gap: 4, flexWrap: "wrap" },
};
