import { useState } from 'react'

const StreamCard = ({ stream, selected, onSelect, onPreview, onAction }) => {
  const [imageError, setImageError] = useState(false)

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diff = now - time
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-900 text-yellow-300 border-yellow-600'
      case 'approved': return 'bg-green-900 text-green-300 border-green-600'
      case 'rejected': return 'bg-red-900 text-red-300 border-red-600'
      default: return 'bg-gray-900 text-gray-300 border-gray-600'
    }
  }

  const likesCount = stream.stream_likes?.[0]?.count || 0
  const commentsCount = stream.stream_comments?.[0]?.count || 0
  const sharesCount = stream.stream_shares?.[0]?.count || 0

  // Generate thumbnail URL from video path if available
  const getThumbnailUrl = () => {
    if (stream.video_url) {
      // If it's a video URL, we might need to generate a thumbnail
      return stream.video_url
    }
    return null
  }

  return (
    <div className={`bg-gray-800 rounded-lg border transition-all duration-200 overflow-hidden ${
      selected ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-700 hover:border-gray-600'
    }`}>
      {/* Selection Checkbox */}
      <div className="p-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-300 text-sm">Select</span>
          </label>
          
          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(stream.status)}`}>
            {stream.status}
          </span>
        </div>
      </div>

      {/* Video Preview */}
      <div className="relative aspect-video bg-gray-900">
        {stream.video_url ? (
          <video
            className="w-full h-full object-cover"
            preload="metadata"
            muted
          >
            <source src={stream.video_url} type="video/mp4" />
          </video>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        
        {/* Play button overlay */}
        <button
          onClick={onPreview}
          className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-0 hover:bg-opacity-30 transition-all duration-200 group"
        >
          <div className="w-12 h-12 rounded-full bg-black bg-opacity-50 flex items-center justify-center group-hover:scale-110 transition-transform">
            <svg className="w-6 h-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z"/>
            </svg>
          </div>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        {/* User Info */}
        <div className="flex items-center space-x-3">
          <img
            className="w-8 h-8 rounded-full object-cover"
            src={stream.profiles?.avatar_url || '/default-avatar.png'}
            alt={stream.profiles?.display_name || 'User'}
            onError={(e) => {
              if (!imageError) {
                e.target.src = '/default-avatar.png'
                setImageError(true)
              }
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-1">
              <p className="text-white text-sm font-medium truncate">
                {stream.profiles?.display_name || 'Unknown User'}
              </p>
              {stream.profiles?.is_verified && (
                <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
              {stream.profiles?.is_premium && (
                <svg className="w-4 h-4 text-yellow-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              )}
            </div>
            <p className="text-gray-400 text-xs">{formatTimeAgo(stream.created_at)}</p>
          </div>
        </div>

        {/* Caption */}
        {stream.caption && (
          <p className="text-gray-300 text-sm line-clamp-2">
            {stream.caption}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex space-x-4">
            <span className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>{stream.views_count || 0}</span>
            </span>
            <span className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>{likesCount}</span>
            </span>
            <span className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{commentsCount}</span>
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex space-x-2 pt-2 border-t border-gray-700">
          {stream.status === 'pending' && (
            <>
              <button
                onClick={() => onAction('approve')}
                className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
              >
                Approve
              </button>
              <button
                onClick={() => onAction('reject')}
                className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                Reject
              </button>
            </>
          )}
          
          {stream.status === 'approved' && (
            <button
              onClick={() => onAction('reject')}
              className="flex-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
            >
              Reject
            </button>
          )}
          
          {stream.status === 'rejected' && (
            <button
              onClick={() => onAction('approve')}
              className="flex-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
            >
              Approve
            </button>
          )}

          <button
            onClick={() => onAction('delete')}
            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
            title="Delete Stream"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

export default StreamCard