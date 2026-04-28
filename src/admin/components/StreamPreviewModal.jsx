import { useState } from 'react'

const StreamPreviewModal = ({ stream, onClose, onAction }) => {
  const [reason, setReason] = useState('')
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)

  const handleActionWithReason = (action) => {
    if (action === 'reject' || action === 'delete') {
      setPendingAction(action)
      setShowReasonInput(true)
    } else {
      onAction(action)
    }
  }

  const confirmAction = () => {
    if (pendingAction) {
      onAction(pendingAction, reason)
      setPendingAction(null)
      setReason('')
      setShowReasonInput(false)
    }
  }

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
      case 'pending': return 'bg-yellow-900 text-yellow-300'
      case 'approved': return 'bg-green-900 text-green-300'
      case 'rejected': return 'bg-red-900 text-red-300'
      default: return 'bg-gray-900 text-gray-300'
    }
  }

  const likesCount = stream.stream_likes?.[0]?.count || 0
  const commentsCount = stream.stream_comments?.[0]?.count || 0
  const sharesCount = stream.stream_shares?.[0]?.count || 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <img
              className="w-10 h-10 rounded-full object-cover"
              src={stream.profiles?.avatar_url || '/default-avatar.png'}
              alt={stream.profiles?.display_name || 'User'}
            />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-semibold text-white">
                  {stream.profiles?.display_name || 'Unknown User'}
                </h2>
                {stream.profiles?.is_verified && (
                  <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(stream.status)}`}>
                  {stream.status}
                </span>
              </div>
              <p className="text-gray-400 text-sm">
                Posted {formatTimeAgo(stream.created_at)}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Video Player */}
        <div className="relative bg-black">
          {stream.video_url ? (
            <video
              className="w-full max-h-96 object-contain"
              controls
              autoPlay
              muted
            >
              <source src={stream.video_url} type="video/mp4" />
              Your browser does not support the video tag.
            </video>
          ) : (
            <div className="w-full h-96 flex items-center justify-center">
              <div className="text-center text-gray-400">
                <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p>Video not available</p>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Caption */}
          {stream.caption && (
            <div className="mb-4">
              <h3 className="text-white font-medium mb-2">Caption</h3>
              <p className="text-gray-300">{stream.caption}</p>
            </div>
          )}

          {/* Stats */}
          <div className="flex items-center space-x-6 mb-6 text-gray-400">
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span>{stream.views_count || 0} views</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <span>{likesCount} likes</span>
            </div>
            
            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <span>{commentsCount} comments</span>
            </div>

            <div className="flex items-center space-x-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.367 2.684 3 3 0 00-5.367-2.684z" />
              </svg>
              <span>{sharesCount} shares</span>
            </div>
          </div>

          {/* Reason Input */}
          {showReasonInput && (
            <div className="mb-6 p-4 bg-gray-700 rounded-lg">
              <h3 className="text-white font-medium mb-2">
                {pendingAction === 'reject' ? 'Reason for rejection' : 'Reason for deletion'}
              </h3>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={`Please provide a reason for ${pendingAction}ing this stream...`}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
              <div className="flex space-x-2 mt-3">
                <button
                  onClick={confirmAction}
                  disabled={!reason.trim()}
                  className={`px-4 py-2 rounded-md text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    pendingAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {pendingAction === 'reject' ? 'Reject Stream' : 'Delete Stream'}
                </button>
                <button
                  onClick={() => {
                    setShowReasonInput(false)
                    setPendingAction(null)
                    setReason('')
                  }}
                  className="px-4 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Actions */}
          {!showReasonInput && (
            <div className="flex justify-center space-x-3">
              {stream.status === 'pending' && (
                <>
                  <button
                    onClick={() => onAction('approve')}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors"
                  >
                    Approve Stream
                  </button>
                  <button
                    onClick={() => handleActionWithReason('reject')}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
                  >
                    Reject Stream
                  </button>
                </>
              )}
              
              {stream.status === 'approved' && (
                <button
                  onClick={() => handleActionWithReason('reject')}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
                >
                  Reject Stream
                </button>
              )}
              
              {stream.status === 'rejected' && (
                <button
                  onClick={() => onAction('approve')}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors"
                >
                  Approve Stream
                </button>
              )}

              <button
                onClick={() => handleActionWithReason('delete')}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium transition-colors"
              >
                Delete Stream
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StreamPreviewModal