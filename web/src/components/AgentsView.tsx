import { useState, useEffect, useCallback } from "react";
import type { AgentInfo, AgentRole, CollaborationPlan } from "../types";
import { s } from "../styles";

type AgentTab = "agents" | "collaborate" | "plans";

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

  const deleteAgent = async (name: string) => {
    try {
      await fetch(`/api/agents/${name}`, { method: "DELETE" });
      await fetchAgents();
    } catch {
      setError("Failed to delete agent");
    }
  };

  const startCollaboration = async () => {
    if (!collabTask.trim()) return;
    setCollabRunning(true);
    setCollabResult(null);
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
      setCollabResult(data.result || null);
      await fetchPlans();
    } catch {
      setError("Collaboration failed");
    } finally {
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
    if (status === "completed") return "#4caf50";
    if (status === "running") return "#ff9800";
    if (status === "failed") return "#f44336";
    return "#888";
  };

  const roleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      coordinator: "#9c27b0",
      researcher: "#2196f3",
      coder: "#4caf50",
      reviewer: "#ff9800",
      general: "#607d8b",
    };
    return colors[role] || "#607d8b";
  };

  if (loading) return <div style={s.loading}>Loading agents...</div>;
  if (error) return <div style={{ ...s.error, color: "#f44336" }}>{error}</div>;

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
        {(["agents", "collaborate", "plans"] as AgentTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setAgentTab(t)}
            style={{
              ...s.button,
              background: agentTab === t ? "#4fc3f7" : "transparent",
              color: agentTab === t ? "#000" : "#aaa",
              border: `1px solid ${agentTab === t ? "#4fc3f7" : "#444"}`,
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
              style={{ ...s.input, flex: 1, minWidth: 120 }}
            />
            <select
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
              style={{ ...s.input, width: 140 }}
            >
              {roles.map((r) => (
                <option key={r.name} value={r.name}>{r.name}</option>
              ))}
            </select>
            <button onClick={createAgent} style={s.button}>Create</button>
          </div>

          {agents.map((agent) => (
            <div key={agent.name} style={s.card}>
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
                    style={{ ...s.button, background: "#f44336", padding: "4px 12px" }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <div style={{ color: "#888", fontSize: 13, marginTop: 4 }}>
                Model: {agent.model}
                {agent.channels.length > 0 && ` | Channels: ${agent.channels.join(", ")}`}
              </div>
              {agent.system_prompt && (
                <div style={{ color: "#aaa", fontSize: 12, marginTop: 4 }}>
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
            style={{ ...s.input, width: "100%", minHeight: 80, resize: "vertical" }}
          />
          <div style={{ display: "flex", gap: 8, margin: "12px 0", flexWrap: "wrap" }}>
            {["sequential", "parallel", "debate", "round_robin"].map((p) => (
              <button
                key={p}
                onClick={() => setCollabPattern(p)}
                style={{
                  ...s.button,
                  background: collabPattern === p ? "#4fc3f7" : "transparent",
                  color: collabPattern === p ? "#000" : "#aaa",
                  border: `1px solid ${collabPattern === p ? "#4fc3f7" : "#444"}`,
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
              style={{ ...s.input, width: 80 }}
            />
            <button
              onClick={startCollaboration}
              disabled={collabRunning || !collabTask.trim()}
              style={{
                ...s.button,
                background: collabRunning ? "#666" : "#4caf50",
                color: collabRunning ? "#999" : "#fff",
              }}
            >
              {collabRunning ? "Running..." : "Start"}
            </button>
          </div>
          {collabResult && (
            <div style={{ ...s.card, background: "#1a2a1a" }}>
              <h4 style={{ margin: "0 0 8px" }}>Result</h4>
              <pre style={{ whiteSpace: "pre-wrap", fontSize: 13, color: "#ccc" }}>
                {JSON.stringify(collabResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {agentTab === "plans" && (
        <div>
          {plans.length === 0 && <div style={{ color: "#888" }}>No collaboration plans yet.</div>}
          {plans.map((plan) => (
            <div key={plan.id} style={s.card}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>{plan.id}</strong>
                <span style={{ color: statusColor(plan.status) }}>{plan.status}</span>
              </div>
              <div style={{ color: "#aaa", fontSize: 13 }}>{plan.task}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                <span style={{
                  padding: "2px 6px", borderRadius: 4, fontSize: 11,
                  background: "#333", color: "#aaa",
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
    </div>
  );
}
