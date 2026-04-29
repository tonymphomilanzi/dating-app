// api/me.js
import { createClient } from "@supabase/supabase-js";
import { requireUser } from "./lib/_supabase.js";

/* ================================================================
   HELPERS
   ================================================================ */
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

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&",  "&amp;")
    .replaceAll("<",  "&lt;")
    .replaceAll(">",  "&gt;")
    .replaceAll('"',  "&quot;")
    .replaceAll("'",  "&#039;");
}

function truncate(s = "", n = 200) {
  const str = String(s || "").trim().replace(/\s+/g, " ");
  return str.length > n ? str.slice(0, n - 1) + "…" : str;
}

function getBaseUrl(req) {
  const proto = req.headers["x-forwarded-proto"] || "https";
  const host  = req.headers["x-forwarded-host"]  || req.headers.host;
  return `${proto}://${host}`;
}

/* ================================================================
   BOT DETECTION
   WhatsApp, Telegram, iMessage, Twitter, Facebook, Slack, Discord…
   ================================================================ */
const BOT_AGENTS = [
  "whatsapp", "telegrambot", "twitterbot", "facebookexternalhit",
  "linkedinbot", "slackbot", "discordbot", "applebot", "googlebot",
  "bingbot", "redditbot", "skypeuripreview", "iframely", "embedly",
  "outbrain", "pinterest", "vkshare", "w3c_validator",
  "curl", "python-requests", "axios", "node-fetch", "wget",
];

function isBot(req) {
  const ua = (req.headers["user-agent"] || "").toLowerCase();
  return BOT_AGENTS.some((b) => ua.includes(b));
}

/* ================================================================
   SERVICE ROLE CLIENT  (bypasses RLS — server only, never exposed)
   ================================================================ */
function getServiceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/* ================================================================
   OG HTML DOCUMENT
   Served to bots — contains all meta tags WhatsApp/Telegram read.
   Humans are redirected immediately via <meta refresh> + JS.
   ================================================================ */
function buildOgHtml({
  title,
  description,
  image,
  canonicalUrl,
  redirectUrl,
  siteName = "YourApp",   // ← change to your app name
}) {
  const t          = escapeHtml(title);
  const d          = escapeHtml(description);
  const hasImage   = Boolean(image);
  const twitterCard = hasImage ? "summary_large_image" : "summary";

  return `<!doctype html>
<html lang="en" prefix="og: https://ogp.me/ns#">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${t}</title>
<meta name="description" content="${d}"/>

<!-- ═══ Open Graph — WhatsApp / Facebook / Telegram / LinkedIn ═══ -->
<meta property="og:type"        content="article"/>
<meta property="og:site_name"   content="${escapeHtml(siteName)}"/>
<meta property="og:title"       content="${t}"/>
<meta property="og:description" content="${d}"/>
<meta property="og:url"         content="${escapeHtml(canonicalUrl)}"/>
${hasImage ? `
<meta property="og:image"            content="${escapeHtml(image)}"/>
<meta property="og:image:secure_url" content="${escapeHtml(image)}"/>
<meta property="og:image:type"       content="image/jpeg"/>
<meta property="og:image:width"      content="1200"/>
<meta property="og:image:height"     content="630"/>
<meta property="og:image:alt"        content="${t}"/>` : ""}

<!-- ═══ Twitter Card — X / iMessage ═══ -->
<meta name="twitter:card"        content="${twitterCard}"/>
<meta name="twitter:title"       content="${t}"/>
<meta name="twitter:description" content="${d}"/>
<meta name="twitter:url"         content="${escapeHtml(canonicalUrl)}"/>
${hasImage ? `
<meta name="twitter:image"       content="${escapeHtml(image)}"/>
<meta name="twitter:image:alt"   content="${t}"/>` : ""}

<link rel="canonical" href="${escapeHtml(canonicalUrl)}"/>

<!-- Redirect humans — bots ignore these -->
<meta http-equiv="refresh" content="0; url=${escapeHtml(redirectUrl)}"/>
<script>window.location.replace(${JSON.stringify(redirectUrl)});</script>

<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family:system-ui,-apple-system,sans-serif;
    background:#09090b;color:#fafafa;
    min-height:100vh;display:flex;
    align-items:center;justify-content:center;padding:24px;
  }
  .card{
    background:#18181b;border:1px solid #3f3f46;border-radius:16px;
    overflow:hidden;max-width:540px;width:100%;
    box-shadow:0 25px 60px -15px rgba(0,0,0,.7);
  }
  .cover{width:100%;aspect-ratio:1200/630;object-fit:cover;display:block}
  .body{padding:20px 24px 24px}
  .site{font-size:.65rem;color:#71717a;text-transform:uppercase;
    letter-spacing:.1em;margin-bottom:10px}
  h1{font-size:1.1rem;font-weight:700;line-height:1.4;margin-bottom:8px}
  .desc{font-size:.85rem;color:#a1a1aa;line-height:1.6;margin-bottom:18px}
  a{display:inline-block;font-size:.8rem;color:#8b5cf6;
    border:1px solid #8b5cf640;border-radius:8px;padding:6px 14px;
    text-decoration:none}
  a:hover{background:#8b5cf620}
</style>
</head>
<body>
  <div class="card">
    ${hasImage ? `<img class="cover" src="${escapeHtml(image)}" alt="${t}"/>` : ""}
    <div class="body">
      <div class="site">${escapeHtml(siteName)}</div>
      <h1>${t}</h1>
      <p class="desc">${d}</p>
      <a href="${escapeHtml(redirectUrl)}">View post →</a>
    </div>
  </div>
</body>
</html>`;
}

