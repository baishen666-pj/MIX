import { useState, useEffect, useCallback } from "react";
import { type ZodType } from "zod";

interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useApi<T>(url: string | null, schema?: ZodType<T>, options?: RequestInit): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetcher = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, options);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: unknown = await res.json();
      if (schema) {
        const result = schema.safeParse(raw);
        if (!result.success) {
          console.warn(`Validation failed for ${url}:`, result.error.flatten());
        }
        setData((result.success ? result.data : raw) as T);
      } else {
        setData(raw as T);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    fetcher();
  }, [fetcher]);

  return { data, loading, error, refetch: fetcher };
}

export function usePostApi<T>() {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = useCallback(async (url: string, body: unknown, schema?: ZodType<T>): Promise<T | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw: unknown = await res.json();
      if (schema) {
        const result = schema.safeParse(raw);
        if (!result.success) {
          console.warn(`Validation failed for POST ${url}:`, result.error.flatten());
        }
        setData((result.success ? result.data : raw) as T);
        return (result.success ? result.data : raw) as T;
      }
      setData(raw as T);
      return raw as T;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Request failed";
      setError(msg);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, post };
}
