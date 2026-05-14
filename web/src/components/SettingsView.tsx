import { useState, useEffect, useCallback } from "react";
import { s } from "../styles";
import { ListSkeleton } from "./Skeleton";

interface SettingsViewProps {
  health: Record<string, unknown>;
  loading: boolean;
  error: string | null;
}

interface ConfigData {
  llm: { provider: string; model: string; api_key: string; base_url: string; context_window: number; max_output_tokens: number };
  security: { dm_policy: string; allowed_users: string[]; cors_origins: string[]; engine_api_key: string };
  rate_limit: { enabled: boolean; requests_per_minute: number; requests_per_hour: number };
  memory: { max_entries: number };
}

type LLMProvider = "openrouter" | "openai" | "anthropic" | "nvidia" | "local";

const PROVIDER_DEFAULTS: Record<LLMProvider, { base_url: string; models: string[] }> = {
  openrouter: { base_url: "https://openrouter.ai/api/v1", models: ["openai/gpt-4o", "anthropic/claude-sonnet-4-6", "google/gemini-2.5-pro", "deepseek/deepseek-chat"] },
  openai: { base_url: "https://api.openai.com/v1", models: ["gpt-4o", "gpt-4o-mini", "o3", "o4-mini"] },
  anthropic: { base_url: "https://api.anthropic.com", models: ["claude-opus-4-7", "claude-sonnet-4-6", "claude-haiku-4-5-20251001"] },
  nvidia: { base_url: "https://integrate.api.nvidia.com/v1", models: ["meta/llama-3.3-70b-instruct", "mistralai/mixtral-8x22b-instruct"] },
  local: { base_url: "http://localhost:11434/v1", models: ["llama3", "mistral", "codellama", "qwen2"] },
};

const PROVIDERS: { value: LLMProvider; label: string }[] = [
  { value: "openrouter", label: "OpenRouter" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "nvidia", label: "NVIDIA NIM" },
  { value: "local", label: "Local (Ollama)" },
];

