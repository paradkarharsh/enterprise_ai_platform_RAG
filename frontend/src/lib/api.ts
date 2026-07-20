/**
 * API Client for Enterprise AI Knowledge Platform backend.
 */
// Connect directly to backend API URL (supports local localhost default or production Railway URL)
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const API_PREFIX = "/api/v1";

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  token?: string;
};

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, headers = {}, token } = options;

  const config: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
      ...headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };

  if (body) {
    config.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${API_PREFIX}${endpoint}`, config);

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("auth-storage");
      window.location.href = "/login?expired=1";
      throw new Error("Session expired. Please log in again.");
    }
    const error = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(error.detail || `API Error: ${res.status}`);
  }

  return res.json();
}

export const api = {
  // Auth
  auth: {
    register: (data: { email: string; username: string; password: string; full_name?: string }) =>
      request("/auth/register", { method: "POST", body: data }),
    login: (data: { email: string; password: string }) =>
      request("/auth/login", { method: "POST", body: data }),
    me: (token: string) =>
      request("/auth/me", { token }),
    oauthUrl: (provider: string) =>
      request(`/auth/oauth/url/${provider}`),
    oauthCallback: (data: { code: string; provider: string }) =>
      request("/auth/oauth/callback", { method: "POST", body: data }),
  },

  // Chat
  chat: {
    send: (data: { message: string; conversation_id?: string; model?: string; provider?: string }, token?: string) =>
      request("/chat", { method: "POST", body: data, token }),
    conversations: (token: string) =>
      request("/chat/conversations", { token }),
    messages: (conversationId: string, token: string) =>
      request(`/chat/conversations/${conversationId}/messages`, { token }),
  },

  // Search
  search: {
    query: (data: { query: string; search_type?: string; top_k?: number }, token?: string) =>
      request("/search", { method: "POST", body: data, token }),
  },

  // Upload
  upload: {
    document: async (file: File, token: string) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}${API_PREFIX}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      return res.json();
    },
    list: (token: string) =>
      request<Record<string, unknown>[]>("/upload", { token }),
    status: (id: string, token: string) =>
      request<Record<string, unknown>>(`/upload/${id}`, { token }),
    delete: (id: string, token: string) =>
      request<Record<string, unknown>>(`/upload/${id}`, { method: "DELETE", token }),
  },

  // Graph
  graph: {
    query: (data: { query?: string; cypher?: string; entity_name?: string }, token?: string) =>
      request("/graph/query", { method: "POST", body: data, token }),
    stats: (token?: string) =>
      request("/graph/stats", { token }),
    searchEntities: (query: string) =>
      request(`/graph/search/${encodeURIComponent(query)}`),
    all: (token?: string) =>
      request<{ nodes: any[]; edges: any[] }>("/graph/all", { token }),
  },

  // Analytics
  analytics: {
    dashboard: (token: string) =>
      request("/analytics/dashboard", { token }),
    queryMetrics: (token: string) =>
      request("/analytics/query-metrics", { token }),
  },

  // Tickets
  tickets: {
    list: (token: string) =>
      request<Record<string, unknown>[]>("/tickets", { token }),
    create: (data: { department: string; summary: string; priority?: string }, token: string) =>
      request<Record<string, unknown>>("/tickets", { method: "POST", body: data, token }),
    update: (id: string, data: { status?: string; priority?: string; assigned_agent_id?: string }, token: string) =>
      request<Record<string, unknown>>(`/tickets/${id}`, { method: "PATCH", body: data, token }),
  },

  // Reindex
  reindex: {
    all: (token: string) =>
      request<Record<string, unknown>>("/reindex", { method: "POST", token }),
    document: (id: string, token: string) =>
      request<Record<string, unknown>>(`/reindex/${id}`, { method: "POST", token }),
  },

  // Health
  health: () => fetch(`${API_BASE}/health`).then(r => r.json()),
};

// SSE Stream helper
export async function* streamChat(
  message: string,
  options: { model?: string; provider?: string; token?: string } = {}
): AsyncGenerator<{ type: string; content?: string; error?: string }> {
  const res = await fetch(`${API_BASE}${API_PREFIX}/chat/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: JSON.stringify({
      message,
      model: options.model,
      provider: options.provider,
      stream: true,
    }),
  });

  const reader = res.body?.getReader();
  const decoder = new TextDecoder();

  if (!reader) return;

  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const data = JSON.parse(line.slice(6));
          yield data;
        } catch { /* skip invalid JSON */ }
      }
    }
  }
}
