
async function request(method, url, { params, data } = {}) {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;

  const q = params ? "?" + new URLSearchParams(params).toString() : "";
  const res = await fetch(`/api${url}${q}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: ["GET", "HEAD"].includes(method) ? undefined : JSON.stringify(data || {}),
  });

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
}

export const api = {
  get: (u, o) => request("GET", u, o),
  post: (u, d, o) => request("POST", u, { ...(o || {}), data: d }),
  patch: (u, d, o) => request("PATCH", u, { ...(o || {}), data: d }),
  del: (u, o) => request("DELETE", u, o),
};