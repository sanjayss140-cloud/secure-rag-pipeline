const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof window !== "undefined" && window.location.hostname !== "localhost" && window.location.hostname !== "127.0.0.1"
    ? "https://secure-rag-pipeline.onrender.com"
    : "http://127.0.0.1:8000");

function getAuthHeaders() {
  const token = localStorage.getItem("securerag_token");
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export async function checkDetailedHealth() {
  const res = await fetch(`${API_BASE}/api/health/detailed`);
  if (!res.ok) throw new Error("Detailed health check failed");
  return res.json();
}

export async function apiRegister(email, username, password) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, username, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Registration failed");
  }
  return data;
}

export async function apiLogin(username_or_email, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username_or_email, password }),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Login failed");
  }
  return data;
}

export async function apiGetMe() {
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Session invalid");
  return res.json();
}

export async function apiUploadDocuments(files) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const token = localStorage.getItem("securerag_token");
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}/api/documents/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  const data = await res.json();
  if (!res.ok) {
    const errorMsg = data.detail?.message || data.detail || "Upload failed";
    throw new Error(errorMsg);
  }
  return data;
}

export async function apiListDocuments() {
  const res = await fetch(`${API_BASE}/api/documents`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Could not fetch documents");
  return res.json();
}

export async function apiDeleteDocument(documentId) {
  const res = await fetch(`${API_BASE}/api/documents/${documentId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Delete failed");
  }
  return data;
}

export async function apiSendMessage(question, conversationId = null) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      question,
      conversation_id: conversationId,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Rate limit reached. Please wait a few seconds before asking again.");
    }
    throw new Error(data.detail?.message || data.detail || "Chat request failed");
  }
  return data;
}

export async function apiListConversations() {
  const res = await fetch(`${API_BASE}/api/conversations`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return { conversations: [] };
  return res.json();
}

export async function apiGetConversation(conversationId) {
  const res = await fetch(`${API_BASE}/api/conversations/${conversationId}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Could not load conversation");
  return res.json();
}

export async function apiDeleteConversation(conversationId) {
  const res = await fetch(`${API_BASE}/api/conversations/${conversationId}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Could not delete conversation");
  return res.json();
}

export async function apiGetAdminStats() {
  const res = await fetch(`${API_BASE}/api/admin/stats`, {
    headers: getAuthHeaders(),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.detail || "Failed to load admin metrics");
  }
  return data;
}

export function getStreamUrl(question, conversationId = null) {
  const params = new URLSearchParams({ question });
  if (conversationId) params.append("conversation_id", conversationId);
  return `${API_BASE}/api/chat/stream?${params.toString()}`;
}
