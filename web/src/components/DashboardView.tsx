import { useState, useEffect, useCallback } from "react";
import { s } from "../styles";
import { ListSkeleton } from "./Skeleton";

interface MetricsData {
  uptime_seconds: number;
  requests: {
    total: number;
    by_endpoint: Record<string, number>;
    by_status: Record<string, number>;
    avg_duration_ms: number;
    p95_duration_ms: number;
    recent_count: number;
  };
  llm: {
    total_calls: number;
    by_provider: Record<string, number>;
    avg_latency_ms: number;
    total_tokens: number;
    recent_calls: number;
  };
  sessions: { active_count: number };
  memory: { entry_count: number };
  channels?: { name: string; connected: boolean }[];
}

export function DashboardView() {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const res = await fetch("/api/metrics");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setMetrics(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch metrics");
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 5000);
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  if (error) {
    return <div style={s.panel}><div style={s.sectionTitle}>Dashboard</div><div style={{ color: "red" }}>{error}</div></div>;
  }

  if (!metrics) {
    return <div style={s.panel}><div style={s.sectionTitle}>Dashboard</div><ListSkeleton count={4} /></div>;
  }

  const topEndpoints = Object.entries(metrics.requests.by_endpoint)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);
  const maxEndpointCount = topEndpoints.length > 0 ? topEndpoints[0][1] : 1;

  const providerEntries = Object.entries(metrics.llm.by_provider);
  const maxProviderCount = providerEntries.length > 0 ? Math.max(...providerEntries.map(([, v]) => v)) : 1;

  const statusEntries = Object.entries(metrics.requests.by_status);

  return (
    <div style={s.panel}>
      <div style={s.sectionTitle}>Dashboard</div>

      {/* Summary cards */}
      <div style={dashGrid}>
        <MetricCard label="Uptime" value={formatDuration(metrics.uptime_seconds)} />
        <MetricCard label="Total Requests" value={metrics.requests.total.toLocaleString()} />
        <MetricCard label="Active Sessions" value={String(metrics.sessions.active_count)} />
        <MetricCard label="Memory Entries" value={String(metrics.memory.entry_count)} />
        <MetricCard label="LLM Calls" value={metrics.llm.total_calls.toLocaleString()} />
        <MetricCard label="Total Tokens" value={metrics.llm.total_tokens.toLocaleString()} />
      </div>

      {/* Request latency */}
      <div style={sectionBox}>
        <div style={subTitle}>Request Latency</div>
        <div style={metricRow}>
          <span>Avg: <strong>{metrics.requests.avg_duration_ms.toFixed(1)}ms</strong></span>
          <span>P95: <strong>{metrics.requests.p95_duration_ms.toFixed(1)}ms</strong></span>
          <span>Recent ({metrics.requests.recent_count} in window)</span>
        </div>
      </div>

      {/* Endpoint bar chart */}
      <div style={sectionBox}>
        <div style={subTitle}>Top Endpoints</div>
        {topEndpoints.length === 0 && <div style={s.empty}>No data</div>}
        {topEndpoints.map(([endpoint, count]) => (
          <div key={endpoint} style={barRow}>
            <span style={barLabel}>{endpoint}</span>
            <div style={barTrack}>
              <div style={{ ...barFill, width: `${(count / maxEndpointCount) * 100}%` }} />
            </div>
            <span style={barValue}>{count}</span>
          </div>
        ))}
      </div>

      {/* LLM stats */}
      <div style={sectionBox}>
        <div style={subTitle}>LLM Providers</div>
        <div style={metricRow}>
          <span>Avg Latency: <strong>{metrics.llm.avg_latency_ms.toFixed(1)}ms</strong></span>
        </div>
        {providerEntries.length === 0 && <div style={s.empty}>No LLM calls</div>}
        {providerEntries.map(([provider, count]) => (
          <div key={provider} style={barRow}>
            <span style={barLabel}>{provider}</span>
            <div style={barTrack}>
              <div style={{ ...barFill, width: `${(count / maxProviderCount) * 100}%`, background: "var(--color-accent)" }} />
            </div>
            <span style={barValue}>{count}</span>
          </div>
        ))}
      </div>

      {/* Status codes */}
      <div style={sectionBox}>
        <div style={subTitle}>Status Codes</div>
        <div style={metricRow}>
          {statusEntries.map(([code, count]) => (
            <span key={code} style={statusBadge(code)}>{code}: {count}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={card}>
      <div style={cardLabel}>{label}</div>
      <div style={cardValue}>{value}</div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

function statusBadge(code: string): React.CSSProperties {
  const num = parseInt(code, 10);
  const color = num >= 200 && num < 300 ? "#22c55e" : num >= 400 && num < 500 ? "#eab308" : num >= 500 ? "#ef4444" : "var(--color-text-muted)";
  return {
    padding: "2px 8px",
    borderRadius: "var(--radius-sm)",
    background: color,
    color: num >= 200 && num < 300 ? "#000" : "#fff",
    fontSize: "var(--font-size-sm)",
    fontWeight: 600,
  };
}

const dashGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
  gap: 12,
  marginBottom: 20,
};

const card: React.CSSProperties = {
  background: "var(--color-surface-alt)",
  borderRadius: "var(--radius-md)",
  padding: 16,
  textAlign: "center",
  border: "1px solid var(--color-border)",
};

const cardLabel: React.CSSProperties = {
  fontSize: "var(--font-size-sm)",
  color: "var(--color-text-muted)",
  marginBottom: 4,
};

const cardValue: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  color: "var(--color-text)",
};

const sectionBox: React.CSSProperties = {
  background: "var(--color-surface-alt)",
  borderRadius: "var(--radius-md)",
  padding: 16,
  border: "1px solid var(--color-border)",
  marginBottom: 12,
};

const subTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 8,
  color: "var(--color-text)",
};

const metricRow: React.CSSProperties = {
  display: "flex",
  gap: 16,
  flexWrap: "wrap",
  fontSize: "var(--font-size-sm)",
  color: "var(--color-text-secondary)",
  marginBottom: 8,
};

const barRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  marginBottom: 6,
};

const barLabel: React.CSSProperties = {
  width: 120,
  fontSize: "var(--font-size-sm)",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  color: "var(--color-text-secondary)",
};

const barTrack: React.CSSProperties = {
  flex: 1,
  height: 8,
  background: "var(--color-border)",
  borderRadius: 4,
  overflow: "hidden",
};

const barFill: React.CSSProperties = {
  height: "100%",
  background: "var(--color-accent)",
  borderRadius: 4,
  transition: "width 0.3s ease",
};

const barValue: React.CSSProperties = {
  width: 50,
  textAlign: "right",
  fontSize: "var(--font-size-sm)",
  fontWeight: 600,
  color: "var(--color-text)",
};
