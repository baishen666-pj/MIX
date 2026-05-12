import { s } from "../styles";

interface SettingsViewProps {
  health: Record<string, unknown>;
  loading: boolean;
  error: string | null;
}

export function SettingsView({ health, loading, error }: SettingsViewProps) {
  const status = health?.status as string ?? "unknown";
  const engine = health?.engine as Record<string, unknown> | undefined;
  const channels = health?.channels as string[] | undefined;

  return (
    <main style={s.panel}>
      <h2 style={s.panelTitle}>System Status</h2>
      {loading && <div style={s.empty}>Loading...</div>}
      {error && <div style={s.error}>{error}</div>}
      {!loading && (
        <>
          <div style={s.section}>
            <div style={s.sectionTitle}>Overview</div>
            <div style={s.statusRow}>
              <span style={s.statusKey}>Gateway</span>
              <span style={s.statusOk}>Running</span>
            </div>
            <div style={s.statusRow}>
              <span style={s.statusKey}>Engine</span>
              <span style={status === "ok" ? s.statusOk : s.statusDegraded}>
                {status === "ok" ? "Connected" : "Degraded"}
              </span>
            </div>
          </div>
          {engine && typeof engine === "object" && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Engine</div>
              {Object.entries(engine).map(([k, v]) => (
                <div key={k} style={s.statusRow}>
                  <span style={s.statusKey}>{k}</span>
                  <span style={s.statusVal}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
          {channels && channels.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Active Channels</div>
              <div style={s.channels}>
                {channels.map((ch) => (
                  <span key={ch} style={s.chip} className="chip-hover">{ch}</span>
                ))}
              </div>
            </div>
          )}
          <div style={s.section}>
            <div style={s.sectionTitle}>Raw Response</div>
            <pre style={s.pre}>{JSON.stringify(health, null, 2)}</pre>
          </div>
        </>
      )}
    </main>
  );
}