/* ================================================================
   SHARE HANDLER
   GET /api/me?share=feed&id=<uuid>

   • Bot  → fetch post from Supabase, return OG HTML (200)
   • Human→ instant 302 redirect to SPA route (no DB call)
   ================================================================ */
async function handleShare(req, res) {
  const type    = String(q1(req.query?.share) || "").toLowerCase();
  const id      = String(q1(req.query?.id)    || "").trim();
  const baseUrl = getBaseUrl(req);

  /* Only feed posts for now — extend with more types later */
  if (type !== "feed" || !id) {
    res.setHeader("Location", "/feeds");
    res.setHeader("Cache-Control", "no-store");
    return res.status(302).end();
  }

  const spaUrl = `${baseUrl}/feeds/${encodeURIComponent(id)}`;

  /* ── Human visitor: skip DB, redirect immediately ── */
  if (!isBot(req)) {
    res.setHeader("Location", spaUrl);
    res.setHeader("Cache-Control", "no-store");
    return res.status(302).end();
  }

  /* ── Bot: fetch post and return OG HTML ── */
  try {
    const supabase = getServiceClient();

    const { data: post, error } = await supabase
      .from("feeds")
      .select(`
        id, title, content, image_url, tags, created_at,
        admin:admin_users(username, display_name)
      `)
      .eq("id", id)
      .eq("published", true)
      .maybeSingle();

    const canonicalUrl =
      `${baseUrl}/api/me?share=feed&id=${encodeURIComponent(id)}`;

    if (error || !post) {
      const html = buildOgHtml({
        title:        "Post not found",
        description:  "This post may have been removed or is no longer available.",
        image:        "",
        canonicalUrl,
        redirectUrl:  `${baseUrl}/feeds`,
      });
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "public, max-age=60");
      return res.status(200).send(html);
    }

    /* Build description: content excerpt + tags */
    const adminName  = post.admin?.display_name || post.admin?.username || "Admin";
    const tags       = Array.isArray(post.tags) && post.tags.length
      ? "  " + post.tags.slice(0, 3).map((t) => `#${t}`).join(" ")
      : "";
    const description = truncate(
      post.content || `Posted by ${adminName}`, 180
    ) + tags;

    const html = buildOgHtml({
      title:        post.title,
      description,
      image:        post.image_url || "",  // must be absolute HTTPS URL
      canonicalUrl,
      redirectUrl:  spaUrl,
    });

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    /* Cache 2 min; bots re-scrape after edits via stale-while-revalidate */
    res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=600");
    /* Vary so CDN caches bot/human responses separately */
    res.setHeader("Vary", "User-Agent");
    return res.status(200).send(html);

  } catch (err) {
    console.error("[share] error:", err.message);
    res.setHeader("Location", spaUrl);
    res.setHeader("Cache-Control", "no-store");
    return res.status(302).end();
  }
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
    .select(
      "id, display_name, bio, dob, gender, avatar_url, city, lat, lng, is_premium, is_verified"
    )
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

  const ALLOWED = [
    "display_name", "bio", "dob", "gender",
    "city", "lat", "lng", "avatar_url",
  ];
  const updates = Object.fromEntries(
    Object.entries(body).filter(([k]) => ALLOWED.includes(k))
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
    /* ── PUBLIC: OG share endpoint ──
       GET /api/me?share=feed&id=<uuid>
       Bots get full OG HTML → WhatsApp/Telegram renders image + title.
       Humans get 302 → SPA loads normally.
    ── */
    if (req.method === "GET" && q1(req.query?.share)) {
      return await handleShare(req, res);
    }

    /* ── Authenticated profile routes ── */
    if (req.method === "GET")   return await handleGetProfile(req, res);
    if (req.method === "PATCH") return await handlePatchProfile(req, res);

    res.setHeader("Allow", "GET, PATCH");
    return res.status(405).end();

  } catch (err) {
    console.error("[api/me]", err);
    return res.status(err.statusCode ?? 500).json({
      error: err.message ?? "Internal error",
    });
  }
}