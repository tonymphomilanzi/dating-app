import { supabase } from "./supabase";

async function request(method, url, { params, data } = {}) {
  const { data: session } = await supabase.auth.getSession();
  const token = session?.session?.access_token;
  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`/api${url}${q}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: ["GET","HEAD"].includes(method) ? undefined : JSON.stringify(data || {}),
  });
  const json = await res.json().catch(()=>null);
  if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`);
  return json;
}

export const api = {
  get: (u, o) => request("GET", u, o),
  post: (u, d, o) => request("POST", u, { ...(o||{}), data: d }),
  patch: (u, d, o) => request("PATCH", u, { ...(o||{}), data: d }),
  del: (u, o) => request("DELETE", u, o),
};