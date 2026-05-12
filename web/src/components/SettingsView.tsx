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
            <div style={s.row}>
              <span style={s.key}>Gateway</span>
              <span style={s.valOk}>Running</span>
            </div>
            <div style={s.row}>
              <span style={s.key}>Engine</span>
              <span style={status === "ok" ? s.valOk : s.valWarn}>
                {status === "ok" ? "Connected" : "Degraded"}
              </span>
            </div>
          </div>
          {engine && typeof engine === "object" && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Engine</div>
              {Object.entries(engine).map(([k, v]) => (
                <div key={k} style={s.row}>
                  <span style={s.key}>{k}</span>
                  <span style={s.val}>{String(v)}</span>
                </div>
              ))}
            </div>
          )}
          {channels && channels.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionTitle}>Active Channels</div>
              <div style={s.channels}>
                {channels.map((ch) => (
                  <span key={ch} style={s.chip}>{ch}</span>
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

const s: Record<string, React.CSSProperties> = {
  panel: { flex: 1, overflowY: "auto", padding: 20 },
  panelTitle: { margin: "0 0 16px", fontSize: 16, fontWeight: 600, color: "#fff" },
  empty: { color: "#525252", fontSize: 14, textAlign: "center", padding: 20 },
  error: { color: "#fca5a5", fontSize: 13, padding: 12, background: "#451a1a", borderRadius: 8, marginBottom: 12 },
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 13, fontWeight: 600, color: "#a3a3a3", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 },
  row: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #1a1a1a", fontSize: 13 },
  key: { color: "#737373" },
  val: { color: "#e5e5e5", fontWeight: 500 },
  valOk: { color: "#4ade80", fontWeight: 500 },
  valWarn: { color: "#facc15", fontWeight: 500 },
  channels: { display: "flex", gap: 6, flexWrap: "wrap" },
  chip: { background: "#1a1a1a", border: "1px solid #262626", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#a3a3a3" },
  pre: { background: "#1a1a1a", border: "1px solid #262626", borderRadius: 8, padding: 16, fontSize: 13, overflow: "auto", color: "#a3a3a3" },
};
