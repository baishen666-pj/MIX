import { useState, useEffect, useCallback } from "react";
import { EmptyState } from "./EmptyState";
import { useLocale } from "../i18n";

interface ToolRecord {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  result: string;
  success: boolean;
  execution_time_ms: number;
  session_id: string;
  timestamp: number;
  chain_id: string | null;
}

interface ApprovalReq {
  id: string;
  tool_name: string;
  arguments: Record<string, unknown>;
  danger_level: string;
  status: string;
  requested_at: number;
}

type ToolViewTab = "tools" | "history" | "approval" | "chains";

export function ToolsView() {
  const { t } = useLocale();
  const [viewTab, setViewTab] = useState<ToolViewTab>("tools");
  const [tools, setTools] = useState<string[]>([]);
  const [definitions, setDefinitions] = useState<unknown[]>([]);
  const [history, setHistory] = useState<ToolRecord[]>([]);
  const [stats, setStats] = useState<Record<string, unknown>>({});
  const [pending, setPending] = useState<ApprovalReq[]>([]);

  const fetchTools = useCallback(async () => {
    try {
      const res = await fetch("/api/tools");
      const data = await res.json();
      setTools(data.tools || []);
      setDefinitions(data.definitions || []);
    } catch { /* ignore */ }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/history?limit=50");
      const data = await res.json();
      setHistory(data.records || []);
    } catch { /* ignore */ }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/history/stats");
      const data = await res.json();
      setStats(data);
    } catch { /* ignore */ }
  }, []);

  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/tools/approval/pending");
      const data = await res.json();
      setPending(data.requests || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchTools();
    fetchHistory();
    fetchStats();
    fetchPending();
  }, [fetchTools, fetchHistory, fetchStats, fetchPending]);

  const approveRequest = async (id: string) => {
    await fetch(`/api/tools/approval/${id}/approve`, { method: "POST" });
    await fetchPending();
  };

  const rejectRequest = async (id: string) => {
    await fetch(`/api/tools/approval/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Rejected via UI" }),
    });
    await fetchPending();
  };

  const dangerColor = (level: string) => {
    if (level === "dangerous") return "var(--color-status-error)";
    if (level === "moderate") return "var(--color-status-warning)";
    return "var(--color-status-success)";
  };

  return (
    <div className="mix-panel">
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["tools", "history", "chains", "approval"] as ToolViewTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setViewTab(t)}
            className="mix-btn"
            style={{
              background: viewTab === t ? "var(--color-status-info)" : "transparent",
              color: viewTab === t ? "var(--color-text)" : "var(--color-text-muted)",
              border: `1px solid ${viewTab === t ? "var(--color-status-info)" : "var(--color-border)"}`,
            }}
          >
            {t === "approval" ? `Approval (${pending.length})` : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {viewTab === "tools" && (
        <div>
          {typeof stats.total === "number" && (
            <div className="mix-card" style={{ marginBottom: 16, display: "flex", gap: 20 }}>
              <div><strong>Total Executions:</strong> {String(stats.total)}</div>
              <div><strong>Success Rate:</strong> {String(stats.success_rate ?? 0)}%</div>
              <div><strong>Avg Time:</strong> {String(stats.avg_time_ms ?? 0)}ms</div>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))", gap: 12 }}>
            {definitions.map((def: unknown, i: number) => {
              const d = def as { function?: { name?: string; description?: string } };
              const name = d.function?.name || `tool-${i}`;
              const desc = d.function?.description || "";
              const level = ["bash"].includes(name) ? "dangerous" : ["file_write", "file_edit", "file_edit_lines"].includes(name) ? "moderate" : "safe";
              return (
                <div key={name} className="mix-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{name}</strong>
                    <span style={{
                      padding: "1px 6px", borderRadius: 4, fontSize: 11,
                      background: dangerColor(level), color: "#fff",
                    }}>
                      {level}
                    </span>
                  </div>
                  <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 4 }}>{desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewTab === "history" && (
        <div>
          {history.length === 0 && (
            <EmptyState icon="📋" title={t("empty.noHistoryYet")} description={t("empty.historyWillAppear")} />
          )}
          {history.map((r) => (
            <div key={r.id} className="mix-card" style={{ marginBottom: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{r.tool_name}</strong>
                <span style={{ color: r.success ? "var(--color-status-success)" : "var(--color-status-error)" }}>
                  {r.success ? "OK" : "FAIL"} ({r.execution_time_ms.toFixed(1)}ms)
                </span>
              </div>
              <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 4 }}>
                Args: {JSON.stringify(r.arguments).slice(0, 150)}
              </div>
              {r.result && (
                <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 2 }}>
                  {r.result.slice(0, 200)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {viewTab === "chains" && (
        <div>
          {(() => {
            const chainRecords = history.filter((r) => r.chain_id);
            if (chainRecords.length === 0) {
              return <EmptyState icon="🔗" title={t("empty.noChains")} description={t("empty.chainsWillAppear")} />;
            }
            const groups: Record<string, ToolRecord[]> = {};
            for (const r of chainRecords) {
              const cid = r.chain_id!;
              if (!groups[cid]) groups[cid] = [];
              groups[cid].push(r);
            }
            return Object.entries(groups).map(([cid, steps]) => (
              <div key={cid} className="mix-card" style={{ marginBottom: 16, padding: 12 }}>
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 8 }}>
                  Chain: {cid}
                </div>
                <div style={{ position: "relative", paddingLeft: 16 }}>
                  {steps.map((step, i) => (
                    <div key={step.id} style={{ position: "relative", paddingBottom: i < steps.length - 1 ? 16 : 0 }}>
                      <div style={{
                        position: "absolute",
                        left: -11,
                        top: 6,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: step.success ? "var(--color-status-success)" : "var(--color-status-error)",
                        zIndex: 1,
                      }} />
                      {i < steps.length - 1 && (
                        <div style={{
                          position: "absolute",
                          left: -8,
                          top: 14,
                          width: 2,
                          height: "calc(100% - 8px)",
                          background: "var(--color-border)",
                        }} />
                      )}
                      <div style={{
                        background: "var(--color-surface)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 6,
                        padding: "6px 10px",
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                          <strong>{step.tool_name}</strong>
                          <span style={{ color: step.success ? "var(--color-status-success)" : "var(--color-status-error)" }}>
                            {step.success ? "OK" : "FAIL"} ({step.execution_time_ms.toFixed(1)}ms)
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()}
        </div>
      )}

      {viewTab === "approval" && (
        <div>
          {pending.length === 0 && (
            <EmptyState icon="✅" title={t("empty.noPending")} description={t("empty.allHandled")} />
          )}
          {pending.map((req) => (
            <div key={req.id} className="mix-card" style={{ marginBottom: 8, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong>{req.tool_name}</strong>
                  <span style={{
                    marginLeft: 8, padding: "1px 6px", borderRadius: 4, fontSize: 11,
                    background: dangerColor(req.danger_level), color: "#fff",
                  }}>
                    {req.danger_level}
                  </span>
                </div>
              </div>
              <pre style={{ color: "var(--color-text-muted)", fontSize: 12, margin: "8px 0" }}>
                {JSON.stringify(req.arguments, null, 2).slice(0, 300)}
              </pre>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => approveRequest(req.id)} className="mix-btn" style={{ background: "var(--color-status-success)" }}>
                  Approve
                </button>
                <button onClick={() => rejectRequest(req.id)} className="mix-btn" style={{ background: "var(--color-status-error)" }}>
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
