/**
 * API client for all backend calls from Next.js API routes (server-side).
 * The JWT token lives in the httpOnly cookie "hms_token" — it is read
 * server-side and forwarded to Spring Boot as a Bearer token.
 *
 * Client components call /api/masters/* (Next.js route handlers).
 * Route handlers call this module which talks to Spring Boot.
 */

const BACKEND = process.env.BACKEND_URL ?? "http://localhost:8080/api";

export type ApiResult<T> =
  | { success: true; data: T; totalElements?: number; totalPages?: number; page?: number }
  | { success: false; error: string };

/** Wraps Spring Boot's PagedResponse */
export interface PagedData<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}

async function request<T>(
  path: string,
  token: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  const url = `${BACKEND}${path}`;
  try {
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });

    const text = await res.text();
    if (!text) {
      return res.ok
        ? { success: true, data: null as T }
        : { success: false, error: `HTTP ${res.status}` };
    }

    let payload: { success: boolean; data?: T; error?: string; message?: string };
    try {
      payload = JSON.parse(text);
    } catch {
      return { success: false, error: text };
    }

    if (!res.ok || !payload.success) {
      return { success: false, error: payload.error ?? payload.message ?? `HTTP ${res.status}` };
    }

    return { success: true, data: payload.data as T };
  } catch (err) {
    return { success: false, error: "Cannot reach the server. Please try again." };
  }
}

// ── CRUD helpers ──────────────────────────────────────────────────────────────

export function getList<T>(path: string, token: string, params?: Record<string, string>) {
  const qs = params ? "?" + new URLSearchParams(params).toString() : "";
  return request<PagedData<T>>(`${path}${qs}`, token);
}

export function getOne<T>(path: string, token: string) {
  return request<T>(path, token);
}

export function post<T>(path: string, token: string, body: unknown) {
  return request<T>(path, token, { method: "POST", body: JSON.stringify(body) });
}

export function put<T>(path: string, token: string, body: unknown) {
  return request<T>(path, token, { method: "PUT", body: JSON.stringify(body) });
}

export function patch<T>(path: string, token: string, body?: unknown) {
  return request<T>(path, token, {
    method: "PATCH",
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function del<T>(path: string, token: string) {
  return request<T>(path, token, { method: "DELETE" });
}