export function SettingsView({ health, loading, error }: SettingsViewProps) {
  const status = health?.status as string ?? "unknown";
  const engine = health?.engine as Record<string, unknown> | undefined;
  const channels = health?.channels as string[] | undefined;

  const [config, setConfig] = useState<ConfigData | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [editingLlm, setEditingLlm] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      if (res.ok) setConfig(await res.json());
    } catch { /* handled silently */ }
  }, []);

  useEffect(() => { fetchConfig(); }, [fetchConfig]);

  const updateConfig = useCallback(async (section: string, field: string, value: unknown) => {
    if (!config) return;
    const updated = JSON.parse(JSON.stringify(config));
    (updated as Record<string, Record<string, unknown>>)[section][field] = value;
    setConfig(updated);
  }, [config]);

  const saveConfig = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      setSaveMsg(data.status === "ok" ? "Saved" : "Error saving");
    } catch {
      setSaveMsg("Network error");
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }, [config]);

  const handleProviderChange = useCallback((provider: LLMProvider) => {
    if (!config) return;
    const defaults = PROVIDER_DEFAULTS[provider];
    const updated = JSON.parse(JSON.stringify(config));
    updated.llm.provider = provider;
    updated.llm.base_url = defaults.base_url;
    if (!defaults.models.includes(updated.llm.model)) {
      updated.llm.model = defaults.models[0];
    }
    setConfig(updated);
  }, [config]);

  const testConnection = useCallback(async () => {
    if (!config) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      if (data.status === "ok" || data.status === "degraded") {
        setTestResult({ ok: true, msg: "Connected" });
      } else {
        setTestResult({ ok: false, msg: "Unhealthy: " + (data.status ?? "unknown") });
      }
    } catch (err) {
      setTestResult({ ok: false, msg: err instanceof Error ? err.message : "Connection failed" });
    } finally {
      setTesting(false);
      setTimeout(() => setTestResult(null), 5000);
    }
  }, [config]);

  return (
    <main style={s.panel}>
      <h2 style={s.panelTitle}>Settings</h2>
      {loading && <ListSkeleton count={3} />}
      {error && <div style={s.error}>{error}</div>}

      {/* System Status */}
      <div style={s.section}>
        <div style={s.sectionTitle}>System Status</div>
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
        <div style={{ marginTop: 8 }}>
          <button onClick={testConnection} disabled={testing} style={{ ...testBtn, opacity: testing ? 0.5 : 1 }}>
            {testing ? "Testing..." : "Test Connection"}
          </button>
          {testResult && (
            <span style={{ fontSize: "var(--font-size-sm)", marginLeft: 8, color: testResult.ok ? "var(--color-ok, green)" : "var(--color-error, red)" }}>
              {testResult.msg}
            </span>
          )}
        </div>
      </div>

      {/* Active Channels */}
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

      {/* LLM Config */}
      {config && (
        <div style={s.section}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <div style={s.sectionTitle}>LLM Provider</div>
            <button onClick={() => setEditingLlm(!editingLlm)} style={editBtn}>
              {editingLlm ? "Lock" : "Edit"}
            </button>
          </div>

          {/* Provider selector */}
          <div style={s.statusRow}>
            <span style={s.statusKey}>Provider</span>
            {editingLlm ? (
              <select
                value={config.llm.provider}
                onChange={(e) => handleProviderChange(e.target.value as LLMProvider)}
                style={selectStyle}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            ) : (
              <span style={s.statusVal}>{PROVIDERS.find((p) => p.value === config.llm.provider)?.label ?? config.llm.provider}</span>
            )}
          </div>

          {/* Model selector */}
          <div style={s.statusRow}>
            <span style={s.statusKey}>Model</span>
            {editingLlm ? (
              <div style={{ display: "flex", gap: 4, flex: 1, maxWidth: 250 }}>
                <select
                  value={PROVIDER_DEFAULTS[config.llm.provider as LLMProvider]?.models.includes(config.llm.model) ? config.llm.model : "__custom__"}
                  onChange={(e) => {
                    if (e.target.value !== "__custom__") updateConfig("llm", "model", e.target.value);
                  }}
                  style={selectStyle}
                >
                  {(PROVIDER_DEFAULTS[config.llm.provider as LLMProvider]?.models ?? []).map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {!PROVIDER_DEFAULTS[config.llm.provider as LLMProvider]?.models.includes(config.llm.model) && (
                    <option value="__custom__">{config.llm.model} (custom)</option>
                  )}
                </select>
              </div>
            ) : (
              <span style={s.statusVal}>{config.llm.model}</span>
            )}
          </div>

          <ConfigField label="API Key" value={config.llm.api_key} editable={editingLlm} type="password"
            onChange={(v) => updateConfig("llm", "api_key", v)} />
          <ConfigField label="Base URL" value={config.llm.base_url} editable={editingLlm}
            onChange={(v) => updateConfig("llm", "base_url", v)} />
          <ConfigField label="Context Window" value={String(config.llm.context_window)} editable={editingLlm} type="number"
            onChange={(v) => updateConfig("llm", "context_window", parseInt(v, 10) || 128000)} />
          <ConfigField label="Max Output Tokens" value={String(config.llm.max_output_tokens)} editable={editingLlm} type="number"
            onChange={(v) => updateConfig("llm", "max_output_tokens", parseInt(v, 10) || 4096)} />
        </div>
      )}

      {/* Security Config */}
      {config && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Security</div>
          <ConfigField label="DM Policy" value={config.security.dm_policy} editable
            onChange={(v) => updateConfig("security", "dm_policy", v)} />
          <ConfigField label="CORS Origins" value={config.security.cors_origins.join(", ")} editable
            onChange={(v) => updateConfig("security", "cors_origins", v.split(",").map((s: string) => s.trim()).filter(Boolean))} />
        </div>
      )}

      {/* Rate Limit Config */}
      {config && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Rate Limiting</div>
          <ConfigField label="Enabled" value={String(config.rate_limit.enabled)} editable type="checkbox"
            onChange={() => updateConfig("rate_limit", "enabled", !config.rate_limit.enabled)} />
          <ConfigField label="Requests/Min" value={String(config.rate_limit.requests_per_minute)} editable type="number"
            onChange={(v) => updateConfig("rate_limit", "requests_per_minute", parseInt(v, 10) || 60)} />
          <ConfigField label="Requests/Hour" value={String(config.rate_limit.requests_per_hour)} editable type="number"
            onChange={(v) => updateConfig("rate_limit", "requests_per_hour", parseInt(v, 10) || 1000)} />
        </div>
      )}

      {/* Save Button */}
      {config && (
        <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={saveConfig} disabled={saving} style={saveBtn}>{saving ? "Saving..." : "Save Config"}</button>
          {saveMsg && <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-ok, green)" }}>{saveMsg}</span>}
        </div>
      )}

      {/* Engine Info */}
      {engine && typeof engine === "object" && (
        <div style={s.section}>
          <div style={s.sectionTitle}>Engine Info</div>
          {Object.entries(engine).map(([k, v]) => (
            <div key={k} style={s.statusRow}>
              <span style={s.statusKey}>{k}</span>
              <span style={s.statusVal}>{String(v)}</span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}

function ConfigField({ label, value, editable, onChange, type = "text" }: {
  label: string; value: string; editable: boolean;
  onChange: (v: string) => void; type?: string;
}) {
  if (type === "checkbox") {
    return (
      <div style={s.statusRow}>
        <span style={s.statusKey}>{label}</span>
        {editable ? (
          <input type="checkbox" checked={value === "true"} onChange={() => onChange(value === "true" ? "false" : "true")} />
        ) : (
          <span style={s.statusVal}>{value}</span>
        )}
      </div>
    );
  }
  return (
    <div style={s.statusRow}>
      <span style={s.statusKey}>{label}</span>
      {editable ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
        />
      ) : (
        <span style={s.statusVal}>{type === "password" && value ? "••••••" : value}</span>
      )}
    </div>
  );
}

const editBtn: React.CSSProperties = {
  background: "var(--color-surface-alt)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  color: "var(--color-text-secondary)",
  cursor: "pointer",
  fontSize: "var(--font-size-sm)",
  padding: "2px 10px",
};

const saveBtn: React.CSSProperties = {
  background: "var(--color-accent)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-md)",
  padding: "8px 20px",
  fontSize: "var(--font-size-base)",
  cursor: "pointer",
  fontWeight: 600,
};

const inputStyle: React.CSSProperties = {
  background: "var(--color-surface)",
  color: "var(--color-text)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "2px 6px",
  fontSize: "var(--font-size-sm)",
  flex: 1,
  maxWidth: 250,
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  maxWidth: 250,
};

const testBtn: React.CSSProperties = {
  background: "transparent",
  color: "var(--color-text-secondary)",
  border: "1px solid var(--color-border)",
  borderRadius: "var(--radius-sm)",
  padding: "4px 12px",
  fontSize: "var(--font-size-sm)",
  cursor: "pointer",
};
