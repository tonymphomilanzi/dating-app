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
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'approved': return 'bg-green-100 text-green-800 border-green-200'
      case 'rejected': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
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
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-xl max-w-7xl w-full max-h-[95vh] overflow-hidden shadow-2xl">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="relative">
                  <img
                    className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-lg"
                    src={clinic.cover_url || '/default-clinic.png'}
                    alt={clinic.name}
                    onError={(e) => {
                      e.target.src = '/default-clinic.png'
                    }}
                  />
                  {clinic.is_verified && (
                    <CheckBadgeIcon className="w-6 h-6 text-blue-400 absolute -top-1 -right-1 bg-white rounded-full" />
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h2 className="text-2xl font-bold">{clinic.name}</h2>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(clinic.status)}`}>
                      {clinic.status?.charAt(0).toUpperCase() + clinic.status?.slice(1)}
                    </span>
                  </div>
                  
                  <div className="flex items-center space-x-6 text-blue-100">
                    <div className="flex items-center space-x-2">
                      <StarIcon className="w-5 h-5 text-yellow-300" />
                      <span className="font-medium">
                        {averageRating > 0 ? averageRating : 'No reviews'}
                      </span>
                      {reviewCount > 0 && (
                        <span className="text-blue-200">({reviewCount} reviews)</span>
                      )}
                    </div>
                    
                    {clinic.city && (
                      <div className="flex items-center space-x-2">
                        <MapPinIcon className="w-5 h-5" />
                        <span>{clinic.city}</span>
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-4 text-sm">
                      <div className="flex items-center space-x-1">
                        <PhotoIcon className="w-4 h-4" />
                        <span>{mediaCount} photos</span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <BuildingOfficeIcon className="w-4 h-4" />
                        <span>{specialtyCount} specialties</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors p-2 hover:bg-white/10 rounded-lg"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 bg-gray-50">
            <nav className="flex space-x-8 px-6">
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
                    className={`flex items-center space-x-2 py-4 px-2 border-b-2 font-medium text-sm transition-colors ${
                      activeTab === tab.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {tab.count > 0 && (
                      <span className="bg-gray-200 text-gray-700 px-2 py-1 rounded-full text-xs">
                        {tab.count}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="p-6 max-h-[60vh] overflow-y-auto bg-gray-50">
            {activeTab === 'details' && (
              <div className="space-y-8">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Basic Information */}
                  <div className="bg-white rounded-lg p-6 shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                      <BuildingOfficeIcon className="w-5 h-5 text-blue-600" />
                      <span>Basic Information</span>
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Description</label>
                        <p className="text-gray-900 mt-1 leading-relaxed">
                          {clinic.description || 'No description provided'}
                        </p>
                      </div>
                      
                      <div className="grid grid-cols-1 gap-4">
                        {clinic.phone && (
                          <div className="flex items-center space-x-3">
                            <PhoneIcon className="w-5 h-5 text-gray-400" />
                            <div>
                              <label className="text-sm font-medium text-gray-500">Phone</label>
                              <p className="text-gray-900">{clinic.phone}</p>
                            </div>
                          </div>
                        )}
                        
                        {clinic.email && (
                          <div className="flex items-center space-x-3">
                            <EnvelopeIcon className="w-5 h-5 text-gray-400" />
                            <div>
                              <label className="text-sm font-medium text-gray-500">Email</label>
                              <p className="text-gray-900">{clinic.email}</p>
                            </div>
                          </div>
                        )}
                        
                        {clinic.website && (
                          <div className="flex items-center space-x-3">
                            <GlobeAltIcon className="w-5 h-5 text-gray-400" />
                            <div>
                              <label className="text-sm font-medium text-gray-500">Website</label>
                              <a 
                                href={clinic.website} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-blue-600 hover:text-blue-800 hover:underline"
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
                  <div className="bg-white rounded-lg p-6 shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                      <MapPinIcon className="w-5 h-5 text-green-600" />
                      <span>Location</span>
                    </h3>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Address</label>
                        <p className="text-gray-900 mt-1">{clinic.address || 'Not provided'}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium text-gray-500">City</label>
                          <p className="text-gray-900 mt-1">{clinic.city || 'Not provided'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">State</label>
                          <p className="text-gray-900 mt-1">{clinic.state || 'Not provided'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Country</label>
                          <p className="text-gray-900 mt-1">{clinic.country || 'Not provided'}</p>
                        </div>
                        <div>
                          <label className="text-sm font-medium text-gray-500">Postal Code</label>
                          <p className="text-gray-900 mt-1">{clinic.postal_code || 'Not provided'}</p>
                        </div>
                      </div>
                      
                      {clinic.lat && clinic.lng && (
                        <div>
                          <label className="text-sm font-medium text-gray-500">Coordinates</label>
                          <p className="text-gray-900 mt-1 font-mono text-sm">
                            {clinic.lat}, {clinic.lng}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Opening Hours */}
                {formattedHours && (
                  <div className="bg-white rounded-lg p-6 shadow-sm border">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                      <ClockIcon className="w-5 h-5 text-purple-600" />
                      <span>Opening Hours</span>
                    </h3>
                    
                    {Array.isArray(formattedHours) ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {formattedHours.map(({ day, time }) => (
                          <div key={day} className="flex justify-between items-center py-2 px-3 bg-gray-50 rounded-lg">
                            <span className="font-medium text-gray-700">{day}</span>
                            <span className={`font-medium ${time === 'Closed' ? 'text-red-600' : 'text-green-600'}`}>
                              {time}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-900 bg-gray-50 p-3 rounded-lg">{formattedHours}</p>
                    )}
                  </div>
                )}

                {/* Specialties */}
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Specialties ({specialtyCount})
                  </h3>
                  
                  {clinic.clinic_specialties && clinic.clinic_specialties.length > 0 ? (
                    <div className="flex flex-wrap gap-3">
                      {clinic.clinic_specialties.map((specialty) => (
                        <span
                          key={specialty.id}
                          className="px-4 py-2 bg-blue-100 text-blue-800 rounded-full text-sm font-medium border border-blue-200"
                        >
                          {specialty.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">No specialties listed</p>
                  )}
                </div>

                {/* Metadata */}
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center space-x-2">
                    <CalendarIcon className="w-5 h-5 text-gray-600" />
                    <span>Metadata</span>
                  </h3>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-500">Created</label>
                      <p className="text-gray-900 mt-1">
                        {new Date(clinic.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Updated</label>
                      <p className="text-gray-900 mt-1">
                        {new Date(clinic.updated_at).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-500">Status</label>
                      <p className="text-gray-900 mt-1 capitalize">{clinic.status}</p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'media' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Media Gallery ({mediaCount})
                  </h3>
                  
                  {clinic.clinic_media && clinic.clinic_media.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {clinic.clinic_media.map((media) => (
                        <div 
                          key={media.id} 
                          className="bg-white rounded-lg overflow-hidden shadow-sm border hover:shadow-md transition-shadow cursor-pointer"
                          onClick={() => setSelectedImage(media)}
                        >
                          <img
                            src={media.url}
                            alt={media.caption || 'Clinic media'}
                            className="w-full h-40 object-cover"
                            onError={(e) => {
                              e.target.src = '/default-clinic.png'
                            }}
                          />
                          {media.caption && (
                            <div className="p-3">
                              <p className="text-gray-700 text-sm line-clamp-2">{media.caption}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <PhotoIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 text-lg">No media uploaded</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'reviews' && (
              <div className="space-y-6">
                <div className="bg-white rounded-lg p-6 shadow-sm border">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Customer Reviews ({reviewCount})
                  </h3>
                  
                  {clinic.clinic_reviews && clinic.clinic_reviews.length > 0 ? (
                    <div className="space-y-6">
                      {clinic.clinic_reviews.map((review) => (
                        <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-2">
                              {[...Array(5)].map((_, i) => (
                                <StarIcon
                                  key={i}
                                  className={`w-5 h-5 ${i < review.rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                                />
                              ))}
                              <span className="font-semibold text-gray-900 ml-2">{review.rating}/5</span>
                            </div>
                            <span className="text-gray-500 text-sm">
                              {new Date(review.created_at).toLocaleDateString('en-US', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </span>
                          </div>
                          {review.body && (
                            <p className="text-gray-700 leading-relaxed">{review.body}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <ChatBubbleLeftRightIcon className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                      <p className="text-gray-500 text-lg">No reviews yet</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer with Actions */}
          <div className="bg-white border-t border-gray-200 px-6 py-4">
            {showReasonInput ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 text-sm font-medium mb-2">
                    {pendingAction === 'reject' ? 'Reason for rejection' : 'Reason for deletion'}
                  </label>
                  <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={`Please provide a reason for ${pendingAction}ing this clinic...`}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
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
                    className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmAction}
                    disabled={!reason.trim()}
                    className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {pendingAction === 'delete' ? <TrashIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
                    <span>{pendingAction === 'reject' ? 'Reject Clinic' : 'Delete Clinic'}</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex justify-center space-x-3">
                {clinic.status === 'pending' && (
                  <>
                    <button
                      onClick={() => onAction('approve')}
                      className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-sm"
                    >
                      <CheckCircleIcon className="w-5 h-5" />
                      <span>Approve Clinic</span>
                    </button>
                    <button
                      onClick={() => handleActionWithReason('reject')}
                      className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-sm"
                    >
                      <XCircleIcon className="w-5 h-5" />
                      <span>Reject Clinic</span>
                    </button>
                  </>
                )}
                
                {clinic.status === 'approved' && (
                  <button
                    onClick={() => handleActionWithReason('reject')}
                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-sm"
                  >
                    <XCircleIcon className="w-5 h-5" />
                    <span>Reject Clinic</span>
                  </button>
                )}
                
                {clinic.status === 'rejected' && (
                  <button
                    onClick={() => onAction('approve')}
                    className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-sm"
                  >
                    <CheckCircleIcon className="w-5 h-5" />
                    <span>Approve Clinic</span>
                  </button>
                )}

                <button
                  onClick={() => onAction('verify')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-sm ${
                    clinic.is_verified 
                      ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <ShieldCheckIcon className="w-5 h-5" />
                  <span>{clinic.is_verified ? 'Unverify' : 'Verify'} Clinic</span>
                </button>

                <button
                  onClick={() => handleActionWithReason('delete')}
                  className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors flex items-center space-x-2 shadow-sm"
                >
                  <TrashIcon className="w-5 h-5" />
                  <span>Delete Clinic</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Image Modal */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center p-4 z-[60]">
          <div className="max-w-4xl max-h-full">
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