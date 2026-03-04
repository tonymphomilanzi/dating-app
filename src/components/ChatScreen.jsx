import React, { useEffect, useMemo, useRef, useState } from "react";

export default function ChatScreen({
  user = { name: "", avatar: "", online: false },
  messages = [],
  onBack,
  onCall,
  onMore,
  onOpenAttachment,      // (type) => void
  onOpenAttachmentItem,  // (message) => void
  onSend,                // (text) => void
}) {
  const [text, setText] = useState("");
  const [openAttach, setOpenAttach] = useState(false);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const canSend = text.trim().length > 0;

  const send = () => {
    const t = text.trim();
    if (!t) return;
    onSend?.(t);
    setText("");
    setOpenAttach(false);
    inputRef.current?.focus();
  };

  // auto-scroll on new messages
  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length]);

  return (
    <div className="relative min-h-screen bg-white text-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur px-3 py-3">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button
            onClick={onBack}
            className="grid h-10 w-10 place-items-center rounded-full hover:bg-gray-100"
            aria-label="Back"
          >
            <i className="lni lni-chevron-left text-xl" />
          </button>

          <div className="flex min-w-0 items-center gap-3">
            <div className="relative">
              <img
                src={user.avatar}
                alt={user.name}
                className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-violet-200"
                draggable={false}
              />
              {user.online && (
                <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-violet-500 ring-2 ring-white" />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold">{user.name || "User"}</div>
              <div className="text-xs text-gray-500">{user.online ? "Online" : ""}</div>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={onCall}
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-gray-100"
              aria-label="Call"
            >
              <i className="lni lni-phone" />
            </button>
            <button
              onClick={onMore}
              className="grid h-10 w-10 place-items-center rounded-full hover:bg-gray-100"
              aria-label="More"
            >
              <i className="lni lni-more" />
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <main ref={listRef} className="mx-auto max-w-md px-3 pb-44 pt-4 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="mt-24 grid place-items-center text-center">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gray-100 text-gray-500">
              <i className="lni lni-comments text-2xl" />
            </div>
            <div className="mt-3 text-sm text-gray-600">No messages yet</div>
          </div>
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[80%]">
                  {m.attachmentUrl ? (
                    <AttachmentBubble
                      me={m.me}
                      url={m.attachmentUrl}
                      type={m.attachmentType}
                      onOpen={() => onOpenAttachmentItem?.(m)}
                    />
                  ) : (
                    <div
                      className={[
                        "rounded-2xl px-4 py-3",
                        m.me ? "bg-violet-600 text-white" : "bg-gray-100 text-gray-900 border border-gray-200",
                      ].join(" ")}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text || ""}</p>
                    </div>
                  )}
                  {m.time && (
                    <div
                      className={[
                        "mt-1 text-[11px]",
                        m.me ? "text-right text-gray-500" : "text-left text-gray-500",
                      ].join(" ")}
                    >
                      {m.time}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>

      {/* Attachment sheet */}
      {openAttach && (
        <AttachmentSheet
          onClose={() => setOpenAttach(false)}
          onPick={(type) => {
            setOpenAttach(false);
            onOpenAttachment?.(type);
          }}
        />
      )}

      {/* Composer */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-end gap-2 px-3 pb-[env(safe-area-inset-bottom)] pt-2">
          <button
            onClick={() => setOpenAttach((v) => !v)}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border ${openAttach ? "border-violet-300 bg-violet-50 text-violet-700" : "border-gray-200 bg-white text-gray-700"} shadow-sm`}
            aria-label="Attachments"
          >
            <i className="lni lni-plus" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl border border-gray-200 bg-white px-3 py-2 shadow-sm">
            <i className="lni lni-keyboard text-gray-400" />
            <input
              ref={inputRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message..."
              className="w-full bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
              onFocus={() => setOpenAttach(false)}
              onKeyDown={(e)=>{ if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            />
            <button
              onClick={() => onOpenAttachment?.("camera")}
              className="grid h-9 w-9 place-items-center rounded-full text-gray-600 hover:bg-gray-100"
              aria-label="Camera"
            >
              <i className="lni lni-camera" />
            </button>
            <button
              onClick={() => onOpenAttachment?.("gallery")}
              className="grid h-9 w-9 place-items-center rounded-full text-gray-600 hover:bg-gray-100"
              aria-label="Gallery"
            >
              <i className="lni lni-image" />
            </button>
          </div>

          <button
            onClick={send}
            disabled={!canSend}
            className={`grid h-11 w-11 shrink-0 place-items-center rounded-full text-white shadow-md active:scale-95
              ${canSend ? "bg-gradient-to-r from-fuchsia-600 to-violet-600" : "bg-gray-300 cursor-not-allowed"}
            `}
            aria-label="Send"
          >
            <i className="lni lni-telegram-original text-lg" />
          </button>
        </div>
      </div>
    </div>
  );
}

/* Attachment bubble (image/video/file) */
function AttachmentBubble({ me, url, type, onOpen }) {
  const isImg = (type?.startsWith?.("image/")) || /\.(png|jpe?g|gif|webp|avif)$/i.test(url || "");
  const isVid = (type?.startsWith?.("video/")) || /\.(mp4|webm|mov|m4v)$/i.test(url || "");
  return (
    <div
      className={[
        "overflow-hidden rounded-2xl border",
        me ? "border-violet-200 bg-violet-50" : "border-gray-200 bg-gray-100",
      ].join(" ")}
    >
      <button onClick={onOpen} className="block" aria-label="Open attachment">
        {isImg ? (
          <img src={url} alt="Attachment" className="max-h-72 w-full object-cover" />
        ) : isVid ? (
          <div className="relative max-h-72 w-full bg-black">
            <video src={url} controls className="max-h-72 w-full object-contain" />
          </div>
        ) : (
          <div className="flex items-center gap-2 px-4 py-3 text-sm">
            <i className="lni lni-files text-base" />
            <span className="truncate text-gray-800">Attachment</span>
          </div>
        )}
      </button>
    </div>
  );
}

/* Attachment popover (2x3 grid with pointer) */
function AttachmentSheet({ onPick, onClose }) {
  const items = [
    { key: "document", label: "Document", icon: "lni lni-files" },
    { key: "camera", label: "Camera", icon: "lni lni-camera" },
    { key: "gallery", label: "Gallery", icon: "lni lni-image" },
    { key: "audio", label: "Audio", icon: "lni lni-mic" },
    { key: "location", label: "Location", icon: "lni lni-map-marker" },
    { key: "contact", label: "Contact", icon: "lni lni-user" },
  ];

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-20 z-30 flex justify-center px-3">
      <div className="pointer-events-auto relative w-full max-w-sm rounded-3xl border border-gray-200 bg-white p-4 shadow-xl">
        <div className="grid grid-cols-3 gap-4">
          {items.map((it) => (
            <button
              key={it.key}
              onClick={() => onPick?.(it.key)}
              className="group flex flex-col items-center gap-2 rounded-xl p-2 hover:bg-violet-50"
            >
              <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-b from-violet-600 to-fuchsia-600 text-white shadow-md">
                <i className={`${it.icon} text-lg`} />
              </div>
              <span className="text-xs font-medium text-gray-700">{it.label}</span>
            </button>
          ))}
        </div>

        <div className="absolute -bottom-2 left-1/2 h-4 w-4 -translate-x-1/2 rotate-45 border-l border-t border-gray-200 bg-white" />
        <button onClick={onClose} className="absolute -inset-4" aria-label="Close attachment sheet" tabIndex={-1} />
      </div>
    </div>
  );
}