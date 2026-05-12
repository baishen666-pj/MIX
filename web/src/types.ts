export type Tab = "chat" | "skills" | "memory" | "settings";

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
  tool_call?: { function: { name: string; arguments: string } };
  tool_call_id?: string;
  name?: string;
  content?: string;
  tool_calls?: unknown[];
}
