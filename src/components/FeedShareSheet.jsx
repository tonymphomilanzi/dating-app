// src/components/FeedShareSheet.jsx
import { useMemo, useState } from "react";
import { Copy, Check, Share2, Link as LinkIcon, Mail, X } from "lucide-react";

/* ================================================================
   ICONS
   ================================================================ */
function XTwitterIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M18.9 2H22l-6.8 7.8L23.2 22h-6.7l-5.3-6.6L5.6 22H2.4l7.3-8.4L1 2h6.9l4.8 6.1L18.9 2Zm-1.2 18h1.7L7 3.9H5.2l12.5 16.1Z"/>
    </svg>
  );
}
function WhatsAppIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path fill="currentColor" d="M19.1 17.7c-.3-.2-1.7-.8-2-.9-.3-.1-.5-.2-.7.2-.2.3-.8.9-.9 1-.2.2-.3.2-.6.1-.3-.2-1.2-.4-2.3-1.4-.9-.8-1.4-1.8-1.6-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.3-.5.1-.2 0-.4 0-.6-.1-.2-.7-1.7-1-2.3-.3-.6-.6-.5-.7-.5h-.6c-.2 0-.6.1-.9.4-.3.3-1.2 1.1-1.2 2.7 0 1.6 1.2 3.2 1.4 3.4.2.2 2.4 3.7 5.8 5.1.8.3 1.4.5 1.9.7.8.2 1.5.2 2.1.1.6-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4 0-.2-.3-.3-.6-.5Z"/>
      <path fill="currentColor" d="M26.7 5.3A14 14 0 0 0 16.1 1C8.4 1 2.1 7.3 2.1 15c0 2.5.7 4.9 1.9 7L2 31l9.2-2.4c2 1.1 4.3 1.7 6.6 1.7 7.7 0 14-6.3 14-14 0-3.7-1.4-7.2-4-10Zm-10.6 22.6c-2.1 0-4.2-.6-6-1.7l-.4-.2-5.5 1.4 1.5-5.3-.3-.4A11.8 11.8 0 0 1 4.2 15C4.2 8.5 9.6 3.1 16.1 3.1c3.1 0 6.1 1.2 8.3 3.4a11.6 11.6 0 0 1 3.4 8.3c0 6.5-5.3 11.9-11.7 11.9Z"/>
    </svg>
  );
}
function TelegramIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path fill="currentColor" d="M9.6 15.6 9.4 19c.4 0 .6-.2.8-.4l1.9-1.8 3.9 2.9c.7.4 1.2.2 1.4-.6l2.5-11.7c.2-.9-.3-1.2-.9-1L2.7 10.2c-.9.4-.9 1 0 1.3l4.3 1.3 10-6.3c.5-.3 1-.1.6.2L9.6 15.6Z"/>
    </svg>
  );
}
function FacebookIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M24 12.07C24 5.41 18.63 0 12 0S0 5.41 0 12.07C0 18.1 4.39 23.1 10.13 24v-8.44H7.08v-3.49h3.04V9.41c0-3.02 1.8-4.7 4.54-4.7 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.95.93-1.95 1.88v2.26h3.32l-.53 3.5h-2.79V24C19.61 23.1 24 18.1 24 12.07Z"/>
    </svg>
  );
}
function RedditIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0Zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701ZM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249Zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249Zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095Z"/>
    </svg>
  );
}
function LinkedInIcon({ className = "h-6 w-6" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  );
}

/* ================================================================
   SHARE TILE
   ================================================================ */
function ShareTile({ icon, label, onClick, href, colorClass = "" }) {
  const btn = (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full flex-col items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-3 transition-all hover:bg-gray-100 active:scale-95 select-none"
    >
      <div className={`grid h-12 w-12 place-items-center rounded-full bg-white border border-gray-100 shadow-sm ${colorClass}`}>
        {icon}
      </div>
      <span className="text-[11px] font-medium text-gray-500 leading-tight text-center">
        {label}
      </span>
    </button>
  );

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="block"
        onClick={onClick}
      >
        {btn}
      </a>
    );
  }
  return btn;
}

