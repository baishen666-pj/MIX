import type { Skill } from "../types";
import { s } from "../styles";

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
        <div key={sk.name} style={s.card} className="card-hover">
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
