// api/me.js
import { requireUser } from "./lib/_supabase.js";
import { createClient } from "@supabase/supabase-js";

/* ================================================================
   HELPERS
   ================================================================ */
function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function truncate(s = "", n = 160) {
  const str = String(s).trim().replace(/\s+/g, " ");
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host  = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function q1(v) {
  return Array.isArray(v) ? v[0] : v;
}

function readJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
  if (typeof b === "string") return JSON.parse(b);
  return {};
}

/* ================================================================
   OG HTML DOCUMENT
   ================================================================ */
function htmlDoc({
  title,
  description,
  image,
  url,
  redirectTo,
  siteName = "Umunkuzi", // ← change to your app name
}) {
  const t   = escapeHtml(title);
  const d   = escapeHtml(description);
  const hasImage   = Boolean(image);
  const twitterCard = hasImage ? "summary_large_image" : "summary";

  // Resolve absolute redirect URL
  const absRedirect = redirectTo.startsWith("http")
    ? redirectTo
    : `${url.split("/api/")[0]}${redirectTo}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${t}</title>
<meta name="description" content="${d}"/>

<!-- Open Graph -->
<meta property="og:title"       content="${t}"/>
<meta property="og:description" content="${d}"/>
<meta property="og:url"         content="${escapeHtml(url)}"/>
<meta property="og:type"        content="article"/>
<meta property="og:site_name"   content="${escapeHtml(siteName)}"/>
${hasImage ? `
<meta property="og:image"        content="${escapeHtml(image)}"/>
<meta property="og:image:width"  content="1200"/>
<meta property="og:image:height" content="630"/>
<meta property="og:image:alt"    content="${t}"/>` : ""}

<!-- Twitter Card -->
<meta name="twitter:card"        content="${twitterCard}"/>
<meta name="twitter:title"       content="${t}"/>
<meta name="twitter:description" content="${d}"/>
${hasImage ? `<meta name="twitter:image" content="${escapeHtml(image)}"/>` : ""}

<link rel="canonical" href="${escapeHtml(absRedirect)}"/>

<!-- Auto-redirect for human visitors -->
<meta http-equiv="refresh" content="0; url=${escapeHtml(absRedirect)}"/>

<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    background:#0f0f13;color:#f4f4f5;
    min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;
  }
  .card{
    background:#18181b;border:1px solid #27272a;border-radius:16px;
    overflow:hidden;max-width:520px;width:100%;box-shadow:0 25px 50px -12px rgba(0,0,0,.6);
  }
  .img-wrap{position:relative;width:100%;aspect-ratio:1200/630;background:#27272a;overflow:hidden}
  .img-wrap img{width:100%;height:100%;object-fit:cover}
  .body{padding:20px 24px 24px}
  .site{font-size:.7rem;color:#71717a;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
  h1{font-size:1.15rem;font-weight:700;line-height:1.35;margin-bottom:8px;color:#fafafa}
  .desc{font-size:.875rem;color:#a1a1aa;line-height:1.6;margin-bottom:16px}
  .redir{font-size:.75rem;color:#52525b}
  a{color:#8b5cf6;text-decoration:none}
  a:hover{text-decoration:underline}
</style>
</head>
<body>
  <div class="card">
    ${hasImage ? `
    <div class="img-wrap">
      <img src="${escapeHtml(image)}" alt="${t}" loading="eager"/>
    </div>` : ""}
    <div class="body">
      <div class="site">${escapeHtml(siteName)}</div>
      <h1>${t}</h1>
      <p class="desc">${d}</p>
      <p class="redir">
        Redirecting… <a href="${escapeHtml(absRedirect)}">Click here if not redirected</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}

/* ================================================================
   SUPABASE ADMIN CLIENT (no RLS — safe for OG/server reads)
   ================================================================ */
function getServiceClient() {
  return createClient(
    process.env.SUPABASE_URL     || process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/* ================================================================
   OG HANDLER — GET /api/me?share=feed&id=<uuid>
   ================================================================ */
async function handleShare(req, res) {
  const type = String(q1(req.query?.share) || "").toLowerCase();
  const id   = String(q1(req.query?.id)    || "").trim();
  const baseUrl = getBaseUrl(req);

  // Build the canonical share URL (this very endpoint)
  const shareUrl = (path) =>
    `${baseUrl}/api/me?share=${type}&id=${encodeURIComponent(id)}` + (path ? `&_=${path}` : "");

  const supabase = getServiceClient();

  /* ── FEED POST ── */
  if (type === "feed") {
    if (!id) {
      return sendOg(res, htmlDoc({
        title:       "Feed • Umunkuzi",
        description: "See the latest posts from our team.",
        image:       "",
        url:         `${baseUrl}/api/me?share=feed`,
        redirectTo:  "/feeds",
      }));
    }

    const { data: feed, error } = await supabase
      .from("feeds")
      .select(`
        id, title, content, image_url, tags, pinned, created_at,
        admin:admin_users(username, display_name, avatar_url)
      `)
      .eq("id", id)
      .eq("published", true)
      .single();

    if (error || !feed) {
      return sendOg(res, htmlDoc({
        title:       "Post not found • Umunkuzi",
        description: "This post may have been removed or is no longer available.",
        image:       "",
        url:         `${baseUrl}/api/me?share=feed&id=${encodeURIComponent(id)}`,
        redirectTo:  "/feeds",
      }));
    }

    const adminName  = feed.admin?.display_name || feed.admin?.username || "Admin";
    const description = truncate(
      feed.content || `Posted by ${adminName}`,
      200
    );
    const tags = Array.isArray(feed.tags) && feed.tags.length
      ? " · " + feed.tags.slice(0, 3).map((t) => `#${t}`).join(" ")
      : "";

    return sendOg(res, htmlDoc({
      title:       feed.title,
      description: description + tags,
      image:       feed.image_url || "",
      url:         `${baseUrl}/api/me?share=feed&id=${encodeURIComponent(feed.id)}`,
      redirectTo:  `/feeds/${encodeURIComponent(feed.id)}`,
    }), 60);
  }

  /* ── FALLBACK ── */
  return sendOg(res, htmlDoc({
    title:       "Umunkuzi",
    description: "Check out Umunkuzi.",
    image:       "",
    url:         baseUrl,
    redirectTo:  "/",
  }));
}