/* ================================================================
   FEED SHARE SHEET
   Props:
     feed      — full feed row (id, title, content, image_url, tags, admin, pinned)
     userId    — current user id (for logging)
     onClose   — close handler
     onShare   — called to log share to DB (fire-and-forget)
   ================================================================ */
export default function FeedShareSheet({ feed, userId, onClose, onShare }) {
  const [copied,   setCopied]   = useState(false);
  const [imgError, setImgError] = useState(false);

  /* ──
     The OG share URL points to our API endpoint which serves:
     - Bots / link-unfurlers → full OG HTML with meta tags
     - Humans               → instant JS redirect to the SPA route
  ── */
  const ogUrl = useMemo(() => {
  // This URL → bots get OG HTML, humans get redirected to SPA
  return `${window.location.origin}/api/me?share=feed&id=${encodeURIComponent(feed.id)}`;
}, [feed.id]);
  /* Direct SPA URL (used as fallback display) */
  const spaUrl = `${window.location.origin}/feeds/${feed.id}`;

  const title     = feed.title;
  const excerpt   = feed.content?.length > 140
    ? feed.content.slice(0, 140) + "…"
    : feed.content;

  const adminName = feed.admin?.display_name || feed.admin?.username || "Admin";

  /* ── Encoded variants ── */
  const enc      = encodeURIComponent;
  const hrefX    = `https://twitter.com/intent/tweet?text=${enc(`${title}\n\n`)}&url=${enc(ogUrl)}`;
  const hrefWa   = `https://wa.me/?text=${enc(`${title}\n${ogUrl}`)}`;
  const hrefTg   = `https://t.me/share/url?url=${enc(ogUrl)}&text=${enc(title)}`;
  const hrefFb   = `https://www.facebook.com/sharer/sharer.php?u=${enc(ogUrl)}`;
  const hrefLi   = `https://www.linkedin.com/sharing/share-offsite/?url=${enc(ogUrl)}`;
  const hrefRed  = `https://www.reddit.com/submit?url=${enc(ogUrl)}&title=${enc(title)}`;
  const hrefMail = `mailto:?subject=${enc(title)}&body=${enc(`${title}\n\n${ogUrl}`)}`;

  /* ── Actions ── */
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(ogUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", ogUrl);
    }
  }

  async function systemShare() {
    if (navigator.share) {
      try {
        await navigator.share({ title, text: excerpt, url: ogUrl });
        onShare?.();
        onClose();
        return;
      } catch { /* cancelled */ }
    }
    await copyLink();
  }

  /* Log platform share (fire-and-forget) */
  function logShare() {
    onShare?.();
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex flex-col bg-white rounded-t-3xl shadow-2xl max-h-[92vh]">

        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3 shrink-0">
          <h2 className="text-base font-extrabold text-gray-900">Share post</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div
          className="flex-1 overflow-y-auto px-4 pb-6 space-y-4 min-h-0"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 24px)" }}
        >

          {/* ── Post preview card ──
              Mirrors what WhatsApp / Telegram / iMessage will show
              when the OG URL is unfurled.
          ── */}
          <div className="rounded-2xl border border-gray-100 overflow-hidden shadow-sm bg-white">
            {/* Cover image */}
            {feed.image_url && !imgError && (
              <div className="relative w-full bg-gray-100 overflow-hidden" style={{ aspectRatio: "1200/630" }}>
                <img
                  src={feed.image_url}
                  alt={title}
                  className="w-full h-full object-cover"
                  onError={() => setImgError(true)}
                />
                {/* Gradient so pinned badge is readable */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                {feed.pinned && (
                  <div className="absolute top-2 left-2 flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-1 shadow">
                    <span className="text-[10px] font-bold text-white">📌 Pinned</span>
                  </div>
                )}
                {/* Bottom-left: mimics how iMessage renders OG cards */}
                <div className="absolute bottom-2 left-2 rounded-md bg-black/50 backdrop-blur-sm px-2 py-0.5">
                  <span className="text-[9px] text-white/80 font-medium uppercase tracking-widest">
                    {window.location.hostname}
                  </span>
                </div>
              </div>
            )}

            {/* Card body */}
            <div className="p-3.5 space-y-2.5">
              {/* Author */}
              <div className="flex items-center gap-2">
                {feed.admin?.avatar_url ? (
                  <img
                    src={feed.admin.avatar_url}
                    alt={adminName}
                    className="h-6 w-6 rounded-full object-cover ring-1 ring-violet-100"
                  />
                ) : (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 text-[10px] font-bold text-white">
                    {adminName.slice(0, 1).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-bold text-gray-700">{adminName}</span>
                <span className="inline-flex items-center rounded-full bg-violet-100 px-1.5 py-0.5 text-[9px] font-bold text-violet-700">
                  Admin
                </span>
              </div>

              {/* Title */}
              <p className="text-sm font-extrabold text-gray-900 leading-snug line-clamp-2">
                {title}
              </p>

              {/* Excerpt */}
              {excerpt && (
                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                  {excerpt}
                </p>
              )}

              {/* Tags */}
              {feed.tags?.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {feed.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {/* URL strip — mimics Twitter/FB link preview footer */}
              <div className="flex items-center gap-1.5 pt-0.5">
                <LinkIcon className="h-3 w-3 text-gray-400 shrink-0" />
                <span className="text-[10px] text-gray-400 truncate">{window.location.hostname}</span>
              </div>
            </div>
          </div>

          {/* ── Copy bar ── */}
          <div className="flex items-center gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
            <LinkIcon className="h-4 w-4 text-gray-400 shrink-0" />
            <span className="flex-1 text-xs text-gray-500 truncate">{spaUrl}</span>
            <button
              onClick={copyLink}
              className={[
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all shrink-0",
                copied
                  ? "bg-green-100 text-green-700"
                  : "bg-violet-600 text-white hover:bg-violet-700 active:scale-95",
              ].join(" ")}
            >
              {copied
                ? <><Check className="h-3.5 w-3.5" /> Copied!</>
                : <><Copy className="h-3.5 w-3.5" /> Copy</>
              }
            </button>
          </div>

          {/* ── Platform grid ── */}
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-5">
            {/* Native share (uses ogUrl so iOS Messages etc. get OG) */}
            <ShareTile
              icon={<Share2 className="h-5 w-5 text-gray-600" />}
              label="More"
              onClick={systemShare}
            />

            <ShareTile
              icon={<XTwitterIcon className="h-5 w-5 text-gray-900" />}
              label="X / Twitter"
              href={hrefX}
              onClick={logShare}
            />

            <ShareTile
              icon={<WhatsAppIcon className="h-5 w-5 text-emerald-500" />}
              label="WhatsApp"
              href={hrefWa}
              onClick={logShare}
            />

            <ShareTile
              icon={<TelegramIcon className="h-5 w-5 text-sky-500" />}
              label="Telegram"
              href={hrefTg}
              onClick={logShare}
            />

            <ShareTile
              icon={<FacebookIcon className="h-5 w-5 text-blue-600" />}
              label="Facebook"
              href={hrefFb}
              onClick={logShare}
            />

            <ShareTile
              icon={<RedditIcon className="h-5 w-5 text-orange-500" />}
              label="Reddit"
              href={hrefRed}
              onClick={logShare}
            />

            <ShareTile
              icon={<LinkedInIcon className="h-5 w-5 text-sky-700" />}
              label="LinkedIn"
              href={hrefLi}
              onClick={logShare}
            />

            <ShareTile
              icon={<Mail className="h-5 w-5 text-gray-600" />}
              label="Email"
              href={hrefMail}
              onClick={logShare}
            />
          </div>
        </div>
      </div>
    </>
  );
}