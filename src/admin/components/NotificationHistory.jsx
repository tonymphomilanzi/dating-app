import { useState } from 'react'
import { getNotificationContent, formatRelativeTime, groupNotificationsByDate } from '../../lib/notificationHelpers'

const NotificationHistory = ({ notifications, onDelete, onRefresh, loading }) => {
  const [selectedNotifications, setSelectedNotifications] = useState(new Set())
  const [filters, setFilters] = useState({
    type: 'all',
    read: 'all',
    search: '',
    dateRange: 'all'
  })
  const [sortBy, setSortBy] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')

  // Filter notifications
  const filteredNotifications = notifications.filter(notification => {
    // Type filter
    if (filters.type !== 'all' && notification.type !== filters.type) return false
    
    // Read status filter
    if (filters.read !== 'all') {
      const isRead = filters.read === 'true'
      if (notification.read !== isRead) return false
    }
    
    // Search filter
    if (filters.search) {
      const content = getNotificationContent(notification.type, notification.data || {})
      const searchLower = filters.search.toLowerCase()
      if (
        !notification.title?.toLowerCase().includes(searchLower) &&
        !notification.message?.toLowerCase().includes(searchLower) &&
        !content.title.toLowerCase().includes(searchLower) &&
        !content.message.toLowerCase().includes(searchLower) &&
        !notification.profiles?.display_name?.toLowerCase().includes(searchLower)
      ) return false
    }
    
    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date()
      const notificationDate = new Date(notification.created_at)
      const daysDiff = (now - notificationDate) / (1000 * 60 * 60 * 24)
      
      switch (filters.dateRange) {
        case 'today':
          if (daysDiff > 1) return false
          break
        case 'week':
          if (daysDiff > 7) return false
          break
        case 'month':
          if (daysDiff > 30) return false
          break
      }
    }
    
    return true
  })

  // Sort notifications
  const sortedNotifications = [...filteredNotifications].sort((a, b) => {
    let aValue = a[sortBy]
    let bValue = b[sortBy]
    
    if (sortBy === 'created_at') {
      aValue = new Date(aValue)
      bValue = new Date(bValue)
    }
    
    if (sortOrder === 'asc') {
      return aValue > bValue ? 1 : -1
    }
    return aValue < bValue ? 1 : -1
  })

  // Group notifications by date for better organization
  const groupedNotifications = groupNotificationsByDate(sortedNotifications)

  // Get unique notification types for filter
  const notificationTypes = [...new Set(notifications.map(n => n.type))]

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedNotifications(new Set(sortedNotifications.map(n => n.id)))
    } else {
      setSelectedNotifications(new Set())
    }
  }

  const handleSelectNotification = (notificationId, checked) => {
    const newSelected = new Set(selectedNotifications)
    if (checked) {
      newSelected.add(notificationId)
    } else {
      newSelected.delete(notificationId)
    }
    setSelectedNotifications(newSelected)
  }

  const handleBulkDelete = () => {
    if (selectedNotifications.size === 0) {
      alert('No notifications selected')
      return
    }
    
    if (confirm(`Delete ${selectedNotifications.size} notification(s)?`)) {
      onDelete(Array.from(selectedNotifications))
      setSelectedNotifications(new Set())
    }
  }

  const getNotificationIcon = (type) => {
    const content = getNotificationContent(type)
    const iconMap = {
      heart: '❤️',
      sparkles: '✨',
      'check-circle': '✅',
      'x-circle': '❌',
      alert: '⚠️',
      gift: '🎁',
      megaphone: '📣',
      clock: '⏰',
      ban: '🚫',
      star: '⭐',
      message: '💬',
      'badge-check': '🏆',
      bell: '🔔'
    }
    return iconMap[content.icon] || '🔔'
  }

  const renderNotificationGroup = (title, notifications) => {
    if (notifications.length === 0) return null

    return (
      <div key={title} className="mb-6">
        <h4 className="text-sm font-medium text-gray-400 uppercase tracking-wider mb-3">
          {title}
        </h4>
        <div className="space-y-2">
          {notifications.map((notification) => {
            const content = getNotificationContent(notification.type, notification.data || {})
            const displayTitle = notification.title || content.title
            const displayMessage = notification.message || content.message
            
            return (
              <div
                key={notification.id}
                className={`bg-gray-800 border border-gray-700 rounded-lg p-4 hover:bg-gray-700/50 transition-colors ${
                  selectedNotifications.has(notification.id) ? 'ring-2 ring-blue-500' : ''
                }`}
              >
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={selectedNotifications.has(notification.id)}
                    onChange={(e) => handleSelectNotification(notification.id, e.target.checked)}
                    className="mt-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  
                  <div className="text-2xl">
                    {getNotificationIcon(notification.type)}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h5 className="text-white font-medium">
                          {displayTitle}
                        </h5>
                        <p className="text-gray-300 text-sm mt-1">
                          {displayMessage}
                        </p>
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-400">
                          <span className="flex items-center space-x-1">
                            <span>👤</span>
                            <span>{notification.profiles?.display_name || 'System'}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <span>📋</span>
                            <span className="capitalize">{notification.type.replace(/_/g, ' ')}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <span>⏰</span>
                            <span>{formatRelativeTime(notification.created_at)}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <span>{notification.read ? '✅' : '📬'}</span>
                            <span>{notification.read ? 'Read' : 'Unread'}</span>
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
            <select
              value={filters.type}
              onChange={(e) => setFilters({ ...filters, type: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Types</option>
              {notificationTypes.map(type => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <select
              value={filters.read}
              onChange={(e) => setFilters({ ...filters, read: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="false">Unread</option>
              <option value="true">Read</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Date Range</label>
            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="week">This Week</option>
              <option value="month">This Month</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search notifications..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedNotifications.size > 0 && (
          <div className="flex items-center justify-between pt-4 border-t border-gray-600">
            <span className="text-blue-300">
              {selectedNotifications.size} notification{selectedNotifications.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedNotifications(new Set())}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Total</div>
          <div className="text-white text-xl font-bold">{sortedNotifications.length}</div>
        </div>
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-4">
          <div className="text-green-400 text-sm">Read</div>
          <div className="text-white text-xl font-bold">
            {sortedNotifications.filter(n => n.read).length}
          </div>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
          <div className="text-yellow-400 text-sm">Unread</div>
          <div className="text-white text-xl font-bold">
            {sortedNotifications.filter(n => !n.read).length}
          </div>
        </div>
        <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
          <div className="text-blue-400 text-sm">Types</div>
          <div className="text-white text-xl font-bold">{notificationTypes.length}</div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={selectedNotifications.size === sortedNotifications.length && sortedNotifications.length > 0}
              onChange={(e) => handleSelectAll(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-2"
            />
            <span className="text-gray-300">Select All</span>
          </label>
        </div>
        
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Notifications List */}
      {loading ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
          <div className="text-center text-gray-400">Loading notifications...</div>
        </div>
      ) : sortedNotifications.length === 0 ? (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
          <div className="text-center text-gray-400">
            {notifications.length === 0 ? 'No notifications found' : 'No notifications match your filters'}
          </div>
        </div>
      ) : (
        <div>
          {renderNotificationGroup('Today', groupedNotifications.today)}
          {renderNotificationGroup('Yesterday', groupedNotifications.yesterday)}
          {renderNotificationGroup('This Week', groupedNotifications.thisWeek)}
          {renderNotificationGroup('Older', groupedNotifications.older)}
        </div>
      )}
    </div>
  )
}

export default NotificationHistory