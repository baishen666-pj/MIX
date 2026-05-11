import { z } from "zod";

export const chatRequestSchema = z.object({
  message: z.string().min(1).max(10000),
  session_id: z.string().uuid().optional(),
});

export const pairingApproveSchema = z.object({
  channel: z.string().min(1),
  code: z.string().min(1),
});

export const wsMessageSchema = z.object({
  message: z.string().min(1).max(10000),
  session_id: z.string().uuid().optional(),
});

export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data);
}
