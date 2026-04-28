import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'
import { useAlert } from '../components/CustomAlert/AlertProvider'
import NotificationComposer from '../components/NotificationComposer'
import NotificationHistory from '../components/NotificationHistory'
import NotificationTemplates from '../components/NotificationTemplates'
import { 
  PencilIcon,
  ClipboardDocumentListIcon,
  ClockIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline'

const NotificationCenter = () => {
  const { logAction } = useAuth()
  const { showAlert } = useAlert()
  const [activeTab, setActiveTab] = useState('compose')
  const [notifications, setNotifications] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({})
  const [composerTemplate, setComposerTemplate] = useState(null)

  useEffect(() => {
    loadData()
    testDatabaseConnection()
  }, [])

  const testDatabaseConnection = async () => {
    try {
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('count(*)')
        .limit(1)
      
      if (error) {
        console.error('Database connection test failed:', error)
        return false
      }
      
      console.log('Database connection successful')
      return true
    } catch (error) {
      console.error('Database connection error:', error)
      return false
    }
  }

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load notification history
      const { data: notificationData, error: notifError } = await supabaseAdmin
        .from('notifications')
        .select(`
          *,
          profiles:user_id (
            display_name,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100)

      if (notifError) {
        console.error('Error loading notifications:', notifError)
      }

      // Load users for targeting
      const { data: userData, error: userError } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name, avatar_url, city, is_premium, is_verified, created_at')
        .order('display_name')

      if (userError) {
        console.error('Error loading users:', userError)
        throw userError
      }

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
      showAlert('Error', `Failed to load data: ${error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleSendNotification = async (notificationData) => {
    try {
      console.log('Sending notification with data:', notificationData)
      
      if (!notificationData.targetUsers || notificationData.targetUsers.length === 0) {
        throw new Error('No target users specified')
      }

      // Validate required fields
      if (!notificationData.type || !notificationData.title) {
        throw new Error('Type and title are required')
      }

      // Validate that all target users exist in the profiles table
      const { data: validUsers, error: userError } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .in('id', notificationData.targetUsers)

      if (userError) throw userError

      const validUserIds = validUsers.map(u => u.id)
      const invalidUsers = notificationData.targetUsers.filter(id => !validUserIds.includes(id))
      
      if (invalidUsers.length > 0) {
        console.warn('Invalid user IDs found:', invalidUsers)
      }

      if (validUserIds.length === 0) {
        throw new Error('No valid users found to send notifications to')
      }

      const notifications = validUserIds.map(userId => ({
        user_id: userId,
        type: notificationData.type,
        title: notificationData.title,
        message: notificationData.message,
        data: notificationData.data || {}
      }))

      console.log('Prepared notifications:', notifications)

      // Test with a single notification first
      const { data: testResult, error: testError } = await supabaseAdmin
        .from('notifications')
        .insert([notifications[0]])
        .select()

      if (testError) {
        console.error('Test insert failed:', testError)
        throw new Error(`Database error: ${testError.message}`)
      }

      console.log('Test notification successful:', testResult)

      // If test passes, insert the rest in batches
      const batchSize = 100
      let successCount = 1 // We already inserted the first one

      for (let i = 1; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize)
        const { error } = await supabaseAdmin
          .from('notifications')
          .insert(batch)

        if (error) {
          console.error(`Batch ${Math.floor(i/batchSize) + 1} failed:`, error)
          throw new Error(`Batch insert failed: ${error.message}`)
        }
        
        successCount += batch.length
      }

      if (logAction) {
        await logAction('send_notification', 'notification', null, {
          type: notificationData.type,
          title: notificationData.title,
          target_count: successCount,
          targeting: notificationData.targeting
        })
      }

      await loadData()
      showAlert('Success', `Notification sent to ${successCount} users successfully!`, 'success')
      
    } catch (error) {
      console.error('Complete error details:', {
        message: error.message,
        stack: error.stack,
        notificationData
      })
      showAlert('Error', `Failed to send notification: ${error.message}`, 'error')
    }
  }

  const handleDeleteNotifications = async (notificationIds) => {
    try {
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .in('id', notificationIds)

      if (error) throw error

      if (logAction) {
        await logAction('delete_notifications', 'notification', null, {
          count: notificationIds.length,
          notification_ids: notificationIds
        })
      }

      await loadData()
    } catch (error) {
      console.error('Error deleting notifications:', error)
      showAlert('Error', `Failed to delete notifications: ${error.message}`, 'error')
    }
  }

  const handleUseTemplate = (template) => {
    setComposerTemplate(template)
    setActiveTab('compose')
  }

  const tabs = [
    { id: 'compose', label: 'Compose', icon: PencilIcon },
    { id: 'templates', label: 'Templates', icon: ClipboardDocumentListIcon },
    { id: 'history', label: 'History', icon: ClockIcon }
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
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50 flex items-center space-x-2"
        >
          <ArrowPathIcon className="w-4 h-4" />
          <span>{loading ? 'Loading...' : 'Refresh'}</span>
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
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'compose' && (
          <NotificationComposer
            users={users}
            onSend={handleSendNotification}
            loading={loading}
            template={composerTemplate}
            onTemplateUsed={() => setComposerTemplate(null)}
          />
        )}
        
        {activeTab === 'templates' && (
          <NotificationTemplates onUseTemplate={handleUseTemplate} />
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