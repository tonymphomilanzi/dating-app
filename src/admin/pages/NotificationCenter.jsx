import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'
import NotificationComposer from '../components/NotificationComposer'
import NotificationHistory from '../components/NotificationHistory'
import NotificationTemplates from '../components/NotificationTemplates'

const NotificationCenter = () => {
  const { logAction } = useAuth()
  const [activeTab, setActiveTab] = useState('compose')
  const [notifications, setNotifications] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({})

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load notification history
      const { data: notificationData, error: notifError } = await supabaseAdmin
        .from('notifications')
        .select(`
          *,
          profiles (
            display_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (notifError) throw notifError

      // Load users for targeting
      const { data: userData, error: userError } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name, avatar_url, city, is_premium, is_verified')
        .order('display_name')

      if (userError) throw userError

      setNotifications(notificationData || [])
      setUsers(userData || [])

      // Calculate stats
      const now = new Date()
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

      const statsData = {
        total: notificationData?.length || 0,
        last24h: notificationData?.filter(n => new Date(n.created_at) >= last24h).length || 0,
        last7d: notificationData?.filter(n => new Date(n.created_at) >= last7d).length || 0,
        unread: notificationData?.filter(n => !n.read).length || 0,
        byType: {}
      }

      // Count by type
      notificationData?.forEach(n => {
        statsData.byType[n.type] = (statsData.byType[n.type] || 0) + 1
      })

      setStats(statsData)
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSendNotification = async (notificationData) => {
    try {
      const notifications = []
      
      // Prepare notifications for each target user
      notificationData.targetUsers.forEach(userId => {
        notifications.push({
          user_id: userId,
          type: notificationData.type,
          title: notificationData.title,
          message: notificationData.message,
          data: notificationData.data || {}
        })
      })

      // Insert notifications in batches
      const batchSize = 100
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize)
        const { error } = await supabaseAdmin
          .from('notifications')
          .insert(batch)

        if (error) throw error
      }

      await logAction('send_notification', 'notification', null, {
        type: notificationData.type,
        title: notificationData.title,
        target_count: notificationData.targetUsers.length,
        targeting: notificationData.targeting
      })

      await loadData()
      alert(`Notification sent to ${notificationData.targetUsers.length} users successfully!`)
    } catch (error) {
      console.error('Error sending notification:', error)
      alert('Error sending notification')
    }
  }

  const handleDeleteNotifications = async (notificationIds) => {
    try {
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .in('id', notificationIds)

      if (error) throw error

      await logAction('delete_notifications', 'notification', null, {
        count: notificationIds.length,
        notification_ids: notificationIds
      })

      await loadData()
      alert(`${notificationIds.length} notification(s) deleted successfully!`)
    } catch (error) {
      console.error('Error deleting notifications:', error)
      alert('Error deleting notifications')
    }
  }

  const tabs = [
    { id: 'compose', label: 'Compose', icon: '✏️' },
    { id: 'templates', label: 'Templates', icon: '📋' },
    { id: 'history', label: 'History', icon: '📜' }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Notification Center</h1>
          <p className="text-gray-400">Send announcements and manage user notifications</p>
        </div>
        
        <button
          onClick={loadData}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Total Sent</div>
          <div className="text-white text-xl font-bold">{stats.total || 0}</div>
        </div>
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-4">
          <div className="text-green-400 text-sm">Last 24 Hours</div>
          <div className="text-white text-xl font-bold">{stats.last24h || 0}</div>
        </div>
        <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
          <div className="text-blue-400 text-sm">Last 7 Days</div>
          <div className="text-white text-xl font-bold">{stats.last7d || 0}</div>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
          <div className="text-yellow-400 text-sm">Unread</div>
          <div className="text-white text-xl font-bold">{stats.unread || 0}</div>
        </div>
      </div>

      {/* Notification Type Stats */}
      {Object.keys(stats.byType || {}).length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Notifications by Type</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {Object.entries(stats.byType).map(([type, count]) => (
              <div key={type} className="text-center">
                <div className="text-2xl font-bold text-white">{count}</div>
                <div className="text-sm text-gray-400 capitalize">{type.replace('_', ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'compose' && (
          <NotificationComposer
            users={users}
            onSend={handleSendNotification}
            loading={loading}
          />
        )}
        
        {activeTab === 'templates' && (
          <NotificationTemplates
            onUseTemplate={(template) => {
              setActiveTab('compose')
              // You could pass the template data to the composer here
            }}
          />
        )}
        
        {activeTab === 'history' && (
          <NotificationHistory
            notifications={notifications}
            onDelete={handleDeleteNotifications}
            onRefresh={loadData}
            loading={loading}
          />
        )}
      </div>
    </div>
  )
}

export default NotificationCenter