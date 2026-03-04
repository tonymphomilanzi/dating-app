import { supabase } from "../../api/lib/supabase";

// Base for API (dev: proxied /api; prod: set VITE_API_BASE to your deployed functions URL)
const API_BASE = import.meta.env.VITE_API_BASE || "/api";

// Build a full URL safely (supports absolute URLs)
function buildUrl(url, params) {
  const isAbs = /^https?:\/\//i.test(url);
  const base = isAbs ? "" : API_BASE;
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  return `${base}${url}${q}`;
}

// Timeout wrapper
function withTimeout(ms) {
  const ctrl = new AbortController();
  const id = setTimeout(() => {
    // Abort reasons are not always supported across browsers; keep it generic
    ctrl.abort();
  }, ms);
  return { signal: ctrl.signal, cancel: () => clearTimeout(id) };
}

async function request(method, url, { params, data, timeoutMs = 10000 } = {}) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;

  const { signal, cancel } = withTimeout(timeoutMs);
  const fetchUrl = buildUrl(url, params);

  try {
    const res = await fetch(fetchUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: ["GET", "HEAD"].includes(method) ? undefined : JSON.stringify(data || {}),
      signal,
    });

    // 204 No Content → return null
    if (res.status === 204) return null;

    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}

    if (!res.ok) {
      const err = new Error(json?.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.body = json;
      throw err;
    }
    return json;
  } catch (e) {
    // Normalize AbortError into a clearer timeout error
    if (e?.name === "AbortError") {
      const err = new Error(`Request timed out after ${timeoutMs}ms`);
      err.status = 408;
      throw err;
    }
    throw e;
  } finally {
    cancel();
  }
}

export const api = {
  get: (u, o) => request("GET", u, o),
  post: (u, d, o) => request("POST", u, { ...(o || {}), data: d }),
  patch: (u, d, o) => request("PATCH", u, { ...(o || {}), data: d }),
  del: (u, o) => request("DELETE", u, o),
};