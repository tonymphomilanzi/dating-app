// src/admin/components/FeedsTable.jsx
import { useState } from 'react'

function timeAgo(iso) {
  if (!iso) return '—'
  const diff = (Date.now() - new Date(iso)) / 1000
  if (diff < 60)     return 'just now'
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtNum(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export default function FeedsTable({
  feeds, loading,
  onEdit, onTogglePublish, onTogglePin, onDelete,
}) {
  const [expandedId, setExpandedId] = useState(null)

  if (loading) {
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
        <div className="p-5 border-b border-gray-700 flex items-center justify-between">
          <div className="h-5 w-32 bg-gray-700 rounded-full animate-pulse" />
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-gray-700/50 animate-pulse">
            <div className="h-12 w-12 rounded-xl bg-gray-700 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-1/2 bg-gray-700 rounded-full" />
              <div className="h-3 w-3/4 bg-gray-700 rounded-full" />
            </div>
            <div className="h-6 w-20 bg-gray-700 rounded-full" />
            <div className="h-6 w-16 bg-gray-700 rounded-full" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
      {/* Table header */}
      <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold text-sm">Posts</span>
          <span className="bg-gray-700 text-gray-400 text-xs font-bold px-2 py-0.5 rounded-full">
            {feeds.length}
          </span>
        </div>
        <div className="hidden sm:grid grid-cols-5 gap-8 text-xs font-semibold text-gray-500 uppercase tracking-wider pr-2">
          <span>Views</span>
          <span>Likes</span>
          <span>Comments</span>
          <span>Status</span>
          <span className="text-right">Actions</span>
        </div>
      </div>

      {feeds.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center">
            <NewsIcon className="w-8 h-8 text-gray-600" />
          </div>
          <p className="text-gray-400 font-medium">No posts found</p>
          <p className="text-gray-600 text-sm">Create your first feed post above.</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-700/50">
          {feeds.map((feed) => {
            const isExpanded  = expandedId === feed.id
            const admin       = feed.admin
            const adminName   = admin?.display_name || admin?.username || 'Admin'

            return (
              <div key={feed.id} className="hover:bg-gray-700/30 transition-colors">
                {/* Main row */}
                <div className="flex items-start gap-4 px-5 py-4">

                  {/* Cover thumbnail */}
                  <div
                    className="w-12 h-12 rounded-xl overflow-hidden bg-gray-700 shrink-0
                      flex items-center justify-center"
                  >
                    {feed.image_url ? (
                      <img
                        src={feed.image_url}
                        alt={feed.title}
                        className="w-full h-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : (
                      <NewsIcon className="w-5 h-5 text-gray-600" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-white font-semibold text-sm truncate max-w-xs">
                        {feed.title}
                      </p>
                      {feed.pinned && (
                        <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10
                          border border-blue-400/20 px-1.5 py-0.5 rounded-full">
                          📌 Pinned
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500 text-xs mt-0.5 line-clamp-1">
                      {feed.content}
                    </p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className="text-gray-600 text-[11px]">
                        by <span className="text-gray-400 font-medium">{adminName}</span>
                      </span>
                      <span className="text-gray-700">·</span>
                      <span className="text-gray-600 text-[11px]">{timeAgo(feed.created_at)}</span>
                      {feed.tags?.length > 0 && (
                        <>
                          <span className="text-gray-700">·</span>
                          <span className="text-gray-600 text-[11px]">
                            {feed.tags.slice(0, 2).map((t) => `#${t}`).join(' ')}
                            {feed.tags.length > 2 && ` +${feed.tags.length - 2}`}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Mobile stats */}
                    <div className="flex items-center gap-4 mt-2 sm:hidden text-xs text-gray-500">
                      <span className="flex items-center gap-1">
                        <EyeIcon className="w-3 h-3" />{fmtNum(feed.views_count)}
                      </span>
                      <span className="flex items-center gap-1">
                        <HeartIcon className="w-3 h-3" />{fmtNum(feed.likes_count)}
                      </span>
                      <span className="flex items-center gap-1">
                        <CommentIcon className="w-3 h-3" />{fmtNum(feed.comments_count)}
                      </span>
                    </div>

                    {/* Expand button */}
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : feed.id)}
                      className="text-[11px] text-blue-500 hover:text-blue-400 mt-1.5 transition-colors"
                    >
                      {isExpanded ? '▲ Less' : '▼ Preview'}
                    </button>
                  </div>

                  {/* Desktop stats */}
                  <div className="hidden sm:grid grid-cols-5 gap-8 items-center shrink-0 pr-2">
                    <div className="text-center">
                      <p className="text-white text-sm font-bold">{fmtNum(feed.views_count)}</p>
                      <p className="text-gray-600 text-[10px]">views</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white text-sm font-bold">{fmtNum(feed.likes_count)}</p>
                      <p className="text-gray-600 text-[10px]">likes</p>
                    </div>
                    <div className="text-center">
                      <p className="text-white text-sm font-bold">{fmtNum(feed.comments_count)}</p>
                      <p className="text-gray-600 text-[10px]">comments</p>
                    </div>

                    {/* Status badge */}
                    <div>
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full
                        text-[11px] font-bold border ${
                        feed.published
                          ? 'bg-green-500/10 text-green-400 border-green-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          feed.published ? 'bg-green-400' : 'bg-amber-400'
                        }`} />
                        {feed.published ? 'Live' : 'Draft'}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      {/* Edit */}
                      <ActionBtn
                        onClick={() => onEdit(feed)}
                        title="Edit"
                        className="hover:text-blue-400 hover:bg-blue-500/10"
                      >
                        <PencilIcon className="w-3.5 h-3.5" />
                      </ActionBtn>

                      {/* Pin */}
                      <ActionBtn
                        onClick={() => onTogglePin(feed)}
                        title={feed.pinned ? 'Unpin' : 'Pin to top'}
                        className={feed.pinned
                          ? 'text-blue-400 bg-blue-500/10'
                          : 'hover:text-blue-400 hover:bg-blue-500/10'
                        }
                      >
                        <PinIcon className="w-3.5 h-3.5" />
                      </ActionBtn>

                      {/* Publish toggle */}
                      <ActionBtn
                        onClick={() => onTogglePublish(feed)}
                        title={feed.published ? 'Unpublish' : 'Publish'}
                        className={feed.published
                          ? 'text-green-400 bg-green-500/10 hover:text-amber-400 hover:bg-amber-500/10'
                          : 'text-amber-400 bg-amber-500/10 hover:text-green-400 hover:bg-green-500/10'
                        }
                      >
                        {feed.published ? <EyeIcon className="w-3.5 h-3.5" /> : <EyeOffIcon className="w-3.5 h-3.5" />}
                      </ActionBtn>

                      {/* Delete */}
                      <ActionBtn
                        onClick={() => onDelete(feed)}
                        title="Delete"
                        className="hover:text-red-400 hover:bg-red-500/10"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </ActionBtn>
                    </div>
                  </div>
                </div>

                {/* Expanded preview */}
                {isExpanded && (
                  <div className="px-5 pb-4 pt-0 border-t border-gray-700/50 bg-gray-800/50">
                    <div className="mt-3 rounded-xl bg-gray-900 border border-gray-700 p-4">
                      <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line line-clamp-6">
                        {feed.content}
                      </p>
                      {feed.tags?.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-3">
                          {feed.tags.map((t) => (
                            <span key={t} className="text-[11px] bg-gray-700 text-gray-500
                              px-2 py-0.5 rounded-full">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Mobile actions */}
                    <div className="flex items-center gap-2 mt-3 sm:hidden flex-wrap">
                      <button
                        onClick={() => onEdit(feed)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          bg-blue-600/20 text-blue-400 border border-blue-600/30 hover:bg-blue-600/30"
                      >
                        <PencilIcon className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => onTogglePin(feed)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600"
                      >
                        <PinIcon className="w-3.5 h-3.5" />
                        {feed.pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button
                        onClick={() => onTogglePublish(feed)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          border ${feed.published
                          ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          : 'bg-green-500/10 text-green-400 border-green-500/20'
                        }`}
                      >
                        {feed.published ? <EyeOffIcon className="w-3.5 h-3.5" /> : <EyeIcon className="w-3.5 h-3.5" />}
                        {feed.published ? 'Unpublish' : 'Publish'}
                      </button>
                      <button
                        onClick={() => onDelete(feed)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                          bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                      >
                        <TrashIcon className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ActionBtn({ onClick, title, className = '', children }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-7 h-7 flex items-center justify-center rounded-lg text-gray-500
        transition-all duration-150 ${className}`}
    >
      {children}
    </button>
  )
}

/* ── Icons ── */
function NewsIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
    </svg>
  )
}
function PencilIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}
function PinIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
    </svg>
  )
}
function EyeIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}
function EyeOffIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  )
}
function TrashIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  )
}
function HeartIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  )
}
function CommentIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  )
}