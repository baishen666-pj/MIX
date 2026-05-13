import { z } from "zod";

export const HealthSchema = z.object({
  status: z.enum(["ok", "degraded"]),
  gateway: z.string(),
  engine: z.unknown().nullable(),
  channels: z.array(z.string()),
});

export const SkillsSchema = z.object({
  skills: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    triggers: z.array(z.string()).optional(),
  })),
});

export const SessionsSchema = z.object({
  sessions: z.array(z.object({
    id: z.string(),
    message_count: z.number().optional(),
    title: z.string().optional(),
    created_at: z.string().optional(),
  })),
});

export const MemorySearchSchema = z.array(z.object({
  id: z.string(),
  content: z.string(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.string().optional(),
}));

export const AgentsSchema = z.object({
  agents: z.array(z.object({
    name: z.string(),
    role: z.string().optional(),
    model: z.string().optional(),
    channels: z.array(z.string()).optional(),
    system_prompt: z.string().optional(),
  })),
});

export const ToolsSchema = z.object({
  tools: z.array(z.string()),
  definitions: z.array(z.unknown()),
});

export const ToolHistorySchema = z.object({
  records: z.array(z.object({
    id: z.string(),
    tool_name: z.string(),
    arguments: z.record(z.string(), z.unknown()),
    result: z.string(),
    success: z.boolean(),
    execution_time_ms: z.number(),
    session_id: z.string(),
    timestamp: z.number(),
    chain_id: z.string().nullable().optional(),
  })),
});

export const CollectionsSchema = z.object({
  collections: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    document_count: z.number(),
    embedding_model: z.string(),
  })),
});
