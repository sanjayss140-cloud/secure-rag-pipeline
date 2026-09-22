export function getApiBase() {
  if (typeof window !== "undefined") {
    // If running in Vite dev mode on localhost with non-backend port, route to local FastAPI
    if (
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
      window.location.port &&
      window.location.port !== "8000"
    ) {
      return "http://127.0.0.1:8000";
    }
    // If hosted on GitHub Pages (*.github.io) or Vercel, route to live Render backend
    if (
      window.location.hostname.includes("github.io") ||
      window.location.hostname.includes("vercel.app")
    ) {
      return "https://mayandi.onrender.com";
    }
    // On production (Render / any cloud host) or when served by backend, use same-origin relative URLs
    return "";
  }
  return "";
}

function endpoint(path) {
  const base = getApiBase();
  return base ? `${base}${path}` : path;
}

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
  const res = await fetch(endpoint("/api/health"));
  if (!res.ok) throw new Error("Health check failed");
  return res.json();
}

export async function checkDetailedHealth() {
  const res = await fetch(endpoint("/api/health/detailed"));
  if (!res.ok) throw new Error("Detailed health check failed");
  return res.json();
}

export async function apiRegister(email, username, password) {
  const res = await fetch(endpoint("/api/auth/register"), {
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
  const res = await fetch(endpoint("/api/auth/login"), {
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
  const res = await fetch(endpoint("/api/auth/me"), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Session invalid");
  return res.json();
}

export async function apiUploadDocuments(files, retries = 2) {
  const formData = new FormData();
  for (const file of files) {
    formData.append("files", file);
  }

  const token = localStorage.getItem("securerag_token");
  const headers = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(endpoint("/api/documents/upload"), {
        method: "POST",
        headers,
        body: formData,
      });

      let data = null;
      const rawText = await res.text();
      try {
        data = JSON.parse(rawText);
      } catch {
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
          continue;
        }
        throw new Error("Server temporarily busy. Please wait a moment and try again.");
      }

      if (!res.ok) {
        if (res.status >= 500 && attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
          continue;
        }
        const errorMsg = data?.detail?.message || data?.detail || "Upload failed";
        throw new Error(errorMsg);
      }
      return data;
    } catch (err) {
      if (attempt === retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
    }
  }
}

export async function apiListDocuments() {
  const res = await fetch(endpoint("/api/documents"), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Could not fetch documents");
  return res.json();
}

export async function apiDeleteDocument(documentId) {
  const res = await fetch(endpoint(`/api/documents/${documentId}`), {
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
  const res = await fetch(endpoint("/api/chat"), {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      question,
      conversation_id: conversationId,
    }),
  });

  let data = null;
  const rawText = await res.text();
  try {
    data = JSON.parse(rawText);
  } catch {
    if (!res.ok) {
      throw new Error(`Chat server momentarily busy (Status ${res.status}). Please retry in a few seconds.`);
    }
  }

  if (!res.ok) {
    if (res.status === 429) {
      throw new Error("Rate limit reached. Please wait a few seconds before asking again.");
    }
    throw new Error(data?.detail?.message || data?.detail || "Chat request failed");
  }
  return data;
}

export async function apiListConversations() {
  const res = await fetch(endpoint("/api/conversations"), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) return { conversations: [] };
  return res.json();
}

export async function apiGetConversation(conversationId) {
  const res = await fetch(endpoint(`/api/conversations/${conversationId}`), {
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Could not load conversation");
  return res.json();
}

export async function apiDeleteConversation(conversationId) {
  const res = await fetch(endpoint(`/api/conversations/${conversationId}`), {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  if (!res.ok) throw new Error("Could not delete conversation");
  return res.json();
}

export async function apiGetAdminStats() {
  const res = await fetch(endpoint("/api/admin/stats"), {
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
  return `${endpoint("/api/chat/stream")}?${params.toString()}`;
}
