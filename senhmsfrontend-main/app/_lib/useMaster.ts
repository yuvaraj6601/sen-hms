"use client";

/**
 * Generic hook for fetching a paginated masters list from
 * the Next.js proxy route → Spring Boot.
 *
 * Usage:
 *   const { data, loading, error, reload } = useMaster<DeptResponse>("/api/masters/departments");
 */

import { useEffect, useState, useCallback } from "react";

export interface PagedData<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

interface UseMasterOptions {
  size?: number;
  params?: Record<string, string>;
}

export function useMaster<T>(
  path: string,
  options: UseMasterOptions = {}
) {
  const { size = 200, params } = options;
  const paramsKey = JSON.stringify(params ?? {});

  const [data,    setData]    = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: "0", size: String(size), ...(JSON.parse(paramsKey) as Record<string, string>) }).toString();
      const res = await fetch(`${path}?${qs}`);
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "Failed to load data");
        setData([]);
      } else {
        // Handle both paginated and non-paginated responses
        const raw = json.data;
        if (raw && typeof raw === "object" && "content" in raw) {
          setData((raw as PagedData<T>).content);
        } else if (Array.isArray(raw)) {
          setData(raw as T[]);
        } else {
          setData([]);
        }
      }
    } catch (e) {
      setError("Network error. Please try again.");
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [path, size, paramsKey]);

  useEffect(() => { load(); }, [load]);

  return { data, loading, error, reload: load };
}

// ── Single-item operations ────────────────────────────────────────────────────

export async function masterCreate<T>(path: string, body: unknown): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.success) return { error: json.error ?? "Failed to create" };
    return { data: json.data as T };
  } catch {
    return { error: "Network error" };
  }
}

export async function masterUpdate<T>(path: string, id: number | string, body: unknown): Promise<{ data?: T; error?: string }> {
  try {
    const res = await fetch(`${path}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok || !json.success) return { error: json.error ?? "Failed to update" };
    return { data: json.data as T };
  } catch {
    return { error: "Network error" };
  }
}

export async function masterToggle(path: string, id: number | string): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${path}/${id}/toggle-status`, { method: "PATCH" });
    const json = await res.json();
    if (!res.ok || !json.success) return { error: json.error ?? "Failed to toggle status" };
    return {};
  } catch {
    return { error: "Network error" };
  }
}

export async function masterDelete(path: string, id: number | string): Promise<{ error?: string }> {
  try {
    const res = await fetch(`${path}/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok || !json.success) return { error: json.error ?? "Failed to delete" };
    return {};
  } catch {
    return { error: "Network error" };
  }
}
