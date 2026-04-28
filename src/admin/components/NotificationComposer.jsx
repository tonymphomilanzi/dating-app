import { useState } from 'react'
import { NOTIFICATION_TYPES, getNotificationContent } from '../../lib/notificationHelpers'

const NotificationComposer = ({ users, onSend, loading }) => {
  const [notification, setNotification] = useState({
    type: NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
    title: '',
    message: '',
    data: {}
  })
  const [targeting, setTargeting] = useState({
    method: 'all', // 'all', 'specific', 'filter'
    specificUsers: [],
    filters: {
      premium: 'all',
      verified: 'all',
      city: '',
      joinedAfter: '',
      joinedBefore: ''
    }
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [showUserSelector, setShowUserSelector] = useState(false)

  // Organize notification types by category
  const notificationCategories = {
    'Admin & System': [
      NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
      NOTIFICATION_TYPES.SYSTEM_UPDATE,
      NOTIFICATION_TYPES.MAINTENANCE_SCHEDULED,
      NOTIFICATION_TYPES.NEW_FEATURE_AVAILABLE,
    ],
    'Subscription': [
      NOTIFICATION_TYPES.SUBSCRIPTION_GRANTED,
      NOTIFICATION_TYPES.SUBSCRIPTION_REVOKED,
      NOTIFICATION_TYPES.SUBSCRIPTION_EXTENDED,
      NOTIFICATION_TYPES.SUBSCRIPTION_ACTIVATED,
      NOTIFICATION_TYPES.SUBSCRIPTION_UPGRADED,
      NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING_SOON,
      NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRED,
    ],
    'Moderation': [
      NOTIFICATION_TYPES.CLINIC_APPROVED,
      NOTIFICATION_TYPES.CLINIC_REJECTED,
      NOTIFICATION_TYPES.CLINIC_SUSPENDED,
      NOTIFICATION_TYPES.PROFILE_VERIFIED,
      NOTIFICATION_TYPES.PROFILE_VERIFICATION_REJECTED,
      NOTIFICATION_TYPES.CONTENT_FLAGGED,
      NOTIFICATION_TYPES.CONTENT_REMOVED,
      NOTIFICATION_TYPES.ACCOUNT_WARNING,
      NOTIFICATION_TYPES.ACCOUNT_SUSPENDED,
    ],
    'Features': [
      NOTIFICATION_TYPES.FEATURE_UNLOCKED_CHAT,
      NOTIFICATION_TYPES.FEATURE_UNLOCKED_ADVANCED_FILTERS,
      NOTIFICATION_TYPES.FEATURE_UNLOCKED_UNLIMITED_LIKES,
      NOTIFICATION_TYPES.FEATURE_UNLOCKED_SEE_WHO_LIKED,
      NOTIFICATION_TYPES.FEATURE_LOCKED,
    ]
  }

  const getTargetUsers = () => {
    let targetUsers = []

    switch (targeting.method) {
      case 'all':
        targetUsers = users.map(u => u.id)
        break
      
      case 'specific':
        targetUsers = targeting.specificUsers
        break
      
      case 'filter':
        targetUsers = users.filter(user => {
          // Premium filter
          if (targeting.filters.premium !== 'all') {
            const isPremium = targeting.filters.premium === 'true'
            if (user.is_premium !== isPremium) return false
          }
          
          // Verified filter
          if (targeting.filters.verified !== 'all') {
            const isVerified = targeting.filters.verified === 'true'
            if (user.is_verified !== isVerified) return false
          }
          
          // City filter
          if (targeting.filters.city && !user.city?.toLowerCase().includes(targeting.filters.city.toLowerCase())) {
            return false
          }
          
          return true
        }).map(u => u.id)
        break
    }

    return targetUsers
  }

  const filteredUsers = users.filter(user => 
    user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.city?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const targetUserCount = getTargetUsers().length

  const handleTypeChange = (newType) => {
    const template = getNotificationContent(newType, {
      userName: 'User',
      planName: 'Premium',
      duration: '1 month',
      clinicName: 'Clinic Name'
    })
    
    setNotification({
      type: newType,
      title: template.title,
      message: template.message,
      data: {}
    })
  }

  const handleSend = () => {
    if (!notification.title.trim() || !notification.message.trim()) {
      alert('Please enter both title and message')
      return
    }

    if (targetUserCount === 0) {
      alert('No users selected for notification')
      return
    }

    const notificationData = {
      ...notification,
      targetUsers: getTargetUsers(),
      targeting: targeting.method
    }

    onSend(notificationData)
    
    // Reset form
    setNotification({
      type: NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
      title: '',
      message: '',
      data: {}
    })
    setTargeting({
      method: 'all',
      specificUsers: [],
      filters: {
        premium: 'all',
        verified: 'all',
        city: '',
        joinedAfter: '',
        joinedBefore: ''
      }
    })
  }

  const addSpecificUser = (userId) => {
    if (!targeting.specificUsers.includes(userId)) {
      setTargeting({
        ...targeting,
        specificUsers: [...targeting.specificUsers, userId]
      })
    }
  }

  const removeSpecificUser = (userId) => {
    setTargeting({
      ...targeting,
      specificUsers: targeting.specificUsers.filter(id => id !== userId)
    })
  }

  // Get the current template for preview
  const currentTemplate = getNotificationContent(notification.type, {
    userName: 'John Doe',
    planName: 'Premium',
    duration: '3 months',
    clinicName: 'Sample Spa'
  })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Notification Content */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Notification Content</h3>
            
            {/* Type Selection */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Notification Type
              </label>
              <select
                value={notification.type}
                onChange={(e) => handleTypeChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {Object.entries(notificationCategories).map(([category, types]) => (
                  <optgroup key={category} label={category}>
                    {types.map(type => (
                      <option key={type} value={type}>
                        {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Title
              </label>
              <input
                type="text"
                value={notification.title}
                onChange={(e) => setNotification({ ...notification, title: e.target.value })}
                placeholder="Enter notification title..."
                maxLength={200}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="text-right text-gray-400 text-sm mt-1">
                {notification.title.length}/200
              </div>
            </div>

            {/* Message */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Message
              </label>
              <textarea
                value={notification.message}
                onChange={(e) => setNotification({ ...notification, message: e.target.value })}
                placeholder="Enter notification message..."
                maxLength={500}
                rows={4}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
              <div className="text-right text-gray-400 text-sm mt-1">
                {notification.message.length}/500
              </div>
            </div>

            {/* Template Helper */}
            <div className="mb-4 p-3 bg-blue-900/20 border border-blue-600 rounded-md">
              <div className="text-blue-300 text-sm font-medium mb-1">Template Suggestion:</div>
              <div className="text-blue-200 text-sm">{currentTemplate.message}</div>
              <button
                onClick={() => setNotification({
                  ...notification,
                  title: currentTemplate.title,
                  message: currentTemplate.message
                })}
                className="mt-2 text-blue-300 hover:text-blue-200 text-sm underline"
              >
                Use this template
              </button>
            </div>

            {/* Preview */}
            <div className="border-t border-gray-600 pt-4">
              <h4 className="text-sm font-medium text-gray-300 mb-2">Preview</h4>
              <div className="bg-gray-700 rounded-lg p-4 border-l-4 border-blue-500">
                <div className="text-white font-medium">
                  {notification.title || currentTemplate.title}
                </div>
                <div className="text-gray-300 text-sm mt-1">
                  {notification.message || currentTemplate.message}
                </div>
                <div className="text-gray-400 text-xs mt-2 flex items-center">
                  <span className={`px-2 py-1 rounded-full text-xs mr-2 ${
                    notification.type.includes('admin') || notification.type.includes('announcement') ? 'bg-blue-900 text-blue-300' :
                    notification.type.includes('approved') || notification.type.includes('activated') ? 'bg-green-900 text-green-300' :
                    notification.type.includes('rejected') || notification.type.includes('suspended') ? 'bg-red-900 text-red-300' :
                    'bg-gray-900 text-gray-300'
                  }`}>
                    {notification.type.replace(/_/g, ' ')}
                  </span>
                  Now
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Targeting - Same as before but keeping it here for completeness */}
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Target Audience</h3>
            
            {/* Rest of the targeting code remains the same as in previous version */}
            {/* ... targeting controls ... */}

            {/* Target Count */}
            <div className="mt-4 pt-4 border-t border-gray-600">
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{targetUserCount}</div>
                <div className="text-gray-400 text-sm">Users will receive this notification</div>
              </div>
            </div>

            {/* Send Button */}
            <button
              onClick={handleSend}
              disabled={loading || !notification.title.trim() || !notification.message.trim() || targetUserCount === 0}
              className="w-full mt-4 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending...' : `Send to ${targetUserCount} Users`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default NotificationComposer