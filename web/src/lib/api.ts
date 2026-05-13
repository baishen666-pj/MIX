import { z, type ZodType } from "zod";

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchJson<T>(
  url: string,
  schema: ZodType<T>,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    throw new ApiError(
      `API error: ${res.status} ${res.statusText}`,
      res.status,
    );
  }
  const data: unknown = await res.json();
  const result = schema.safeParse(data);
  if (!result.success) {
    console.warn(`API response validation failed for ${url}:`, result.error.flatten());
    return data as T;
  }
  return result.data;
}

export async function postJson<T>(
  url: string,
  body: unknown,
  schema: ZodType<T>,
): Promise<T> {
  return fetchJson(url, schema, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
