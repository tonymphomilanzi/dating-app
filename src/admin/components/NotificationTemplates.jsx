import { useState } from 'react'
import { NOTIFICATION_TYPES, getNotificationContent, getIconComponent } from '../../lib/notificationHelpers'
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline'

const NotificationTemplates = ({ onUseTemplate }) => {
  const [selectedCategory, setSelectedCategory] = useState('admin')
  const [searchTerm, setSearchTerm] = useState('')

  // Organize notification types by category
  const notificationCategories = {
    admin: {
      title: 'Admin Announcements',
      description: 'System updates, announcements, and admin communications',
      types: [
        NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT,
        NOTIFICATION_TYPES.SYSTEM_UPDATE,
        NOTIFICATION_TYPES.MAINTENANCE_SCHEDULED,
        NOTIFICATION_TYPES.NEW_FEATURE_AVAILABLE,
      ]
    },
    subscription: {
      title: 'Subscription Management',
      description: 'Premium subscription related notifications',
      types: [
        NOTIFICATION_TYPES.SUBSCRIPTION_GRANTED,
        NOTIFICATION_TYPES.SUBSCRIPTION_REVOKED,
        NOTIFICATION_TYPES.SUBSCRIPTION_EXTENDED,
        NOTIFICATION_TYPES.SUBSCRIPTION_ACTIVATED,
        NOTIFICATION_TYPES.SUBSCRIPTION_UPGRADED,
        NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING_SOON,
        NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRED,
        NOTIFICATION_TYPES.TRIAL_STARTED,
        NOTIFICATION_TYPES.TRIAL_ENDING_SOON,
        NOTIFICATION_TYPES.FEATURE_UNLOCKED_CHAT,
        NOTIFICATION_TYPES.FEATURE_UNLOCKED_UNLIMITED_LIKES,
        NOTIFICATION_TYPES.FEATURE_LOCKED,
      ]
    },
    moderation: {
      title: 'Content Moderation',
      description: 'Approvals, rejections, and moderation actions',
      types: [
        NOTIFICATION_TYPES.CLINIC_APPROVED,
        NOTIFICATION_TYPES.CLINIC_REJECTED,
        NOTIFICATION_TYPES.CLINIC_PENDING,
        NOTIFICATION_TYPES.CLINIC_SUSPENDED,
        NOTIFICATION_TYPES.PROFILE_VERIFIED,
        NOTIFICATION_TYPES.PROFILE_VERIFICATION_REJECTED,
        NOTIFICATION_TYPES.CONTENT_FLAGGED,
        NOTIFICATION_TYPES.CONTENT_REMOVED,
        NOTIFICATION_TYPES.ACCOUNT_WARNING,
        NOTIFICATION_TYPES.ACCOUNT_SUSPENDED,
      ]
    },
    engagement: {
      title: 'User Engagement',
      description: 'Matches, likes, and social interactions',
      types: [
        NOTIFICATION_TYPES.NEW_MATCH,
        NOTIFICATION_TYPES.MATCH_MESSAGE,
        NOTIFICATION_TYPES.PROFILE_LIKE,
        NOTIFICATION_TYPES.CLINIC_REVIEW,
        NOTIFICATION_TYPES.REVIEW_REPLY,
      ]
    }
  }

  // Get template data for a notification type
  const getTemplate = (type) => {
    const sampleData = {
      userName: 'John Doe',
      clinicName: 'Sample Spa',
      planName: 'Premium',
      duration: '3 months',
      daysLeft: '3',
      amount: '9.99',
      reason: 'Thank you for being an amazing user!',
      title: 'Important Announcement',
      message: 'We have exciting news to share with you!',
    }
    
    return getNotificationContent(type, sampleData)
  }

  // Filter templates based on search and category
  const getFilteredTemplates = () => {
    const category = notificationCategories[selectedCategory]
    if (!category) return []

    let types = category.types
    
    if (searchTerm) {
      types = types.filter(type => {
        const template = getTemplate(type)
        return (
          type.toLowerCase().includes(searchTerm.toLowerCase()) ||
          template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
          template.message.toLowerCase().includes(searchTerm.toLowerCase())
        )
      })
    }

    return types.map(type => ({
      type,
      ...getTemplate(type)
    }))
  }

  const handleUseTemplate = (template) => {
    onUseTemplate({
      type: template.type,
      title: template.title,
      message: template.message,
      data: {}
    })
  }

  const getTypeColor = (type) => {
    if (type.includes('approved') || type.includes('activated') || type.includes('unlocked')) {
      return 'border-green-500 bg-green-900/20'
    }
    if (type.includes('rejected') || type.includes('expired') || type.includes('failed') || type.includes('suspended')) {
      return 'border-red-500 bg-red-900/20'
    }
    if (type.includes('warning') || type.includes('expiring') || type.includes('ending')) {
      return 'border-yellow-500 bg-yellow-900/20'
    }
    if (type.includes('admin') || type.includes('announcement')) {
      return 'border-blue-500 bg-blue-900/20'
    }
    return 'border-gray-500 bg-gray-900/20'
  }

  const filteredTemplates = getFilteredTemplates()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-2">Notification Templates</h3>
        <p className="text-gray-400">Pre-built templates for common notifications</p>
      </div>

      {/* Search and Category Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="Search templates..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="sm:w-64">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {Object.entries(notificationCategories).map(([key, category]) => (
              <option key={key} value={key}>
                {category.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Category Description */}
      {notificationCategories[selectedCategory] && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <h4 className="text-white font-medium">{notificationCategories[selectedCategory].title}</h4>
          <p className="text-gray-400 text-sm mt-1">{notificationCategories[selectedCategory].description}</p>
        </div>
      )}

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8 text-center">
          <div className="text-gray-400">
            {searchTerm ? 'No templates found matching your search' : 'No templates available'}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => {
            const IconComponent = getIconComponent(template.icon)
            
            return (
              <div
                key={template.type}
                className={`rounded-lg border p-4 hover:shadow-lg transition-all duration-200 cursor-pointer ${getTypeColor(template.type)}`}
                onClick={() => handleUseTemplate(template)}
              >
                {/* Template Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h4 className="text-white font-medium text-sm mb-1">
                      {template.title}
                    </h4>
                    <p className="text-xs text-gray-400 uppercase tracking-wider">
                      {template.type.replace(/_/g, ' ')}
                    </p>
                  </div>
                  <div className="ml-2">
                    <IconComponent className="w-6 h-6 text-gray-300" />
                  </div>
                </div>

                {/* Template Preview */}
                <div className="bg-black/20 rounded p-3 mb-3">
                  <div className="text-white font-medium text-sm mb-1">
                    {template.title}
                  </div>
                  <div className="text-gray-300 text-xs line-clamp-2">
                    {template.message}
                  </div>
                </div>

                {/* Use Template Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUseTemplate(template)
                  }}
                  className="w-full px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded transition-colors"
                >
                  Use Template
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <h4 className="text-white font-medium mb-4">Quick Actions</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => handleUseTemplate(getTemplate(NOTIFICATION_TYPES.ADMIN_ANNOUNCEMENT))}
            className="p-3 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm text-center transition-colors flex flex-col items-center space-y-2"
          >
            {(() => {
              const IconComponent = getIconComponent('megaphone')
              return <IconComponent className="w-5 h-5" />
            })()}
            <span>Announcement</span>
          </button>
          <button
            onClick={() => handleUseTemplate(getTemplate(NOTIFICATION_TYPES.SYSTEM_UPDATE))}
            className="p-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white text-sm text-center transition-colors flex flex-col items-center space-y-2"
          >
            {(() => {
              const IconComponent = getIconComponent('sparkles')
              return <IconComponent className="w-5 h-5" />
            })()}
            <span>System Update</span>
          </button>
          <button
            onClick={() => handleUseTemplate(getTemplate(NOTIFICATION_TYPES.MAINTENANCE_SCHEDULED))}
            className="p-3 bg-orange-600 hover:bg-orange-700 rounded-lg text-white text-sm text-center transition-colors flex flex-col items-center space-y-2"
          >
            {(() => {
              const IconComponent = getIconComponent('tools')
              return <IconComponent className="w-5 h-5" />
            })()}
            <span>Maintenance</span>
          </button>
          <button
            onClick={() => handleUseTemplate(getTemplate(NOTIFICATION_TYPES.NEW_FEATURE_AVAILABLE))}
            className="p-3 bg-green-600 hover:bg-green-700 rounded-lg text-white text-sm text-center transition-colors flex flex-col items-center space-y-2"
          >
            {(() => {
              const IconComponent = getIconComponent('sparkles')
              return <IconComponent className="w-5 h-5" />
            })()}
            <span>New Feature</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default NotificationTemplates