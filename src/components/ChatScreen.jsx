// src/components/ChatScreen.jsx
import React, {
  useCallback, useEffect, useLayoutEffect,
  useMemo, useRef, useState,
} from "react";

/* ================================================================
   CONSTANTS
   ================================================================ */
const MAX_INPUT_ROWS = 5;
const LINE_HEIGHT    = 24; // px — matches text-sm line-height

/* ================================================================
   ICONS  (inline SVG — no icon-font dependency)
   ================================================================ */
function Icon({ d, size = 20, stroke = true, className = "" }) {
  return stroke ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round"
      strokeLinejoin="round" className={className}>
      {Array.isArray(d)
        ? d.map((p, i) => <path key={i} d={p} />)
        : <path d={d} />}
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="currentColor" className={className}>
      {Array.isArray(d)
        ? d.map((p, i) => <path key={i} d={p} />)
        : <path d={d} />}
    </svg>
  );
}

const ICO = {
  back:     "M19 12H5M12 5l-7 7 7 7",
  phone:    "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 010 1.18 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92v2z",
  more:     ["M12 5h.01", "M12 12h.01", "M12 19h.01"],
  send:     ["M22 2L11 13", "M22 2L15 22 11 13 2 9l20-7z"],
  attach:   "M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48",
  plus:     ["M12 5v14", "M5 12h14"],
  camera:   ["M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z", "M12 17a4 4 0 100-8 4 4 0 000 8z"],
  gallery:  ["M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z", "M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z", "M21 15l-5-5L5 21"],
  mic:      ["M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z", "M19 10v2a7 7 0 01-14 0v-2", "M12 19v4", "M8 23h8"],
  location: ["M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z", "M12 7a3 3 0 100 6 3 3 0 000-6z"],
  contact:  ["M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2", "M12 11a4 4 0 100-8 4 4 0 000 8z"],
  doc:      ["M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z", "M14 2v6h6", "M16 13H8", "M16 17H8", "M10 9H8"],
  play:     "M5 3l14 9-14 9V3z",
  check:    "M20 6L9 17l-5-5",
  checks:   ["M18 6L9 17l-5-5", "M23 6L12 17"],
};

/* ================================================================
   HELPERS
   ================================================================ */
function isImageUrl(url = "", type = "") {
  return type?.startsWith("image/") || /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(url);
}
function isVideoUrl(url = "", type = "") {
  return type?.startsWith("video/") || /\.(mp4|webm|mov|m4v|ogv)$/i.test(url);
}
function clsx(...args) {
  return args.filter(Boolean).join(" ");
}

/* ================================================================
   ATTACHMENT ITEMS CONFIG
   ================================================================ */
const ATTACH_ITEMS = [
  { key: "document", label: "Document", ico: ICO.doc,      color: "from-blue-500 to-blue-700" },
  { key: "camera",   label: "Camera",   ico: ICO.camera,   color: "from-violet-500 to-fuchsia-600" },
  { key: "gallery",  label: "Gallery",  ico: ICO.gallery,  color: "from-pink-500 to-rose-600" },
  { key: "audio",    label: "Audio",    ico: ICO.mic,      color: "from-amber-500 to-orange-600" },
  { key: "location", label: "Location", ico: ICO.location, color: "from-emerald-500 to-teal-600" },
  { key: "contact",  label: "Contact",  ico: ICO.contact,  color: "from-sky-500 to-cyan-600" },
];

/* ================================================================
   MESSAGE STATUS TICK
   ================================================================ */
function Tick({ status }) {
  if (!status || status === "sending") return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
      strokeLinejoin="round" className="opacity-40 animate-pulse">
      <path d={ICO.check} />
    </svg>
  );
  if (status === "sent") return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
      strokeLinejoin="round" className="opacity-60">
      <path d={ICO.check} />
    </svg>
  );
  if (status === "delivered") return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
      strokeLinejoin="round" className="opacity-60">
      {ICO.checks.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
  if (status === "read") return (
    <svg width={14} height={14} viewBox="0 0 24 24" fill="none"
      stroke="#a78bfa" strokeWidth={2.5} strokeLinecap="round"
      strokeLinejoin="round">
      {ICO.checks.map((p, i) => <path key={i} d={p} />)}
    </svg>
  );
  return null;
}

/* ================================================================
   DATE SEPARATOR
   ================================================================ */
function DateSep({ label }) {
  return (
    <div className="flex items-center gap-3 my-3 px-1">
      <div className="flex-1 h-px bg-gray-100" />
      <span className="text-[11px] font-semibold text-gray-400 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-gray-100" />
    </div>
  );
}

