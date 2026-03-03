import React, { useMemo, useState } from "react";

export default function MessagesList({
  threads = [],
  favorites = [],
  onOpenThread,   // (thread) => void
  onSearch,       // (q) => void
}) {
  const [q, setQ] = useState("");
  const [tab, setTab] = useState("all"); // all | unread | groups

  const handleSearch = (e) => {
    const val = e.target.value;
    setQ(val);
    onSearch?.(val);
  };

  const filtered = useMemo(() => {
    let list = threads || [];
    if (tab === "unread") list = list.filter((t) => (t.unreadCount || 0) > 0);
    if (tab === "groups") list = list.filter((t) => !!t.isGroup);
    if (q?.trim()) {
      const s = q.trim().toLowerCase();
      list = list.filter((t) =>
        (t.title || t.name || "").toLowerCase().includes(s) ||
        (t.lastMessage?.text || "").toLowerCase().includes(s)
      );
    }
    return list;
  }, [threads, q, tab]);

  return (
    <div className="min-h-screen bg-white text-gray-900 pb-[92px]">
      <div className="mx-auto w-full max-w-md px-4 pt-4">
        {/* Title */}
        <h1 className="text-2xl font-semibold tracking-tight">Message</h1>

        {/* Search */}
        <div className="mt-4">
          <label className="block">
            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
              <i className="lni lni-search-alt text-gray-400" />
              <input
                value={q}
                onChange={handleSearch}
                placeholder="Search"
                className="w-full bg-transparent text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none"
              />
            </div>
          </label>
        </div>

        {/* Top avatars row */}
        {favorites?.length > 0 && (
          <div className="no-scrollbar mt-4 flex gap-4 overflow-x-auto pb-1">
            {favorites.map((p) => (
              <button
                key={p.id}
                onClick={() => onOpenThread?.(p.thread || p)}
                className="flex w-16 flex-col items-center"
              >
                <div className="relative">
                  <div className="h-14 w-14 overflow-hidden rounded-full bg-gray-100 ring-2 ring-violet-200">
                    <img
                      src={p.avatar}
                      alt={p.name}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  </div>
                  {/* Online indicator (brand-colored) */}
                  {p.online && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-violet-500 ring-2 ring-white" />
                  )}
                </div>
                <span className="mt-2 w-16 truncate text-center text-xs text-gray-600">
                  {p.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Tabs: segmented with violet accent */}
        <div className="mt-4">
          <div className="inline-flex items-center rounded-full border border-violet-600 bg-white p-1">
            <button
              onClick={() => setTab("all")}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                tab === "all" ? "bg-violet-600 text-white shadow" : "text-gray-700 hover:bg-violet-50"
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTab("unread")}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                tab === "unread" ? "bg-violet-600 text-white shadow" : "text-gray-700 hover:bg-violet-50"
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setTab("groups")}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                tab === "groups" ? "bg-violet-600 text-white shadow" : "text-gray-700 hover:bg-violet-50"
              }`}
            >
              Groups
            </button>
          </div>
        </div>

        {/* Threads list */}
        <ul className="mt-4 space-y-3">
          {filtered.map((t) => {
            const name = t.title || t.name || "Chat";
            const avatar = t.avatar || t.photo;
            const last = t.lastMessage?.text || "";
            const unread = t.unreadCount || 0;
            const time = t.lastMessage?.time || t.updatedAt; // optional

            return (
              <li key={t.id}>
                <button
                  onClick={() => onOpenThread?.(t)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3 text-left shadow-sm hover:bg-gray-50"
                >
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="h-12 w-12 overflow-hidden rounded-full bg-gray-100 ring-2 ring-violet-200">
                      <img
                        src={avatar}
                        alt={name}
                        className="h-full w-full object-cover"
                        draggable={false}
                      />
                    </div>
                    {t.online && (
                      <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-violet-500 ring-2 ring-white" />
                    )}
                  </div>

                  {/* Texts */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="truncate text-[15px] font-semibold text-gray-900">{name}</div>
                      {time && (
                        <span className="shrink-0 text-xs text-gray-500">
                          {typeof time === "string" ? time : new Date(time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </span>
                      )}
                    </div>

                    <div className="mt-0.5 flex items-center gap-2">
                      <div className="min-w-0 flex-1 truncate text-sm text-gray-600">
                        {last}
                      </div>
                      {unread > 0 && (
                        <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-violet-200">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              </li>
            );
          })}

          {filtered.length === 0 && (
            <li className="py-12 text-center text-sm text-gray-500">
              No conversations
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}