import { useState, useEffect, useCallback, useRef } from "react";
import type { AgentInfo, AgentRole, CollaborationPlan } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";

type AgentTab = "agents" | "collaborate" | "plans";

interface CollaborationProgress {
  id: string;
  status: string;
  currentStep: number;
  totalSteps: number;
  steps: { id: string; role: string; status: string; result?: string; error?: string }[];
}

export function AgentsView() {
  const [agentTab, setAgentTab] = useState<AgentTab>("agents");
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [roles, setRoles] = useState<AgentRole[]>([]);
  const [plans, setPlans] = useState<CollaborationPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("general");

  const [collabTask, setCollabTask] = useState("");
  const [collabPattern, setCollabPattern] = useState("sequential");
  const [collabRounds, setCollabRounds] = useState(3);
  const [collabResult, setCollabResult] = useState<Record<string, unknown> | null>(null);
  const [collabRunning, setCollabRunning] = useState(false);
  const [collabProgress, setCollabProgress] = useState<CollaborationProgress | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      setAgents(data.agents || []);
    } catch {
      setError("Failed to fetch agents");
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/roles");
      const data = await res.json();
      setRoles(data.roles || []);
    } catch { /* ignore */ }
  }, []);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch("/api/agents/collaborations");
      const data = await res.json();
      setPlans(data.plans || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAgents(), fetchRoles(), fetchPlans()]).finally(() => setLoading(false));
  }, [fetchAgents, fetchRoles, fetchPlans]);

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((planId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/agents/collaborate/${planId}`);
        const data = await res.json();
        const plan = data.plan ?? data;
        const steps = plan.steps ?? [];
        const currentStep = steps.findIndex(
          (step: { status: string }) => step.status === "running"
        );
        const completedSteps = steps.filter(
          (step: { status: string }) => step.status === "completed"
        ).length;

        setCollabProgress({
          id: plan.id ?? planId,
          status: plan.status ?? "unknown",
          currentStep: currentStep >= 0 ? currentStep + 1 : completedSteps,
          totalSteps: steps.length,
          steps,
        });

        if (plan.status === "completed" || plan.status === "failed") {
          stopPolling();
          setCollabRunning(false);
          if (plan.status === "completed" && plan.result) {
            setCollabResult(plan.result);
          }
          if (plan.status === "failed" && plan.error) {
            setError(plan.error);
          }
          await fetchPlans();
        }
      } catch {
        stopPolling();
        setCollabRunning(false);
      }
    }, 2000);
  }, [stopPolling, fetchPlans]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const createAgent = async () => {
    if (!newName.trim()) return;
    try {
      await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), role: newRole }),
      });
      setNewName("");
      await fetchAgents();
    } catch {
      setError("Failed to create agent");
    }
  };

  const deleteAgent = (name: string) => {
    setPendingDelete(name);
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await fetch(`/api/agents/${pendingDelete}`, { method: "DELETE" });
      await fetchAgents();
    } catch {
      setError("Failed to delete agent");
    }
    setPendingDelete(null);
  };

  const startCollaboration = async () => {
    if (!collabTask.trim()) return;
    setCollabRunning(true);
    setCollabResult(null);
    setCollabProgress(null);
    try {
      const res = await fetch("/api/agents/collaborate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          task: collabTask,
          pattern: collabPattern,
          max_rounds: collabRounds,
        }),
      });
      const data = await res.json();
      const planId = data.plan_id ?? data.id ?? data.result?.plan_id;
      if (planId) {
        startPolling(planId);
      } else {
        setCollabResult(data.result || null);
        setCollabRunning(false);
        await fetchPlans();
      }
    } catch {
      setError("Collaboration failed");
      setCollabRunning(false);
    }
  };

  const patternLabel = (p: string) => {
    const labels: Record<string, string> = {
      sequential: "Sequential",
      parallel: "Parallel",
      debate: "Debate",
      round_robin: "Round Robin",
    };
    return labels[p] || p;
  };

  const statusColor = (status: string) => {
    if (status === "completed") return "var(--color-status-success)";
    if (status === "running") return "var(--color-status-warning)";
    if (status === "failed") return "var(--color-status-error)";
    return "var(--color-status-neutral)";
  };

  const roleBadgeColor = (role: string) => {
    const map: Record<string, string> = {
      coordinator: "var(--color-role-coordinator)",
      researcher: "var(--color-role-researcher)",
      coder: "var(--color-role-coder)",
      reviewer: "var(--color-role-reviewer)",
      general: "var(--color-role-general)",
    };
    return map[role] || "var(--color-role-general)";
  };

  if (loading) return <div className="mix-panel" style={{ color: "var(--color-text-muted)", fontSize: "var(--font-size-base)", textAlign: "center" }}>Loading agents...</div>;
  if (error) return <div className="mix-error" style={{ color: "var(--color-status-error)" }}>{error}</div>;

  return (
    <div className="mix-panel">
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["agents", "collaborate", "plans"] as AgentTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setAgentTab(t)}
            className="mix-btn"
            style={{
              background: agentTab === t ? "var(--color-status-info)" : "transparent",
              color: agentTab === t ? "var(--color-text)" : "var(--color-text-muted)",
              border: `1px solid ${agentTab === t ? "var(--color-status-info)" : "var(--color-border)"}`,
            }}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {agentTab === "agents" && (
        <div>
          <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Agent name"
              className="mix-input"
              style={{ flex: 1, minWidth: 120 }}
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              className="mix-input"
              style={{ width: 140 }}
            >
              {roles.map((r) => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))}
            </select>
            <button onClick={createAgent} className="mix-btn">Create</button>
          </div>

          {agents.map((agent) => (
            <div key={agent.name} className="mix-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <strong style={{ fontSize: 16 }}>{agent.name}</strong>
                  <span style={{
                    marginLeft: 8,
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 12,
                    background: roleBadgeColor(agent.role),
                    color: "#fff",
                  }}>
                    {agent.role}
                  </span>
                </div>
                {agent.name !== "main" && (
                  <button
                    onClick={() => deleteAgent(agent.name)}
                    className="mix-btn"
                    style={{ background: "var(--color-status-error)", padding: "4px 12px" }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div style={{ color: "var(--color-text-muted)", fontSize: 13, marginTop: 4 }}>
                Model: {agent.model}
                {agent.channels.length > 0 && ` | Channels: ${agent.channels.join(", ")}`}
              </div>
              {agent.system_prompt && (
                <div style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 4 }}>
                  {agent.system_prompt}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {agentTab === "collaborate" && (
        <div>
          <textarea
            value={collabTask}
            onChange={(e) => setCollabTask(e.target.value)}
            placeholder="Describe the task for collaboration..."
            className="mix-input"
            style={{ width: "100%", minHeight: 80, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
            {["sequential", "parallel", "debate", "round_robin"].map((p) => (
              <button
                key={p}
                onClick={() => setCollabPattern(p)}
                className="mix-btn"
                style={{
                  background: collabPattern === p ? "var(--color-status-info)" : "transparent",
                  color: collabPattern === p ? "var(--color-text)" : "var(--color-text-muted)",
                  border: `1px solid ${collabPattern === p ? "var(--color-status-info)" : "var(--color-border)"}`,
                }}
              >
                {patternLabel(p)}
              </button>
            ))}
            <input
              type="number"
              value={collabRounds}
              onChange={(e) => setCollabRounds(Number(e.target.value))}
              min={1}
              max={10}
              className="mix-input"
              style={{ width: 80 }}
            />
            <button
              onClick={startCollaboration}
              disabled={collabRunning || !collabTask.trim()}
              className="mix-btn"
              style={{
                background: collabRunning ? "var(--color-text-muted)" : "var(--color-status-success)",
                color: collabRunning ? "var(--color-text-muted)" : "#fff",
              }}
            >
              {collabRunning ? "Running..." : "Start"}
            </button>
          </div>

          {collabProgress && collabRunning && (
            <div className="mix-card" style={{ background: "var(--color-surface)", marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong style={{ fontSize: 14 }}>Step Progress</strong>
                <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                  {collabProgress.currentStep} / {collabProgress.totalSteps}
                </span>
              </div>
              <div style={{
                width: "100%",
                height: 6,
                background: "var(--color-surface-hover)",
                borderRadius: 3,
                overflow: "hidden",
                marginBottom: 10,
              }}>
                <div style={{
                  width: `${collabProgress.totalSteps > 0 ? (collabProgress.currentStep / collabProgress.totalSteps) * 100 : 0}%`,
                  height: "100%",
                  background: "var(--color-status-info)",
                  borderRadius: 3,
                  transition: "width 0.3s ease",
                }} />
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {collabProgress.steps.map((step, i) => (
                  <span key={step.id} style={{
                    padding: "3px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    background: statusColor(step.status),
                    color: "#fff",
                    opacity: step.status === "pending" ? 0.4 : 1,
                  }}>
                    {i + 1}. {step.role} ({step.status})
                  </span>
                ))}
              </div>
            </div>
          )}

          {collabResult && (
            <div className="mix-card" style={{ background: "var(--color-surface)" }}>
              <h4 style={{ margin: "0 0 8px" }}>Result</h4>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "var(--color-text-secondary)" }}>
                {JSON.stringify(collabResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {agentTab === "plans" && (
        <div>
          {plans.length === 0 && <div style={{ color: "var(--color-text-muted)" }}>No collaboration plans yet.</div>}
          {plans.map((plan) => (
            <div key={plan.id} className="mix-card">
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{plan.id}</strong>
                <span style={{ color: statusColor(plan.status) }}>{plan.status}</span>
              </div>
              <div style={{ color: "var(--color-text-muted)", fontSize: 13 }}>{plan.task}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                <span style={{
                  padding: "2px 6px", borderRadius: 4, fontSize: 11,
                  background: "var(--color-surface-hover)", color: "var(--color-text-muted)",
                }}>
                  {patternLabel(plan.pattern)}
                </span>
                {plan.steps.map((step) => (
                  <span key={step.id} style={{
                    padding: "2px 6px", borderRadius: 4, fontSize: 11,
                    background: statusColor(step.status),
                    color: "#fff",
                  }}>
                    {step.role}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {pendingDelete && (
        <ConfirmDialog
          message={`Delete agent "${pendingDelete}"? This cannot be undone.`}
          onConfirm={confirmDelete}
          onCancel={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
