// ─── API HELPER ─────────────────────────────────────────────────────
// Centralized fetch wrapper: attaches the JWT, handles JSON, and
// throws readable errors. Used by Dashboard, Chat, and Profile pages.

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function getToken() {
  return localStorage.getItem("voidsync_token");
}

async function apiFetch(path, options = {}) {
  const token = getToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...options, headers });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // non-JSON response (e.g. empty body)
  }

  if (!res.ok) {
    const message = data?.error || `Request failed with status ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}

// Convenience methods
export const api = {
  get: (path) => apiFetch(path, { method: "GET" }),
  post: (path, body) => apiFetch(path, { method: "POST", body: JSON.stringify(body || {}) }),
  patch: (path, body) => apiFetch(path, { method: "PATCH", body: JSON.stringify(body || {}) }),
  delete: (path) => apiFetch(path, { method: "DELETE" }),
};

export { API_URL, getToken };
