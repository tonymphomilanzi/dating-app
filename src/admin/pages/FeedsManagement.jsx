// src/admin/pages/FeedsManagement.jsx
import { useState, useEffect, useCallback } from 'react'
import { supabaseAdmin } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'
import FeedComposer from '../components/FeedComposer'
import FeedsTable from '../components/FeedsTable'

export default function FeedsManagement() {
  const { admin, logAction } = useAuth()

  const [feeds,         setFeeds]         = useState([])
  const [loading,       setLoading]       = useState(true)
  const [showComposer,  setShowComposer]  = useState(false)
  const [editingFeed,   setEditingFeed]   = useState(null)
  const [searchTerm,    setSearchTerm]    = useState('')
  const [filterStatus,  setFilterStatus]  = useState('all') // all | published | draft | pinned
  const [stats,         setStats]         = useState({
    total: 0, published: 0, draft: 0, pinned: 0,
    totalLikes: 0, totalComments: 0, totalViews: 0,
  })
  const [toast,         setToast]         = useState(null)

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }, [])

  /* ── Load feeds ── */
  const loadFeeds = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabaseAdmin
        .from('feeds')
        .select(`
          id, title, content, image_url, tags, published, pinned,
          views_count, likes_count, comments_count, shares_count,
          created_at, updated_at,
          admin:admin_users(id, username, display_name, avatar_url)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      const rows = data ?? []
      setFeeds(rows)

      setStats({
        total:         rows.length,
        published:     rows.filter((f) => f.published).length,
        draft:         rows.filter((f) => !f.published).length,
        pinned:        rows.filter((f) => f.pinned).length,
        totalLikes:    rows.reduce((s, f) => s + (f.likes_count    || 0), 0),
        totalComments: rows.reduce((s, f) => s + (f.comments_count || 0), 0),
        totalViews:    rows.reduce((s, f) => s + (f.views_count    || 0), 0),
      })
    } catch (err) {
      console.error('Error loading feeds:', err)
      showToast('Failed to load feeds', 'error')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { loadFeeds() }, [loadFeeds])

  /* ── Create / Update ── */
  const handleSaveFeed = async (formData) => {
    try {
      if (editingFeed) {
        const { error } = await supabaseAdmin
          .from('feeds')
          .update({ ...formData, updated_at: new Date().toISOString() })
          .eq('id', editingFeed.id)
        if (error) throw error
        await logAction('update_feed', 'feed', editingFeed.id, { title: formData.title })
        showToast('Feed updated successfully!')
      } else {
        const { error } = await supabaseAdmin
          .from('feeds')
          .insert({ ...formData, admin_id: admin?.id })
        if (error) throw error
        await logAction('create_feed', 'feed', null, { title: formData.title })
        showToast('Feed published!')
      }

      setShowComposer(false)
      setEditingFeed(null)
      await loadFeeds()
    } catch (err) {
      console.error('Save feed error:', err)
      showToast(err.message || 'Failed to save feed', 'error')
      throw err // re-throw so composer keeps spinner
    }
  }

  /* ── Toggle publish ── */
  const handleTogglePublish = async (feed) => {
    try {
      const { error } = await supabaseAdmin
        .from('feeds')
        .update({ published: !feed.published, updated_at: new Date().toISOString() })
        .eq('id', feed.id)
      if (error) throw error
      await logAction(feed.published ? 'unpublish_feed' : 'publish_feed', 'feed', feed.id, {})
      showToast(feed.published ? 'Feed unpublished' : 'Feed published!')
      await loadFeeds()
    } catch (err) {
      showToast('Failed to update feed', 'error')
    }
  }

  /* ── Toggle pin ── */
  const handleTogglePin = async (feed) => {
    try {
      const { error } = await supabaseAdmin
        .from('feeds')
        .update({ pinned: !feed.pinned, updated_at: new Date().toISOString() })
        .eq('id', feed.id)
      if (error) throw error
      showToast(feed.pinned ? 'Post unpinned' : 'Post pinned to top!')
      await loadFeeds()
    } catch (err) {
      showToast('Failed to update pin status', 'error')
    }
  }

  /* ── Delete ── */
  const handleDelete = async (feed) => {
    if (!window.confirm(`Delete "${feed.title}"? This cannot be undone.`)) return
    try {
      const { error } = await supabaseAdmin
        .from('feeds').delete().eq('id', feed.id)
      if (error) throw error
      await logAction('delete_feed', 'feed', feed.id, { title: feed.title })
      showToast('Feed deleted')
      await loadFeeds()
    } catch (err) {
      showToast('Failed to delete feed', 'error')
    }
  }

  /* ── Filter ── */
  const filteredFeeds = feeds.filter((f) => {
    const matchSearch =
      !searchTerm ||
      f.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      f.content.toLowerCase().includes(searchTerm.toLowerCase())

    const matchStatus =
      filterStatus === 'all'       ? true :
      filterStatus === 'published' ? f.published && !f.pinned :
      filterStatus === 'draft'     ? !f.published :
      filterStatus === 'pinned'    ? f.pinned : true

    return matchSearch && matchStatus
  })

  /* ── Render ── */
  return (
    <div className="space-y-6">
      <AdminToast toast={toast} />

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Feed Management</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            Compose and manage posts visible to all users
          </p>
        </div>
        <button
          onClick={() => { setEditingFeed(null); setShowComposer(true) }}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500
            text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-blue-600/20"
        >
          <PlusIcon className="w-4 h-4" />
          New Post
        </button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Posts',  value: stats.total,         color: 'text-white'       },
          { label: 'Published',    value: stats.published,     color: 'text-green-400'   },
          { label: 'Drafts',       value: stats.draft,         color: 'text-amber-400'   },
          { label: 'Pinned',       value: stats.pinned,        color: 'text-blue-400'    },
          { label: 'Total Views',  value: fmtNum(stats.totalViews),    color: 'text-purple-400' },
          { label: 'Total Likes',  value: fmtNum(stats.totalLikes),    color: 'text-red-400'    },
          { label: 'Comments',     value: fmtNum(stats.totalComments), color: 'text-cyan-400'   },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-800 border border-gray-700 rounded-xl p-4">
            <p className="text-gray-400 text-xs font-medium">{label}</p>
            <p className={`text-xl font-bold mt-1 ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search posts…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 bg-gray-700 border border-gray-600 rounded-lg
                text-white placeholder-gray-500 text-sm focus:outline-none focus:border-blue-500
                focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          {/* Status filter chips */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { id: 'all',       label: 'All'       },
              { id: 'published', label: 'Published' },
              { id: 'draft',     label: 'Drafts'    },
              { id: 'pinned',    label: 'Pinned'    },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilterStatus(id)}
                className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                  filterStatus === id
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                    : 'bg-gray-700 text-gray-400 hover:bg-gray-600 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <button
            onClick={loadFeeds}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-gray-700 hover:bg-gray-600
              border border-gray-600 text-gray-300 rounded-lg text-sm font-medium
              transition-colors disabled:opacity-50"
          >
            <RefreshIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <FeedsTable
        feeds={filteredFeeds}
        loading={loading}
        onEdit={(feed) => { setEditingFeed(feed); setShowComposer(true) }}
        onTogglePublish={handleTogglePublish}
        onTogglePin={handleTogglePin}
        onDelete={handleDelete}
      />

      {/* ── Composer Modal ── */}
      {showComposer && (
        <FeedComposer
          feed={editingFeed}
          onSave={handleSaveFeed}
          onClose={() => { setShowComposer(false); setEditingFeed(null) }}
        />
      )}
    </div>
  )
}

function fmtNum(n) {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

/* ── Inline icons ── */
function PlusIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  )
}
function SearchIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="8" strokeWidth={2} />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35" />
    </svg>
  )
}
function RefreshIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  )
}
function AdminToast({ toast }) {
  if (!toast) return null
  return (
    <div className="fixed top-5 right-5 z-[100] animate-in slide-in-from-top-2 duration-300">
      <div className={`flex items-center gap-3 px-5 py-3.5 rounded-xl shadow-2xl border text-sm font-semibold ${
        toast.type === 'error'
          ? 'bg-red-500/10 border-red-500/30 text-red-400'
          : 'bg-green-500/10 border-green-500/30 text-green-400'
      }`}>
        {toast.type === 'error'
          ? <XCircleIcon className="w-5 h-5 shrink-0" />
          : <CheckCircleIcon className="w-5 h-5 shrink-0" />
        }
        {toast.message}
      </div>
    </div>
  )
}
function CheckCircleIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function XCircleIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}