function sendOg(res, html, maxAge = 300) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", `public, max-age=${maxAge}, stale-while-revalidate=600`);
  return res.status(200).send(html);
}

/* ================================================================
   PROFILE HANDLERS
   ================================================================ */
async function handleGetProfile(req, res) {
  const ctx = await requireUser(req, res);
  if (!ctx) return;
  const { supabase, user } = ctx;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, bio, dob, gender, avatar_url, city, lat, lng, is_premium, is_verified")
    .eq("id", user.id)
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ profile });
}

async function handlePatchProfile(req, res) {
  const ctx = await requireUser(req, res);
  if (!ctx) return;
  const { supabase, user } = ctx;
  const body = readJson(req);

  const allowed = ["display_name", "bio", "dob", "gender", "city", "lat", "lng", "avatar_url"];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );
  updates.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("*")
    .single();

  if (error) return res.status(400).json({ error: error.message });
  return res.json({ profile: data });
}

/* ================================================================
   MAIN ROUTER
   ================================================================ */
export default async function handler(req, res) {
  try {
    /* ── Public OG share endpoint ──
       GET /api/me?share=feed&id=<uuid>
       Bots get OG HTML, humans get auto-redirected to the SPA route.
    ── */
    if (req.method === "GET" && q1(req.query?.share)) {
      return await handleShare(req, res);
    }

    /* ── Authenticated profile endpoints ── */
    if (req.method === "GET")   return await handleGetProfile(req, res);
    if (req.method === "PATCH") return await handlePatchProfile(req, res);

    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).end();
  } catch (e) {
    console.error("[api/me]", e);
    return res.status(e.statusCode ?? 500).json({ error: e.message ?? "Internal error" });
  }
}