const API_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
  "http://localhost:4000/api";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "ApiError";
  }
}

interface Envelope<T> {
  success: boolean;
  data?: T;
  error?: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers:
        options.body instanceof FormData
          ? options.headers
          : { "Content-Type": "application/json", ...options.headers },
      cache: "no-store",
    });
  } catch {
    throw new ApiError(
      `Could not reach the API at ${API_URL}. Is thes backend running?`,
      0
    );
  }

  let body: Envelope<T> | null = null;
  try {
    body = await res.json();
  } catch {
    // non-JSON response
  }

  if (!res.ok || !body?.success) {
    throw new ApiError(
      body?.error || `Request failed (${res.status})`,
      res.status
    );
  }

  return body.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path, { method: "GET" }),
  post: <T>(path: string, data?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: data instanceof FormData ? data : JSON.stringify(data ?? {}),
    }),
  put: <T>(path: string, data?: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data ?? {}) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};

export function buildQuery(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      usp.set(key, String(value));
    }
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

/** Normalizes list endpoints that may return a bare array or a { items, total, page } shape. */
export function normalizeList<T>(
  data: T[] | { items?: T[]; data?: T[]; total?: number; page?: number; limit?: number; totalPages?: number } | null | undefined
): { items: T[]; total: number; page: number; limit: number; totalPages: number } {
  if (!data) return { items: [], total: 0, page: 1, limit: 20, totalPages: 1 };
  if (Array.isArray(data)) {
    return { items: data, total: data.length, page: 1, limit: data.length || 20, totalPages: 1 };
  }
  const items = data.items || data.data || [];
  return {
    items,
    total: data.total ?? items.length,
    page: data.page ?? 1,
    limit: data.limit ?? items.length ?? 20,
    totalPages: data.totalPages ?? 1,
  };
}
