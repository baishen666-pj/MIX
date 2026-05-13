export type Tab = "chat" | "skills" | "memory" | "dashboard" | "agents" | "tools" | "settings";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  streaming?: boolean;
  toolEvents?: ToolEvent[];
}

export interface ToolEvent {
  type: "tool_call" | "tool_result";
  name?: string;
  content?: string;
  tool_call_id?: string;
}

export interface Skill {
  name: string;
  version: string;
  description: string;
  trigger: string[];
  handler: string;
}

export interface MemoryEntry {
  id: string;
  type: string;
  content: string;
  tags: string[];
  created_at: string;
}

export interface StreamChunk {
  id: string;
  session_id: string;
  delta: string;
  done: boolean;
  type?: string;
  error?: string;
  tool_call?: { function: { name: string; arguments: string } };
  tool_call_id?: string;
  name?: string;
  content?: string;
  tool_calls?: unknown[];
}

export interface AgentInfo {
  name: string;
  role: string;
  channels: string[];
  allowed_users: string[];
  model: string;
  system_prompt: string;
  status?: string;
}

export interface AgentRole {
  name: string;
  system_prompt: string;
  allowed_tools: string[] | null;
  default_model_tier: string;
  max_iterations: number;
}

export interface CollaborationPlan {
  id: string;
  pattern: string;
  task: string;
  status: string;
  steps: { id: string; role: string; status: string; result?: string; error?: string }[];
  result?: Record<string, unknown>;
}
