import { useState } from 'react'
import { useAlert } from './CustomAlert/AlertProvider'
import { NOTIFICATION_TYPES, getNotificationContent, getIconComponent } from '../../lib/notificationHelpers'
import { 
  MagnifyingGlassIcon,
  EyeIcon,
  EyeSlashIcon,
  XMarkIcon,
  PlusIcon
} from '@heroicons/react/24/outline'

const NotificationComposer = ({ users, onSend, loading, template, onTemplateUsed }) => {
  const { showAlert } = useAlert()
  const [notification, setNotification] = useState({
    type: NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
    title: '',
    message: '',
    data: {}
  })
  const [targeting, setTargeting] = useState({
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
  const [searchTerm, setSearchTerm] = useState('')
  const [showUserSelector, setShowUserSelector] = useState(false)

  // Load template data
  useState(() => {
    if (template) {
      setNotification(prev => ({ ...prev, ...template }))
      if (onTemplateUsed) onTemplateUsed()
    }
  }, [template, onTemplateUsed])

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
          
          // Date filters
          if (targeting.filters.joinedAfter) {
            const joinedDate = new Date(user.created_at)
            const afterDate = new Date(targeting.filters.joinedAfter)
            if (joinedDate < afterDate) return false
          }
          
          if (targeting.filters.joinedBefore) {
            const joinedDate = new Date(user.created_at)
            const beforeDate = new Date(targeting.filters.joinedBefore)
            if (joinedDate > beforeDate) return false
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
      showAlert('Missing Information', 'Please enter both title and message for the notification.', 'warning')
      return
    }

    if (targetUserCount === 0) {
      showAlert('No Recipients', 'No users selected for notification. Please adjust your targeting settings.', 'warning')
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

  const PreviewIconComponent = getIconComponent(currentTemplate.icon)

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
                <div className="flex items-start space-x-3">
                  <PreviewIconComponent className="w-6 h-6 text-gray-300 mt-1" />
                  <div className="flex-1">
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
          </div>
        </div>

        {/* Targeting */}
        <div className="space-y-6">
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Target Audience</h3>
            
            {/* Targeting Method */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Targeting Method
              </label>
              <select
                value={targeting.method}
                onChange={(e) => {
                  setTargeting({ ...targeting, method: e.target.value })
                  if (e.target.value !== 'specific') {
                    setShowUserSelector(false)
                  }
                }}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Users</option>
                <option value="filter">Filter Users</option>
                <option value="specific">Specific Users</option>
              </select>
            </div>

            {/* Filter Options */}
            {targeting.method === 'filter' && (
              <div className="space-y-3 mb-4 p-3 bg-gray-700 rounded-md">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Subscription</label>
                  <select
                    value={targeting.filters.premium}
                    onChange={(e) => setTargeting({
                      ...targeting,
                      filters: { ...targeting.filters, premium: e.target.value }
                    })}
                    className="w-full px-2 py-1 text-sm border border-gray-600 rounded bg-gray-600 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Users</option>
                    <option value="true">Premium Only</option>
                    <option value="false">Free Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Verification</label>
                  <select
                    value={targeting.filters.verified}
                    onChange={(e) => setTargeting({
                      ...targeting,
                      filters: { ...targeting.filters, verified: e.target.value }
                    })}
                    className="w-full px-2 py-1 text-sm border border-gray-600 rounded bg-gray-600 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="all">All Users</option>
                    <option value="true">Verified Only</option>
                    <option value="false">Unverified Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">City</label>
                  <input
                    type="text"
                    value={targeting.filters.city}
                    onChange={(e) => setTargeting({
                      ...targeting,
                      filters: { ...targeting.filters, city: e.target.value }
                    })}
                    placeholder="Enter city name..."
                    className="w-full px-2 py-1 text-sm border border-gray-600 rounded bg-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Joined After</label>
                  <input
                    type="date"
                    value={targeting.filters.joinedAfter}
                    onChange={(e) => setTargeting({
                      ...targeting,
                      filters: { ...targeting.filters, joinedAfter: e.target.value }
                    })}
                    className="w-full px-2 py-1 text-sm border border-gray-600 rounded bg-gray-600 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1">Joined Before</label>
                  <input
                    type="date"
                    value={targeting.filters.joinedBefore}
                    onChange={(e) => setTargeting({
                      ...targeting,
                      filters: { ...targeting.filters, joinedBefore: e.target.value }
                    })}
                    className="w-full px-2 py-1 text-sm border border-gray-600 rounded bg-gray-600 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            )}

            {/* Specific Users Selection */}
            {targeting.method === 'specific' && (
              <div className="space-y-3 mb-4">
                <button
                  onClick={() => setShowUserSelector(!showUserSelector)}
                  className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors flex items-center justify-center space-x-2"
                >
                  {showUserSelector ? <EyeSlashIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
                  <span>{showUserSelector ? 'Hide' : 'Show'} User Selector</span>
                </button>

                {/* Selected Users */}
                {targeting.specificUsers.length > 0 && (
                  <div className="p-3 bg-gray-700 rounded-md">
                    <div className="text-sm font-medium text-gray-300 mb-2 flex items-center justify-between">
                      <span>Selected Users ({targeting.specificUsers.length})</span>
                    </div>
                    <div className="space-y-1 max-h-24 overflow-y-auto">
                      {targeting.specificUsers.map(userId => {
                        const user = users.find(u => u.id === userId)
                        return user ? (
                          <div key={userId} className="flex items-center justify-between text-xs">
                            <span className="text-gray-300">{user.display_name || 'No name'}</span>
                            <button
                              onClick={() => removeSpecificUser(userId)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <XMarkIcon className="w-3 h-3" />
                            </button>
                          </div>
                        ) : null
                      })}
                    </div>
                  </div>
                )}

                {/* User Selector */}
                {showUserSelector && (
                  <div className="p-3 bg-gray-700 rounded-md">
                    <div className="relative mb-2">
                      <MagnifyingGlassIcon className="w-4 h-4 absolute left-2 top-2 text-gray-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search users..."
                        className="w-full pl-8 pr-2 py-1 text-sm border border-gray-600 rounded bg-gray-600 text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto space-y-1">
                      {filteredUsers.map(user => (
                        <button
                          key={user.id}
                          onClick={() => addSpecificUser(user.id)}
                          disabled={targeting.specificUsers.includes(user.id)}
                          className={`w-full text-left px-2 py-1 text-xs rounded transition-colors flex items-center justify-between ${
                            targeting.specificUsers.includes(user.id)
                              ? 'bg-green-600 text-white cursor-not-allowed'
                              : 'bg-gray-600 hover:bg-gray-500 text-gray-300'
                          }`}
                        >
                          <div>
                            <span>{user.display_name || 'No name'}</span>
                            {user.city && <span className="text-gray-400"> • {user.city}</span>}
                            {user.is_premium && <span className="text-yellow-400"> • Premium</span>}
                            {user.is_verified && <span className="text-blue-400"> • Verified</span>}
                          </div>
                          {!targeting.specificUsers.includes(user.id) && (
                            <PlusIcon className="w-3 h-3" />
                          )}
                        </button>
                      ))}
                      {filteredUsers.length === 0 && (
                        <div className="text-center text-gray-400 text-sm py-2">No users found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

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