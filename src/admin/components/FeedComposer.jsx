// src/admin/components/FeedComposer.jsx
import { useState, useRef, useEffect } from 'react'
import { supabaseAdmin } from '../utils/supabase'

const MAX_TITLE   = 200
const MAX_CONTENT = 5000
const MAX_TAG_LEN = 30
const MAX_TAGS    = 10

export default function FeedComposer({ feed, onSave, onClose }) {
  const isEditing = !!feed

  const [title,      setTitle]      = useState(feed?.title      || '')
  const [content,    setContent]    = useState(feed?.content    || '')
  const [imageUrl,   setImageUrl]   = useState(feed?.image_url  || '')
  const [tags,       setTags]       = useState(feed?.tags       || [])
  const [tagInput,   setTagInput]   = useState('')
  const [published,  setPublished]  = useState(feed?.published  ?? true)
  const [pinned,     setPinned]     = useState(feed?.pinned     ?? false)
  const [saving,     setSaving]     = useState(false)
  const [imageError, setImageError] = useState('')
  const [uploading,  setUploading]  = useState(false)
  const [preview,    setPreview]    = useState(false)

  const fileRef     = useRef(null)
  const contentRef  = useRef(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [content])

  const handleTagKeyDown = (e) => {
    if (['Enter', ',', ' '].includes(e.key)) {
      e.preventDefault()
      addTag()
    }
    if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  const addTag = () => {
    const raw = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
    if (!raw || tags.includes(raw) || tags.length >= MAX_TAGS) {
      setTagInput('')
      return
    }
    if (raw.length > MAX_TAG_LEN) return
    setTags((prev) => [...prev, raw])
    setTagInput('')
  }

  const removeTag = (tag) => setTags((prev) => prev.filter((t) => t !== tag))

  /* ── Image upload ── */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) {
      setImageError('Only JPEG, PNG, WebP, or GIF allowed')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      setImageError('Image must be under 8 MB')
      return
    }

    setImageError('')
    setUploading(true)
    try {
      const ext      = file.name.split('.').pop()
      const path     = `feeds/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await supabaseAdmin.storage
        .from('public-assets')
        .upload(path, file, { upsert: false, contentType: file.type })
      if (upErr) throw upErr

      const { data } = supabaseAdmin.storage.from('public-assets').getPublicUrl(path)
      setImageUrl(data.publicUrl)
    } catch (err) {
      setImageError(err.message || 'Upload failed')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  /* ── Save ── */
  const handleSave = async (asDraft = false) => {
    if (!title.trim())   return alert('Title is required')
    if (!content.trim()) return alert('Content is required')

    setSaving(true)
    try {
      await onSave({
        title:     title.trim(),
        content:   content.trim(),
        image_url: imageUrl.trim() || null,
        tags,
        published: asDraft ? false : published,
        pinned,
      })
    } catch { /* error handled in parent */ }
    finally { setSaving(false) }
  }

  const charPct = Math.round((content.length / MAX_CONTENT) * 100)

  return (
    /* Backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className="relative w-full max-w-3xl max-h-[95vh] flex flex-col
          bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl overflow-hidden"
      >

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-600/30
              flex items-center justify-center">
              <PencilIcon className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h2 className="text-white font-bold text-base leading-tight">
                {isEditing ? 'Edit Post' : 'New Post'}
              </h2>
              <p className="text-gray-500 text-xs">
                {isEditing ? 'Update existing feed post' : 'Compose a new feed post for all users'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Preview toggle */}
            <button
              onClick={() => setPreview(!preview)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                preview
                  ? 'bg-purple-600/20 text-purple-400 border border-purple-600/30'
                  : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
              }`}
            >
              {preview ? 'Editor' : 'Preview'}
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg
                bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition-colors"
            >
              <XIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto">
          {preview ? (
            /* ── PREVIEW MODE ── */
            <div className="p-6">
              <p className="text-xs text-gray-500 font-medium mb-4 uppercase tracking-wider">
                Preview — how users will see this post
              </p>
              <div className="rounded-2xl bg-gray-800 border border-gray-700 overflow-hidden">
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt={title}
                    className="w-full max-h-72 object-cover"
                    onError={() => {}}
                  />
                )}
                <div className="p-5 space-y-3">
                  {/* Author mock */}
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-600
                      flex items-center justify-center text-white text-sm font-bold">A</div>
                    <div>
                      <p className="text-white text-sm font-bold">Admin</p>
                      <p className="text-gray-500 text-xs">just now</p>
                    </div>
                    {pinned && (
                      <span className="ml-auto text-[11px] font-bold text-blue-400
                        bg-blue-400/10 border border-blue-400/20 px-2.5 py-1 rounded-full">
                        📌 Pinned
                      </span>
                    )}
                  </div>
                  <h3 className="text-white font-extrabold text-lg leading-snug">
                    {title || 'Your post title…'}
                  </h3>
                  <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-line">
                    {content || 'Your post content…'}
                  </p>
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {tags.map((t) => (
                        <span key={t} className="text-[11px] bg-gray-700 text-gray-400 px-2.5 py-1 rounded-full">
                          #{t}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Action row mock */}
                  <div className="flex items-center gap-3 pt-3 border-t border-gray-700">
                    <span className="text-gray-500 text-xs">0 likes</span>
                    <span className="text-gray-500 text-xs">0 comments</span>
                    <span className="text-gray-500 text-xs">0 shares</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* ── EDITOR MODE ── */
            <div className="p-6 space-y-5">

              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
                  placeholder="Write a compelling headline…"
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl
                    text-white placeholder-gray-500 text-sm font-medium
                    focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                    transition-colors"
                />
                <div className="flex justify-end mt-1.5">
                  <span className={`text-xs ${title.length > MAX_TITLE * 0.85 ? 'text-amber-400' : 'text-gray-600'}`}>
                    {title.length}/{MAX_TITLE}
                  </span>
                </div>
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Content <span className="text-red-400">*</span>
                </label>
                <textarea
                  ref={contentRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value.slice(0, MAX_CONTENT))}
                  placeholder="Write your post content here… (supports line breaks)"
                  rows={6}
                  style={{ resize: 'none', overflow: 'hidden', minHeight: 140 }}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl
                    text-white placeholder-gray-500 text-sm leading-relaxed
                    focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                    transition-colors"
                />
                {/* Character bar */}
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden mr-3">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        charPct > 90 ? 'bg-red-500' :
                        charPct > 70 ? 'bg-amber-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${charPct}%` }}
                    />
                  </div>
                  <span className={`text-xs shrink-0 ${
                    charPct > 90 ? 'text-red-400' :
                    charPct > 70 ? 'text-amber-400' : 'text-gray-600'
                  }`}>
                    {content.length}/{MAX_CONTENT}
                  </span>
                </div>
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Cover Image
                  <span className="text-gray-500 font-normal ml-2">(optional)</span>
                </label>

                {/* Drop zone */}
                <div
                  onClick={() => fileRef.current?.click()}
                  className="relative border-2 border-dashed border-gray-700 rounded-xl
                    p-6 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-500/5
                    transition-all group"
                >
                  {imageUrl ? (
                    <div className="relative">
                      <img
                        src={imageUrl}
                        alt="Cover"
                        className="max-h-48 mx-auto rounded-lg object-cover"
                        onError={() => setImageError('Could not load image')}
                      />
                      <button
                        onClick={(e) => { e.stopPropagation(); setImageUrl('') }}
                        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-red-500
                          text-white flex items-center justify-center hover:bg-red-600
                          transition-colors shadow-lg"
                      >
                        <XIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : uploading ? (
                    <div className="flex flex-col items-center gap-2 text-blue-400">
                      <SpinnerIcon className="w-8 h-8" />
                      <span className="text-sm font-medium">Uploading…</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-500 group-hover:text-blue-400 transition-colors">
                      <UploadIcon className="w-8 h-8" />
                      <div>
                        <p className="text-sm font-medium">Click to upload image</p>
                        <p className="text-xs mt-0.5">JPEG, PNG, WebP, GIF · max 8 MB</p>
                      </div>
                    </div>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileChange}
                />

                {/* Or paste URL */}
                <div className="mt-2">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => { setImageUrl(e.target.value); setImageError('') }}
                    placeholder="Or paste image URL…"
                    className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-xl
                      text-white placeholder-gray-500 text-sm
                      focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500
                      transition-colors"
                  />
                </div>
                {imageError && (
                  <p className="text-red-400 text-xs mt-1.5">{imageError}</p>
                )}
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Tags
                  <span className="text-gray-500 font-normal ml-2">max {MAX_TAGS}</span>
                </label>
                <div className="flex flex-wrap gap-2 p-3 bg-gray-800 border border-gray-700
                  rounded-xl focus-within:border-blue-500 transition-colors min-h-[52px]">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-1.5 bg-blue-600/20 border border-blue-600/30
                        text-blue-400 text-xs font-medium px-2.5 py-1 rounded-full"
                    >
                      #{tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="text-blue-400/60 hover:text-blue-400 transition-colors"
                      >
                        <XIcon className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {tags.length < MAX_TAGS && (
                    <input
                      type="text"
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value.toLowerCase().slice(0, MAX_TAG_LEN))}
                      onKeyDown={handleTagKeyDown}
                      onBlur={addTag}
                      placeholder={tags.length === 0 ? 'Add tags (press Enter or comma)…' : ''}
                      className="flex-1 min-w-[140px] bg-transparent text-white
                        placeholder-gray-600 text-sm focus:outline-none"
                    />
                  )}
                </div>
                <p className="text-gray-600 text-xs mt-1.5">
                  Press Enter, comma, or Space to add · Backspace to remove last
                </p>
              </div>

              {/* Options row */}
              <div className="flex flex-wrap gap-4 p-4 bg-gray-800 border border-gray-700 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <Toggle checked={published} onChange={setPublished} />
                  <div>
                    <p className="text-sm font-semibold text-white">Publish immediately</p>
                    <p className="text-xs text-gray-500">
                      {published ? 'Visible to all users' : 'Saved as draft'}
                    </p>
                  </div>
                </label>

                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <Toggle checked={pinned} onChange={setPinned} />
                  <div>
                    <p className="text-sm font-semibold text-white">Pin to top</p>
                    <p className="text-xs text-gray-500">Appears first in the feed</p>
                  </div>
                </label>
              </div>

            </div>
          )}
        </div>

        {/* ── Footer actions ── */}
        <div className="flex items-center justify-between gap-3 px-6 py-4
          border-t border-gray-800 bg-gray-900/80 backdrop-blur shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-400
              hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700
              transition-colors"
          >
            Cancel
          </button>
          <div className="flex items-center gap-2">
            {/* Save as draft */}
            <button
              onClick={() => handleSave(true)}
              disabled={saving || !title.trim() || !content.trim()}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-300
                bg-gray-800 hover:bg-gray-700 border border-gray-700 transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Save Draft
            </button>
            {/* Publish / Update */}
            <button
              onClick={() => handleSave(false)}
              disabled={saving || !title.trim() || !content.trim()}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold
                bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20
                transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? (
                <><SpinnerIcon className="w-4 h-4" /> Saving…</>
              ) : isEditing ? (
                <><CheckIcon className="w-4 h-4" /> Update Post</>
              ) : published ? (
                <><SendIcon className="w-4 h-4" /> Publish Post</>
              ) : (
                <><CheckIcon className="w-4 h-4" /> Save Draft</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Toggle component ── */
function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none ${
        checked ? 'bg-blue-600' : 'bg-gray-600'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm
          transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0'}`}
      />
    </button>
  )
}

/* ── Icons ── */
function PencilIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  )
}
function XIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}
function UploadIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  )
}
function SpinnerIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.37 0 0 5.37 0 12h4z" />
    </svg>
  )
}
function CheckIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}
function SendIcon({ className = 'w-5 h-5' }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <line x1="22" y1="2" x2="11" y2="13" strokeWidth={2} strokeLinecap="round" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" strokeWidth={2}
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}