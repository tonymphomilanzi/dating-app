import { useState } from 'react'

const ClinicPreviewModal = ({ clinic, onClose, onAction }) => {
  const [activeTab, setActiveTab] = useState('details')
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-900 text-yellow-300'
      case 'approved': return 'bg-green-900 text-green-300'
      case 'rejected': return 'bg-red-900 text-red-300'
      default: return 'bg-gray-900 text-gray-300'
    }
  }

  const getAverageRating = () => {
    if (!clinic.clinic_reviews || clinic.clinic_reviews.length === 0) return 0
    const sum = clinic.clinic_reviews.reduce((acc, review) => acc + review.rating, 0)
    return (sum / clinic.clinic_reviews.length).toFixed(1)
  }

  const formatOpeningHours = (hours) => {
    if (!hours) return 'Not specified'
    try {
      const parsed = JSON.parse(hours)
      return Object.entries(parsed).map(([day, time]) => `${day}: ${time}`).join('\n')
    } catch {
      return hours
    }
  }

  const averageRating = getAverageRating()
  const reviewCount = clinic.clinic_reviews?.length || 0
  const mediaCount = clinic.clinic_media?.length || 0
  const specialtyCount = clinic.clinic_specialties?.length || 0

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <img
              className="w-12 h-12 rounded-lg object-cover"
              src={clinic.cover_url || '/default-clinic.png'}
              alt={clinic.name}
            />
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-bold text-white">{clinic.name}</h2>
                {clinic.is_verified && (
                  <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(clinic.status)}`}>
                  {clinic.status}
                </span>
              </div>
              <div className="flex items-center space-x-4 mt-1">
                <div className="flex items-center space-x-1">
                  <span className="text-yellow-400">★</span>
                  <span className="text-gray-300">{averageRating > 0 ? averageRating : 'No reviews'}</span>
                  {reviewCount > 0 && (
                    <span className="text-gray-400">({reviewCount})</span>
                  )}
                </div>
                <span className="text-gray-400">•</span>
                <span className="text-gray-400">{clinic.city || 'No location'}</span>
              </div>
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

        {/* Tabs */}
        <div className="border-b border-gray-700">
          <nav className="flex space-x-8 px-6">
            {['details', 'media', 'reviews'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab}
                {tab === 'media' && mediaCount > 0 && (
                  <span className="ml-1 text-xs">({mediaCount})</span>
                )}
                {tab === 'reviews' && reviewCount > 0 && (
                  <span className="ml-1 text-xs">({reviewCount})</span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Basic Information</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-gray-400 text-sm">Name</label>
                        <p className="text-white">{clinic.name}</p>
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm">Description</label>
                        <p className="text-white">{clinic.description || 'No description provided'}</p>
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm">Phone</label>
                        <p className="text-white">{clinic.phone || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm">Email</label>
                        <p className="text-white">{clinic.email || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm">Website</label>
                        <p className="text-white">
                          {clinic.website ? (
                            <a href={clinic.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                              {clinic.website}
                            </a>
                          ) : (
                            'Not provided'
                          )}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Specialties ({specialtyCount})</h3>
                    {clinic.clinic_specialties && clinic.clinic_specialties.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {clinic.clinic_specialties.map((specialty) => (
                          <span
                            key={specialty.id}
                            className="px-3 py-1 bg-blue-900 text-blue-300 rounded-full text-sm"
                          >
                            {specialty.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400">No specialties listed</p>
                    )}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Location</h3>
                    <div className="space-y-3">
                      <div>
                        <label className="text-gray-400 text-sm">Address</label>
                        <p className="text-white">{clinic.address || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm">City</label>
                        <p className="text-white">{clinic.city || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm">State</label>
                        <p className="text-white">{clinic.state || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm">Country</label>
                        <p className="text-white">{clinic.country || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm">Postal Code</label>
                        <p className="text-white">{clinic.postal_code || 'Not provided'}</p>
                      </div>
                      <div>
                        <label className="text-gray-400 text-sm">Coordinates</label>
                        <p className="text-white">
                          {clinic.lat && clinic.lng 
                            ? `${clinic.lat}, ${clinic.lng}`
                            : 'Not provided'
                          }
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Opening Hours</h3>
                    <pre className="text-white text-sm whitespace-pre-wrap">
                      {formatOpeningHours(clinic.opening_hours)}
                    </pre>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-3">Metadata</h3>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <label className="text-gray-400">Created</label>
                    <p className="text-white">{new Date(clinic.created_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">Updated</label>
                    <p className="text-white">{new Date(clinic.updated_at).toLocaleString()}</p>
                  </div>
                  <div>
                    <label className="text-gray-400">Status</label>
                    <p className="text-white capitalize">{clinic.status}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'media' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Media ({mediaCount})</h3>
              {clinic.clinic_media && clinic.clinic_media.length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {clinic.clinic_media.map((media) => (
                    <div key={media.id} className="bg-gray-700 rounded-lg overflow-hidden">
                      <img
                        src={media.url}
                        alt={media.caption || 'Clinic media'}
                        className="w-full h-32 object-cover"
                        onError={(e) => {
                          e.target.src = '/default-clinic.png'
                        }}
                      />
                      {media.caption && (
                        <div className="p-2">
                          <p className="text-gray-300 text-sm truncate">{media.caption}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No media uploaded</p>
              )}
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">Reviews ({reviewCount})</h3>
              {clinic.clinic_reviews && clinic.clinic_reviews.length > 0 ? (
                <div className="space-y-4">
                  {clinic.clinic_reviews.map((review) => (
                    <div key={review.id} className="bg-gray-700 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-1">
                          {[...Array(5)].map((_, i) => (
                            <svg
                              key={i}
                              className={`w-4 h-4 ${i < review.rating ? 'text-yellow-400' : 'text-gray-600'}`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                          <span className="text-white ml-2">{review.rating}/5</span>
                        </div>
                        <span className="text-gray-400 text-sm">
                          {new Date(review.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      {review.body && (
                        <p className="text-gray-300">{review.body}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-400">No reviews yet</p>
              )}
            </div>
          )}
        </div>

        {/* Footer with Actions */}
        <div className="border-t border-gray-700 px-6 py-4">
          {showReasonInput ? (
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">
                  {pendingAction === 'reject' ? 'Reason for rejection' : 'Reason for deletion'}
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={`Please provide a reason for ${pendingAction}ing this clinic...`}
                  className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                />
              </div>
              <div className="flex justify-end space-x-3">
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
                <button
                  onClick={confirmAction}
                  disabled={!reason.trim()}
                  className={`px-4 py-2 rounded-md text-white font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    pendingAction === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {pendingAction === 'reject' ? 'Reject Clinic' : 'Delete Clinic'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex justify-center space-x-3">
              {clinic.status === 'pending' && (
                <>
                  <button
                    onClick={() => onAction('approve')}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors"
                  >
                    Approve Clinic
                  </button>
                  <button
                    onClick={() => handleActionWithReason('reject')}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
                  >
                    Reject Clinic
                  </button>
                </>
              )}
              
              {clinic.status === 'approved' && (
                <button
                  onClick={() => handleActionWithReason('reject')}
                  className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md font-medium transition-colors"
                >
                  Reject Clinic
                </button>
              )}
              
              {clinic.status === 'rejected' && (
                <button
                  onClick={() => onAction('approve')}
                  className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors"
                >
                  Approve Clinic
                </button>
              )}

              <button
                onClick={() => onAction('verify')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  clinic.is_verified 
                    ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    : 'bg-blue-600 hover:bg-blue-700 text-white'
                }`}
              >
                {clinic.is_verified ? 'Unverify' : 'Verify'} Clinic
              </button>

              <button
                onClick={() => handleActionWithReason('delete')}
                className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md font-medium transition-colors"
              >
                Delete Clinic
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default ClinicPreviewModal