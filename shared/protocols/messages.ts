export type ChannelType =
  | "telegram"
  | "discord"
  | "slack"
  | "whatsapp"
  | "wechat"
  | "signal"
  | "irc"
  | "webchat"
  | "google_chat"
  | "imessage"
  | "teams"
  | "matrix"
  | "feishu"
  | "line";

export type MessageType =
  | "message"
  | "tool_call"
  | "tool_result"
  | "skill"
  | "cron"
  | "system"
  | "error";

export interface MixMessage {
  id: string;
  type: MessageType;
  channel: ChannelType;
  session_id: string;
  user_id: string;
  content: string;
  metadata: Record<string, unknown>;
  timestamp: string;
}

export interface ChatRequest {
  message: string;
  session_id?: string;
  channel?: ChannelType;
  metadata?: Record<string, unknown>;
}

export interface ChatResponse {
  id: string;
  session_id: string;
  content: string;
  tool_calls?: ToolCall[];
  metadata: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  id: string;
  call_id: string;
  output: string;
  error?: string;
}

export interface StreamChunk {
  id: string;
  session_id: string;
  delta: string;
  done: boolean;
  tool_calls?: ToolCall[];
}

export interface SkillManifest {
  name: string;
  version: string;
  description: string;
  trigger: string[];
  parameters: SkillParameter[];
}

export interface SkillParameter {
  name: string;
  type: "string" | "number" | "boolean";
  required: boolean;
  description: string;
}

export interface MemoryEntry {
  id: string;
  type: "fact" | "preference" | "context" | "skill_result";
  content: string;
  tags: string[];
  created_at: string;
  accessed_at: string;
}

export interface ProviderConfig {
  provider: string;
  model: string;
  api_key?: string;
  base_url?: string;
  options?: Record<string, unknown>;
}

export interface MixConfig {
  engine: {
    host: string;
    port: number;
  };
  gateway: {
    host: string;
    port: number;
  };
  llm: ProviderConfig;
  channels: Partial<Record<ChannelType, Record<string, unknown>>>;
  security: {
    dm_policy: "pairing" | "open" | "closed";
    allowed_users: string[];
  };
  memory: {
    db_path: string;
    max_entries: number;
  };
}
