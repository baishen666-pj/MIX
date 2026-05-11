import { z } from "zod";

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  session_id: z.string().uuid().optional(),
  channel: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const pairingApproveSchema = z.object({
  channel: z.string().min(1),
  code: z.string().min(1),
});

export const wsMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  session_id: z.string().uuid().optional(),
});

export type ValidatedChatRequest = z.infer<typeof chatRequestSchema>;

export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data);
}
