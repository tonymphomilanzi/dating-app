
// src/lib/api.js
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

  // Always enforce a timeout; merge with external signal if provided
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
    });

    if (response.status === 204) return null;

    const responseText = await response.text();
    let responseJson = null;
    try { responseJson = responseText ? JSON.parse(responseText) : null; } catch {}

    if (!response.ok) {
      const errorMessage = responseJson?.error || responseJson?.message || `HTTP ${response.status}`;
      const error = new Error(errorMessage);
      error.status = response.status;
      error.body = responseJson;
      throw error;
    }

    return responseJson;
  } catch (error) {
    if (error?.name === "AbortError") {
      const abortError = new Error(
        externalSignal?.aborted ? "Request aborted" : `Request timed out after ${timeoutMs}ms`
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