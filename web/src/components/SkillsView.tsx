import { useState, useCallback } from "react";
import type { Skill } from "../types";
import { s } from "../styles";

interface SkillsViewProps {
  skills: Skill[];
  loading: boolean;
  error: string | null;
}

export function SkillsView({ skills, loading, error }: SkillsViewProps) {
  const [runningSkill, setRunningSkill] = useState<string | null>(null);
  const [skillArgs, setSkillArgs] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  const handleRun = useCallback(async (skillName: string) => {
    setResult(null);
    setResultError(null);
    setRunningSkill(skillName);
    try {
      const res = await fetch("/api/skills/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skill_name: skillName, args: skillArgs || {} }),
      });
      const json = await res.json();
      if (json.error) {
        setResultError(json.error);
      } else {
        setResult(JSON.stringify(json.result, null, 2));
      }
    } catch (err) {
      setResultError(err instanceof Error ? err.message : "Execution failed");
    } finally {
      setRunningSkill(null);
      setSkillArgs("");
    }
  }, [skillArgs]);

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
          <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
            <input
              style={{ ...s.input, flex: 1, fontSize: 12 }}
              placeholder='Arguments (JSON or text)...'
              value={runningSkill === sk.name ? skillArgs : ""}
              onChange={(e) => { setSkillArgs(e.target.value); setRunningSkill(sk.name); }}
              onKeyDown={(e) => e.key === "Enter" && handleRun(sk.name)}
            />
            <button
              style={runningSkill === sk.name ? s.sendBtnDisabled : s.sendBtn}
              onClick={() => handleRun(sk.name)}
              disabled={runningSkill !== null}
            >
              Run
            </button>
          </div>
          {result && runningSkill === null && (
            <pre style={{ ...s.cardDesc, whiteSpace: "pre-wrap", fontSize: 12, background: "var(--color-surface)", padding: 8, borderRadius: 4, marginTop: 8 }}>
              {result}
            </pre>
          )}
          {resultError && (
            <div style={{ ...s.error, marginTop: 8 }}>{resultError}</div>
          )}
        </div>
      ))}
    </main>
  );
}