/* ================================================================
   ATTACHMENT BUBBLE
   ================================================================ */
function AttachmentBubble({ me, url, type, caption, onOpen }) {
  const isImg = isImageUrl(url, type);
  const isVid = isVideoUrl(url, type);
  const [imgLoaded, setImgLoaded] = useState(false);

  return (
    <button
      onClick={onOpen}
      className={clsx(
        "block w-full overflow-hidden rounded-2xl border text-left",
        me ? "border-violet-200" : "border-gray-200"
      )}
      aria-label="Open attachment"
    >
      {isImg ? (
        <div className="relative bg-gray-100" style={{ minHeight: imgLoaded ? 0 : 120 }}>
          {!imgLoaded && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-6 w-6 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" />
            </div>
          )}
          <img
            src={url} alt={caption || "Image"}
            className="max-h-64 w-full object-cover"
            onLoad={() => setImgLoaded(true)}
            draggable={false}
          />
        </div>
      ) : isVid ? (
        <div className="relative bg-black" style={{ minHeight: 140 }}>
          <video src={url} className="max-h-60 w-full object-contain" preload="metadata" />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-white/90 shadow-lg">
              <Icon d={ICO.play} size={18} className="translate-x-0.5 text-gray-900" />
            </div>
          </div>
        </div>
      ) : (
        <div className={clsx(
          "flex items-center gap-3 px-4 py-3",
          me ? "bg-violet-50" : "bg-gray-50"
        )}>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100">
            <Icon d={ICO.doc} size={18} className="text-violet-700" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-gray-800">
              {caption || url?.split("/").pop() || "File"}
            </p>
            <p className="text-xs text-gray-400">Tap to open</p>
          </div>
        </div>
      )}
      {caption && isImg && (
        <div className={clsx("px-3 py-2 text-xs", me ? "bg-violet-50 text-violet-800" : "bg-gray-50 text-gray-700")}>
          {caption}
        </div>
      )}
    </button>
  );
}

/* ================================================================
   MESSAGE BUBBLE
   ================================================================ */
const MessageBubble = React.memo(function MessageBubble({
  m, onOpenAttachmentItem,
}) {
  const isMine = m.me;

  return (
    <li className={clsx("flex items-end gap-2", isMine ? "justify-end" : "justify-start")}>
      {/* Avatar for other side */}
      {!isMine && m.avatar && (
        <img
          src={m.avatar} alt=""
          className="h-7 w-7 shrink-0 rounded-full object-cover ring-1 ring-gray-200 mb-1"
          draggable={false}
        />
      )}
      {!isMine && !m.avatar && <div className="w-7 shrink-0" />}

      <div className={clsx("flex flex-col gap-0.5 max-w-[78%] sm:max-w-[65%]", isMine ? "items-end" : "items-start")}>
        {/* Sender name (group chats) */}
        {m.senderName && !isMine && (
          <p className="px-1 text-[11px] font-semibold text-violet-600 mb-0.5">{m.senderName}</p>
        )}

        {/* Bubble */}
        {m.attachmentUrl ? (
          <AttachmentBubble
            me={isMine}
            url={m.attachmentUrl}
            type={m.attachmentType}
            caption={m.text}
            onOpen={() => onOpenAttachmentItem?.(m)}
          />
        ) : (
          <div className={clsx(
            "rounded-2xl px-3.5 py-2.5 shadow-sm",
            isMine
              ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 text-white rounded-br-md"
              : "bg-white border border-gray-100 text-gray-900 rounded-bl-md"
          )}>
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {m.text || ""}
            </p>
          </div>
        )}

        {/* Time + status */}
        <div className={clsx(
          "flex items-center gap-1 px-1",
          isMine ? "flex-row-reverse" : "flex-row"
        )}>
          {m.time && (
            <span className="text-[10px] text-gray-400">{m.time}</span>
          )}
          {isMine && <Tick status={m.status} />}
        </div>
      </div>
    </li>
  );
});

/* ================================================================
   TYPING INDICATOR
   ================================================================ */
function TypingDots() {
  return (
    <li className="flex items-end gap-2 justify-start">
      <div className="w-7 shrink-0" />
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white border border-gray-100 px-4 py-3 shadow-sm">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.9s" }}
          />
        ))}
      </div>
    </li>
  );
}

/* ================================================================
   ATTACHMENT POPOVER
   ================================================================ */
