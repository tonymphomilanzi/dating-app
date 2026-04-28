import { useState } from 'react'
import {
  XMarkIcon,
  CheckBadgeIcon,
  StarIcon,
  MapPinIcon,
  PhoneIcon,
  EnvelopeIcon,
  GlobeAltIcon,
  ClockIcon,
  PhotoIcon,
  ChatBubbleLeftRightIcon,
  CalendarIcon,
  BuildingOfficeIcon,
  CheckCircleIcon,
  XCircleIcon,
  TrashIcon,
  ShieldCheckIcon
} from '@heroicons/react/24/outline'

const ClinicPreviewModal = ({ clinic, onClose, onAction }) => {
  const [activeTab, setActiveTab] = useState('details')
  const [reason, setReason] = useState('')
  const [showReasonInput, setShowReasonInput] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)

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
      case 'pending': return 'bg-yellow-900/20 text-yellow-300 border-yellow-600'
      case 'approved': return 'bg-green-900/20 text-green-300 border-green-600'
      case 'rejected': return 'bg-red-900/20 text-red-300 border-red-600'
      default: return 'bg-gray-900/20 text-gray-300 border-gray-600'
    }
  }

  const getAverageRating = () => {
    if (!clinic.clinic_reviews || clinic.clinic_reviews.length === 0) return 0
    const sum = clinic.clinic_reviews.reduce((acc, review) => acc + review.rating, 0)
    return (sum / clinic.clinic_reviews.length).toFixed(1)
  }

  const formatOpeningHours = (hours) => {
    if (!hours) return null
    
    let hoursObj
    
    // Handle different data types
    if (typeof hours === 'string') {
      try {
        hoursObj = JSON.parse(hours)
      } catch {
        // If it's just a string and not JSON, display as is
        return hours
      }
    } else if (typeof hours === 'object' && hours !== null) {
      hoursObj = hours
    } else {
      return null
    }
    
    // Standard day order
    const daysOrder = [
      'monday', 'tuesday', 'wednesday', 'thursday', 
      'friday', 'saturday', 'sunday'
    ]
    
    const dayDisplayNames = {
      monday: 'Monday',
      tuesday: 'Tuesday', 
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday'
    }
    
    // Try to match keys in different formats
    const normalizedHours = {}
    Object.entries(hoursObj).forEach(([key, value]) => {
      const normalizedKey = key.toLowerCase().trim()
      normalizedHours[normalizedKey] = value
    })
    
    const formattedDays = daysOrder
      .map(day => {
        const time = normalizedHours[day] || normalizedHours[day.slice(0, 3)] // Try 'mon', 'tue' etc
        return time ? { 
          day: dayDisplayNames[day], 
          time: time === 'closed' || time === 'Closed' ? 'Closed' : time 
        } : null
      })
      .filter(Boolean)
    
    return formattedDays.length > 0 ? formattedDays : null
  }

  const averageRating = getAverageRating()
  const reviewCount = clinic.clinic_reviews?.length || 0
  const mediaCount = clinic.clinic_media?.length || 0
  const specialtyCount = clinic.clinic_specialties?.length || 0
  const formattedHours = formatOpeningHours(clinic.opening_hours)

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-start justify-center p-2 sm:p-4 z-50 overflow-y-auto">
        <div className="bg-gray-900 rounded-xl w-full max-w-7xl my-2 sm:my-4 shadow-2xl border border-gray-700 flex flex-col min-h-0 max-h-[calc(100vh-16px)] sm:max-h-[calc(100vh-32px)]">
          {/* Header - Fixed */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 sm:p-6 rounded-t-xl flex-shrink-0">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3 sm:space-x-4 flex-1 min-w-0">
                <div className="relative flex-shrink-0">
                  <img
                    className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl object-cover border-2 border-white shadow-lg"
                    src={clinic.cover_url || '/default-clinic.png'}
                    alt={clinic.name}
                    onError={(e) => {
                      e.target.src = '/default-clinic.png'
                    }}
                  />
                  {clinic.is_verified && (
                    <CheckBadgeIcon className="w-4 h-4 sm:w-6 sm:h-6 text-blue-400 absolute -top-1 -right-1 bg-white rounded-full" />
                  )}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 mb-2">
                    <h2 className="text-lg sm:text-2xl font-bold truncate">{clinic.name}</h2>
                    <span className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border self-start ${getStatusColor(clinic.status)}`}>
                      {clinic.status?.charAt(0).toUpperCase() + clinic.status?.slice(1)}
                    </span>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-6 text-blue-100 text-sm">
                    <div className="flex items-center space-x-2">
                      <StarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-300" />
                      <span className="font-medium">
                        {averageRating > 0 ? averageRating : 'No reviews'}
                      </span>
                      {reviewCount > 0 && (
                        <span className="text-blue-200">({reviewCount})</span>
                      )}
                    </div>
                    
                    {clinic.city && (
                      <div className="flex items-center space-x-2">
                        <MapPinIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span className="truncate">{clinic.city}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-4 text-xs sm:text-sm">
                      <div className="flex items-center space-x-1">
                        <PhotoIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{mediaCount}</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <BuildingOfficeIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span>{specialtyCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/10 rounded-lg flex-shrink-0"
              >
                <XMarkIcon className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {/* Tabs - Fixed */}
          <div className="border-b border-gray-700 bg-gray-800 flex-shrink-0">
            <nav className="flex px-4 sm:px-6">
              {[
                { key: 'details', label: 'Details', icon: BuildingOfficeIcon },
                { key: 'media', label: 'Media', icon: PhotoIcon, count: mediaCount },
                { key: 'reviews', label: 'Reviews', icon: ChatBubbleLeftRightIcon, count: reviewCount }
              ].map((tab) => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key)}
                    className={`flex items-center space-x-1 sm:space-x-2 py-3 sm:py-4 px-2 sm:px-4 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-400'
                        : 'border-transparent text-gray-400 hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className="bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded-full text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto bg-gray-900">
            <div className="p-4 sm:p-6">
              {activeTab === 'details' && (
                <div className="space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {/* Basic Information */}
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                        <BuildingOfficeIcon className="w-5 h-5 text-blue-400" />
                        <span>Basic Information</span>
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-400">Description</label>
                          <p className="text-gray-200 mt-1 leading-relaxed text-sm sm:text-base">
                            {clinic.description || 'No description provided'}
                          </p>
                        </div>
                        
                        <div className="space-y-3">
                          {clinic.phone && (
                            <div className="flex items-start space-x-3">
                              <PhoneIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <label className="text-sm font-medium text-gray-400">Phone</label>
                                <p className="text-gray-200 text-sm sm:text-base break-all">{clinic.phone}</p>
                              </div>
                            </div>
                          )}
                          
                          {clinic.email && (
                            <div className="flex items-start space-x-3">
                              <EnvelopeIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <label className="text-sm font-medium text-gray-400">Email</label>
                                <p className="text-gray-200 text-sm sm:text-base break-all">{clinic.email}</p>
                              </div>
                            </div>
                          )}
                          
                          {clinic.website && (
                            <div className="flex items-start space-x-3">
                              <GlobeAltIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 mt-0.5" />
                              <div className="min-w-0 flex-1">
                                <label className="text-sm font-medium text-gray-400">Website</label>
                                <a 
                                  href={clinic.website} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-blue-400 hover:text-blue-300 hover:underline text-sm sm:text-base break-all"
                                >
                                  {clinic.website}
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Location */}
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                        <MapPinIcon className="w-5 h-5 text-green-400" />
                        <span>Location</span>
                      </h3>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="text-sm font-medium text-gray-400">Address</label>
                          <p className="text-gray-200 mt-1 text-sm sm:text-base">{clinic.address || 'Not provided'}</p>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 sm:gap-4">
                          <div>
                            <label className="text-sm font-medium text-gray-400">City</label>
                            <p className="text-gray-200 mt-1 text-sm sm:text-base">{clinic.city || 'Not provided'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">State</label>
                            <p className="text-gray-200 mt-1 text-sm sm:text-base">{clinic.state || 'Not provided'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Country</label>
                            <p className="text-gray-200 mt-1 text-sm sm:text-base">{clinic.country || 'Not provided'}</p>
                          </div>
                          <div>
                            <label className="text-sm font-medium text-gray-400">Postal Code</label>
                            <p className="text-gray-200 mt-1 text-sm sm:text-base">{clinic.postal_code || 'Not provided'}</p>
                          </div>
                        </div>
                        
                        {clinic.lat && clinic.lng && (
                          <div>
                            <label className="text-sm font-medium text-gray-400">Coordinates</label>
                            <p className="text-gray-200 mt-1 font-mono text-xs sm:text-sm break-all">
                              {clinic.lat}, {clinic.lng}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Opening Hours */}
                  {formattedHours && (
                    <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-700">
                      <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                        <ClockIcon className="w-5 h-5 text-purple-400" />
                        <span>Opening Hours</span>
                      </h3>
                      
                      {Array.isArray(formattedHours) ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                          {formattedHours.map(({ day, time }) => (
                            <div key={day} className="flex justify-between items-center py-2 sm:py-3 px-3 sm:px-4 bg-gray-700 rounded-lg border border-gray-600">
                              <span className="font-medium text-gray-300 text-sm sm:text-base">{day}</span>
                              <span className={`font-medium text-sm sm:text-base ${time === 'Closed' ? 'text-red-400' : 'text-green-400'}`}>
                                {time}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-200 bg-gray-700 p-3 sm:p-4 rounded-lg border border-gray-600 text-sm sm:text-base">{formattedHours}</p>
                      )}
                    </div>
                  )}

                  {/* Specialties */}
                  <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4">
                      Specialties ({specialtyCount})
                    </h3>
                    
                    {clinic.clinic_specialties && clinic.clinic_specialties.length > 0 ? (
                      <div className="flex flex-wrap gap-2 sm:gap-3">
                        {clinic.clinic_specialties.map((specialty) => (
                          <span
                            key={specialty.id}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-900/20 text-blue-300 rounded-full text-xs sm:text-sm font-medium border border-blue-600"
                          >
                            {specialty.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm sm:text-base">No specialties listed</p>
                    )}
                  </div>

                  {/* Metadata */}
                  <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                      <CalendarIcon className="w-5 h-5 text-gray-400" />
                      <span>Metadata</span>
                    </h3>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                      <div>
                        <label className="text-sm font-medium text-gray-400">Created</label>
                        <p className="text-gray-200 mt-1 text-sm">
                          {new Date(clinic.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Updated</label>
                        <p className="text-gray-200 mt-1 text-sm">
                          {new Date(clinic.updated_at).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-400">Status</label>
                        <p className="text-gray-200 mt-1 capitalize text-sm">{clinic.status}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'media' && (
                <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-700">
                  <h3 className="text-lg font-semibold text-white mb-4 sm:mb-6">
                    Media Gallery ({mediaCount})
                  </h3>
                  
                  {clinic.clinic_media && clinic.clinic_media.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
                      {clinic.clinic_media.map((media) => (
                        <div 
                          key={media.id} 
                          className="bg-gray-700 rounded-lg overflow-hidden shadow-sm border border-gray-600 hover:shadow-md transition-shadow cursor-pointer group"
                          onClick={() => setSelectedImage(media)}
                        >
                          <img
                            src={media.url}
                            alt={media.caption || 'Clinic media'}
                            className="w-full h-32 sm:h-40 object-cover group-hover:scale-105 transition-transform duration-200"
                            onError={(e) => {
                              e.target.src = '/default-clinic.png'
                            }}
                          />
                          {media.caption && (
                            <div className="p-2 sm:p-3">
                              <p className="text-gray-300 text-xs sm:text-sm line-clamp-2">{media.caption}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12">
                      <PhotoIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-400 text-base sm:text-lg">No media uploaded</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="bg-gray-800 rounded-lg p-4 sm:p-6 shadow-sm border border-gray-700">
                  <h3 className="text-lg font-semibold text-white mb-4 sm:mb-6">
                    Customer Reviews ({reviewCount})
                  </h3>
                  
                  {clinic.clinic_reviews && clinic.clinic_reviews.length > 0 ? (
                    <div className="space-y-4 sm:space-y-6">
                      {clinic.clinic_reviews.map((review) => (
                        <div key={review.id} className="border-b border-gray-700 pb-4 sm:pb-6 last:border-b-0">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0 mb-3">
                            <div className="flex items-center space-x-2">
                              {[...Array(5)].map((_, i) => (
                                <StarIcon
                                  key={i}
                                  className={`w-4 h-4 sm:w-5 sm:h-5 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-600'}`}
                                />
                              ))}
                              <span className="font-semibold text-white ml-2 text-sm sm:text-base">{review.rating}/5</span>
                            </div>
                            <span className="text-gray-400 text-xs sm:text-sm">
                              {new Date(review.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          {review.body && (
                            <p className="text-gray-300 leading-relaxed text-sm sm:text-base">{review.body}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 sm:py-12">
                      <ChatBubbleLeftRightIcon className="w-12 h-12 sm:w-16 sm:h-16 text-gray-500 mx-auto mb-4" />
                      <p className="text-gray-400 text-base sm:text-lg">No reviews yet</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer with Actions - Fixed */}
          <div className="bg-gray-800 border-t border-gray-700 p-4 sm:p-6 rounded-b-xl flex-shrink-0">
            {showReasonInput ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-300 text-sm font-medium mb-2">
                    {pendingAction === 'reject' ? 'Reason for rejection' : 'Reason for deletion'}
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={`Please provide a reason for ${pendingAction}ing this clinic...`}
                    className="w-full px-3 sm:px-4 py-2 sm:py-3 border border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none text-sm sm:text-base"
                    rows={3}
                  />
                </div>
                <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4">
                  <button
                    onClick={() => {
                      setShowReasonInput(false)
                      setPendingAction(null)
                      setReason('')
                    }}
                    className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors font-medium text-sm sm:text-base"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAction}
                    disabled={!reason.trim()}
                    className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2 text-sm sm:text-base"
                  >
                    {pendingAction === 'delete' ? <TrashIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
                    <span>{pendingAction === 'reject' ? 'Reject Clinic' : 'Delete Clinic'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:flex lg:justify-center gap-3 lg:gap-4">
                {clinic.status === 'pending' && (
                  <>
                    <button
                      onClick={() => onAction('approve')}
                      className="px-4 sm:px-6 py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 shadow-sm text-sm sm:text-base lg:min-w-[140px]"
                    >
                      <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Approve</span>
                    </button>
                    <button
                      onClick={() => handleActionWithReason('reject')}
                      className="px-4 sm:px-6 py-2.5 sm:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 shadow-sm text-sm sm:text-base lg:min-w-[140px]"
                    >
                      <XCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                      <span>Reject</span>
                    </button>
                  </>
                )}
                
                {clinic.status === 'approved' && (
                  <button
                    onClick={() => handleActionWithReason('reject')}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 shadow-sm text-sm sm:text-base lg:min-w-[140px]"
                  >
                    <XCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Reject</span>
                  </button>
                )}
                
                {clinic.status === 'rejected' && (
                  <button
                    onClick={() => onAction('approve')}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 shadow-sm text-sm sm:text-base lg:min-w-[140px]"
                  >
                    <CheckCircleIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span>Approve</span>
                  </button>
                )}

                <button
                  onClick={() => onAction('verify')}
                  className={`px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 shadow-sm text-sm sm:text-base lg:min-w-[140px] ${
                    clinic.is_verified 
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <ShieldCheckIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>{clinic.is_verified ? 'Unverify' : 'Verify'}</span>
                </button>

                <button
                  onClick={() => handleActionWithReason('delete')}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center space-x-2 shadow-sm text-sm sm:text-base lg:min-w-[140px]"
                >
                  <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-[60]">
          <div className="max-w-4xl max-h-full w-full">
            <div className="relative">
              <button
                onClick={() => setSelectedImage(null)}
                className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors z-10 bg-black/50 rounded-full p-2"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
              <img
                src={selectedImage.url}
                alt={selectedImage.caption || 'Clinic media'}
                className="max-w-full max-h-full object-contain rounded-lg"
                onError={(e) => {
                  e.target.src = '/default-clinic.png'
                }}
              />
              {selectedImage.caption && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/75 text-white p-4 rounded-b-lg">
                  <p className="text-center">{selectedImage.caption}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default ClinicPreviewModal