import { supabase } from "./supabase.client.js";

const API_BASE = import.meta.env.VITE_API_BASE || "/api";

function buildUrl(url, params) {
  const isAbsolute = /^https?:\/\//i.test(url);
  const baseUrl = isAbsolute ? "" : API_BASE;
  const queryString = params ? "?" + new URLSearchParams(params).toString() : "";
  return `${baseUrl}${url}${queryString}`;
}

async function request(method, url, options = {}) {
  const { params, data, timeoutMs = 10000, signal: externalSignal } = options;

  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;

  const fetchUrl = buildUrl(url, params);

  // Always enforce a timeout, even if caller passes a signal
  const controller = new AbortController();
  const onExternalAbort = () => controller.abort();
  let timeoutId;

  try {
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener("abort", onExternalAbort, { once: true });
    }
    timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(fetchUrl, {
      method,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: ["GET", "HEAD"].includes(method) ? undefined : JSON.stringify(data || {}),
      signal: controller.signal,
      // keepalive: true, // optional: helps on page unload
    });

    if (response.status === 204) return null;

    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch {}

    if (!response.ok) {
      const msg = json?.error || json?.message || `HTTP ${response.status}`;
      const err = new Error(msg);
      err.status = response.status;
      err.body = json;
      throw err;
    }

    return json;
  } catch (error) {
    if (error?.name === "AbortError") {
      const abortError = new Error(
        controller.signal.aborted && externalSignal?.aborted
          ? "Request aborted"
          : `Request timed out after ${timeoutMs}ms`
      );
      abortError.name = "AbortError";
      abortError.status = externalSignal?.aborted ? 0 : 408;
      throw abortError;
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      try { externalSignal.removeEventListener("abort", onExternalAbort); } catch {}
    }
  }
}

export const api = {
  get: (url, options) => request("GET", url, options),
  post: (url, data, options) => request("POST", url, { ...(options || {}), data }),
  patch: (url, data, options) => request("PATCH", url, { ...(options || {}), data }),
  del: (url, options) => request("DELETE", url, options),
};