function AttachPopover({ onPick, onClose, composerHeight }) {
  const ref = useRef(null);

  /* close on outside click */
  useEffect(() => {
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute inset-x-0 z-20 px-3"
      style={{ bottom: composerHeight + 8 }}
    >
      <div className="mx-auto w-full max-w-md rounded-3xl border border-gray-200 bg-white p-4 shadow-2xl">
        <div className="grid grid-cols-3 gap-3">
          {ATTACH_ITEMS.map((it) => (
            <button
              key={it.key}
              onClick={() => { onClose(); onPick(it.key); }}
              className="group flex flex-col items-center gap-2 rounded-2xl p-3 transition-colors hover:bg-gray-50 active:scale-95"
            >
              <div className={clsx(
                "grid h-13 w-13 place-items-center rounded-2xl bg-gradient-to-br text-white shadow-md",
                "h-12 w-12",
                it.color
              )}>
                <Icon d={it.ico} size={20} />
              </div>
              <span className="text-[11px] font-semibold text-gray-600">{it.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================================================================
   AUTO-RESIZE TEXTAREA
   ================================================================ */
function AutoTextarea({ value, onChange, onSend, onFocus, placeholder, disabled }) {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    const max = LINE_HEIGHT * MAX_INPUT_ROWS;
    el.style.height = Math.min(el.scrollHeight, max) + "px";
    el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden";
  }, [value]);

  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      placeholder={placeholder}
      disabled={disabled}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
      }}
      className="w-full resize-none bg-transparent text-sm leading-6 text-gray-900 placeholder:text-gray-400 focus:outline-none disabled:opacity-50"
      style={{ minHeight: LINE_HEIGHT }}
    />
  );
}

/* ================================================================
   MAIN CHAT SCREEN
   ================================================================ */
export default function ChatScreen({
  user = { name: "", avatar: "", online: false },
  status,
  messages = [],
  onBack,
  onCall,
  onMore,
  onOpenAttachment,
  onOpenAttachmentItem,
  onSend,
}) {
  const [text,       setText]       = useState("");
  const [openAttach, setOpenAttach] = useState(false);
  const [composerH,  setComposerH]  = useState(64);

  const listRef     = useRef(null);
  const composerRef = useRef(null);
  const atBottomRef = useRef(true);

  /* Track composer height for popover positioning */
  useLayoutEffect(() => {
    if (!composerRef.current) return;
    const ro = new ResizeObserver(([e]) => setComposerH(e.contentRect.height));
    ro.observe(composerRef.current);
    return () => ro.disconnect();
  }, []);

  /* Smart scroll — only auto-scroll when already at bottom */
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    if (atBottomRef.current) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    }
  }, [messages.length]);

  const handleScroll = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  /* Group messages by date */
  const grouped = useMemo(() => {
    const result = [];
    let lastDate = null;
    for (const m of messages) {
      const d = m.date || m.time || null;
      if (d && d !== lastDate) {
        result.push({ type: "sep", label: d, id: "sep-" + d });
        lastDate = d;
      }
      result.push({ type: "msg", ...m });
    }
    return result;
  }, [messages]);

  const canSend = text.trim().length > 0;

  const send = useCallback(() => {
    const t = text.trim();
    if (!t) return;
    onSend?.(t);
    setText("");
    setOpenAttach(false);
  }, [text, onSend]);

  const isTyping = status?.toLowerCase().includes("typing");

  return (
    <div className="relative flex flex-col bg-[#f5f5f7]"
      style={{ height: "100dvh" }}>

      {/* ── Header ── */}
      <header className="shrink-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-2 px-3 py-2.5">
          {/* Back */}
          <button
            onClick={onBack}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
            aria-label="Back"
          >
            <Icon d={ICO.back} size={18} />
          </button>

          {/* Avatar + name */}
          <button
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl py-1 px-1.5 hover:bg-gray-50 transition-colors text-left"
            aria-label="View profile"
          >
            <div className="relative shrink-0">
              {user.avatar ? (
                <img
                  src={user.avatar} alt={user.name}
                  className="h-9 w-9 rounded-full object-cover ring-2 ring-violet-200"
                  draggable={false}
                />
              ) : (
                <div className="h-9 w-9 rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 flex items-center justify-center text-sm font-bold text-white">
                  {(user.name || "U").slice(0, 1).toUpperCase()}
                </div>
              )}
              {user.online && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-bold text-gray-900 leading-tight">
                {user.name || "User"}
              </p>
              <p className={clsx(
                "text-[11px] leading-tight font-medium",
                isTyping ? "text-violet-500" : "text-gray-400"
              )}>
                {status || (user.online ? "Online" : "Offline")}
              </p>
            </div>
          </button>

          {/* Actions */}
          <div className="flex shrink-0 items-center gap-0.5">
            <button
              onClick={onCall}
              className="grid h-9 w-9 place-items-center rounded-full text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
              aria-label="Call"
            >
              <Icon d={ICO.phone} size={18} />
            </button>
            <button
              onClick={onMore}
              className="grid h-9 w-9 place-items-center rounded-full text-gray-700 hover:bg-gray-100 active:scale-95 transition-all"
              aria-label="More"
            >
              <Icon d={ICO.more} size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Messages ── */}
      <main
        ref={listRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{ paddingBottom: composerH + 16 }}
      >
        <div className="mx-auto max-w-2xl px-3 pt-4">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <div className="grid h-16 w-16 place-items-center rounded-full bg-white border border-gray-100 shadow-sm">
                <Icon d={ICO.send} size={24} className="text-violet-400 -rotate-45" />
              </div>
              <p className="text-sm font-semibold text-gray-500">No messages yet</p>
              <p className="text-xs text-gray-400">Say hello! 👋</p>
            </div>
          ) : (
            <ul className="space-y-2 pb-2">
              {grouped.map((item) =>
                item.type === "sep" ? (
                  <DateSep key={item.id} label={item.label} />
                ) : (
                  <MessageBubble
                    key={item.id}
                    m={item}
                    onOpenAttachmentItem={onOpenAttachmentItem}
                  />
                )
              )}
              {isTyping && <TypingDots />}
            </ul>
          )}
        </div>
      </main>

      {/* ── Attachment popover ── */}
      {openAttach && (
        <AttachPopover
          onPick={(type) => onOpenAttachment?.(type)}
          onClose={() => setOpenAttach(false)}
          composerHeight={composerH}
        />
      )}

      {/* ── Composer ── */}
      <div
        ref={composerRef}
        className="fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur-xl border-t border-gray-100 shadow-[0_-1px_12px_rgba(0,0,0,0.06)]"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2 px-3 py-2">

          {/* Attach toggle */}
          <button
            onClick={() => setOpenAttach((v) => !v)}
            className={clsx(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full border transition-all active:scale-95",
              openAttach
                ? "border-violet-300 bg-violet-50 text-violet-700 shadow-sm"
                : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50"
            )}
            aria-label="Attachments"
          >
            <Icon
              d={ICO.plus}
              size={18}
              className={clsx("transition-transform duration-200", openAttach ? "rotate-45" : "rotate-0")}
            />
          </button>

          {/* Input pill */}
          <div className="flex min-w-0 flex-1 items-end gap-1.5 rounded-2xl border border-gray-200 bg-white px-3.5 py-2 shadow-sm focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
            <AutoTextarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onSend={send}
              onFocus={() => setOpenAttach(false)}
              placeholder="Message…"
            />

            {/* Camera quick-action — hidden when typing */}
            {!canSend && (
              <div className="flex shrink-0 items-center gap-0.5 mb-0.5">
                <button
                  onClick={() => onOpenAttachment?.("camera")}
                  className="grid h-8 w-8 place-items-center rounded-full text-gray-500 hover:bg-gray-100 active:scale-95 transition-all"
                  aria-label="Camera"
                >
                  <Icon d={ICO.camera} size={17} />
                </button>
                <button
                  onClick={() => onOpenAttachment?.("gallery")}
                  className="grid h-8 w-8 place-items-center rounded-full text-gray-500 hover:bg-gray-100 active:scale-95 transition-all"
                  aria-label="Gallery"
                >
                  <Icon d={ICO.gallery} size={17} />
                </button>
              </div>
            )}
          </div>

          {/* Send / mic button */}
          <button
            onClick={send}
            disabled={false}
            aria-label={canSend ? "Send" : "Voice message"}
            className={clsx(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full text-white shadow-md transition-all active:scale-95",
              canSend
                ? "bg-gradient-to-br from-violet-600 to-fuchsia-600 scale-100"
                : "bg-gradient-to-br from-violet-500 to-fuchsia-500 scale-95 opacity-90"
            )}
          >
            {canSend
              ? <Icon d={ICO.send} size={17} className="-translate-y-px translate-x-px" />
              : <Icon d={ICO.mic} size={17} />
            }
          </button>
        </div>
      </div>
    </div>
  );
}