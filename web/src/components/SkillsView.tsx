import { useState, useCallback } from "react";
import type { Skill } from "../types";
import { EmptyState } from "./EmptyState";
import { useLocale } from "../i18n";
import { s } from "../styles";

interface InstalledPlugin {
  name: string;
  version: string;
  source: string;
  description?: string;
}

interface SkillsViewProps {
  skills: Skill[];
  loading: boolean;
  error: string | null;
}

type SkillsTab = "skills" | "install";

export function SkillsView({ skills, loading, error }: SkillsViewProps) {
  const { t } = useLocale();
  const [activeTab, setActiveTab] = useState<SkillsTab>("skills");
  const [runningSkill, setRunningSkill] = useState<string | null>(null);
  const [skillArgs, setSkillArgs] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);

  const [installSource, setInstallSource] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [installedPlugins, setInstalledPlugins] = useState<InstalledPlugin[]>([]);
  const [pluginsLoaded, setPluginsLoaded] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchInstalled = useCallback(async () => {
    try {
      const res = await fetch("/api/plugins");
      const data = await res.json();
      setInstalledPlugins(data.plugins ?? []);
    } catch {
      /* plugins endpoint may not exist yet */
    }
    setPluginsLoaded(true);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!installSource.trim()) return;
    setInstalling(true);
    setInstallError(null);
    try {
      const res = await fetch("/api/plugins/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: installSource.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setInstallError(json.error ?? `HTTP ${res.status}`);
      } else {
        setInstallSource("");
        await fetchInstalled();
      }
    } catch (err) {
      setInstallError(err instanceof Error ? err.message : "Install failed");
    } finally {
      setInstalling(false);
    }
  }, [installSource, fetchInstalled]);

  const handleUninstall = useCallback(async (name: string) => {
    setActionInProgress(name);
    try {
      const res = await fetch("/api/plugins/uninstall", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setResultError(json.error ?? `HTTP ${res.status}`);
      } else {
        await fetchInstalled();
      }
    } catch (err) {
      setResultError(err instanceof Error ? err.message : "Uninstall failed");
    } finally {
      setActionInProgress(null);
    }
  }, [fetchInstalled]);

  const handleUpdate = useCallback(async (name: string) => {
    setActionInProgress(name);
    try {
      const res = await fetch("/api/plugins/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        setResultError(json.error ?? `HTTP ${res.status}`);
      } else {
        await fetchInstalled();
      }
    } catch (err) {
      setResultError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setActionInProgress(null);
    }
  }, [fetchInstalled]);

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

  const switchToInstall = () => {
    setActiveTab("install");
    if (!pluginsLoaded) fetchInstalled();
  };

  return (
    <main style={s.panel}>
      <h2 style={s.panelTitle}>Skills</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["skills", "install"] as SkillsTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => tab === "install" ? switchToInstall() : setActiveTab(tab)}
            style={{
              ...s.button,
              background: activeTab === tab ? "var(--color-status-info)" : "transparent",
              color: activeTab === tab ? "var(--color-text)" : "var(--color-text-muted)",
              border: `1px solid ${activeTab === tab ? "var(--color-status-info)" : "var(--color-border)"}`,
            }}
          >
            {tab === "skills" ? "Skills" : "Install"}
          </button>
        ))}
      </div>

      {activeTab === "skills" && (
        <>
          {loading && <EmptyState icon="⚙" title={t("empty.loadingSkills")} description={t("empty.skillsLoading")} />}
          {error && <div style={s.error}>{error}</div>}
          {!loading && !error && skills.length === 0 && (
            <EmptyState icon="⚡" title={t("skills.noSkills")} description={t("empty.installPlugin")} />
          )}
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
        </>
      )}

      {activeTab === "install" && (
        <>
          <div style={{ ...s.card, marginBottom: 16 }}>
            <div style={{ ...s.cardHeader, marginBottom: 8 }}>Install Plugin</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                style={{ ...s.input, flex: 1, fontSize: 13 }}
                placeholder="GitHub URL or local path..."
                value={installSource}
                onChange={(e) => setInstallSource(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleInstall()}
                disabled={installing}
              />
              <button
                style={installing ? s.sendBtnDisabled : s.sendBtn}
                onClick={handleInstall}
                disabled={installing || !installSource.trim()}
              >
                {installing ? "Installing..." : "Install"}
              </button>
            </div>
            {installError && <div style={{ ...s.error, marginTop: 8 }}>{installError}</div>}
          </div>

          <div style={s.cardHeader}>Installed Plugins</div>
          {!pluginsLoaded && <div style={s.empty}>Loading...</div>}
          {pluginsLoaded && installedPlugins.length === 0 && (
            <div style={s.empty}>No plugins installed</div>
          )}
          {installedPlugins.map((plugin) => (
            <div key={plugin.name} style={s.card} className="card-hover">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={s.cardHeader}>
                    {plugin.name} <span style={s.badge}>{plugin.version}</span>
                  </div>
                  {plugin.description && (
                    <div style={s.cardDesc}>{plugin.description}</div>
                  )}
                  <div style={{ ...s.cardMeta, fontSize: 11 }}>
                    Source: {plugin.source}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={() => handleUpdate(plugin.name)}
                    disabled={actionInProgress !== null}
                    style={{
                      ...s.button,
                      padding: "4px 10px",
                      fontSize: 12,
                      opacity: actionInProgress !== null ? 0.5 : 1,
                    }}
                  >
                    {actionInProgress === plugin.name ? "Updating..." : "Update"}
                  </button>
                  <button
                    onClick={() => handleUninstall(plugin.name)}
                    disabled={actionInProgress !== null}
                    style={{
                      ...s.button,
                      background: "var(--color-status-error)",
                      color: "#fff",
                      border: "none",
                      padding: "4px 10px",
                      fontSize: 12,
                      opacity: actionInProgress !== null ? 0.5 : 1,
                    }}
                  >
                    {actionInProgress === plugin.name ? "..." : "Uninstall"}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </main>
  );
}
