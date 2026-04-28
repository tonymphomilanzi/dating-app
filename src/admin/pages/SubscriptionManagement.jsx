import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'
import SubscriptionTable from '../components/SubscriptionTable'
import GrantSubscriptionModal from '../components/GrantSubscriptionModal'
import ConfirmModal from '../components/ConfirmModal'

const SubscriptionManagement = () => {
  const { logAction } = useAuth()
  const [subscriptions, setSubscriptions] = useState([])
  const [filteredSubscriptions, setFilteredSubscriptions] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    plan: 'all',
    status: 'all',
    search: '',
    dateRange: 'all'
  })
  const [showGrantModal, setShowGrantModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [bulkSelected, setBulkSelected] = useState(new Set())

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    filterSubscriptions()
  }, [subscriptions, filters])

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load subscriptions with user data
      const { data: subscriptionData, error: subError } = await supabaseAdmin
        .from('user_subscriptions')
        .select(`
          *,
          profiles (
            id,
            display_name,
            avatar_url,
            city,
            is_premium,
            is_verified
          )
        `)
        .order('created_at', { ascending: false })

      if (subError) throw subError

      // Load all users for granting new subscriptions
      const { data: userData, error: userError } = await supabaseAdmin
        .from('profiles')
        .select('id, display_name, avatar_url, city')
        .order('display_name')

      if (userError) throw userError

      setSubscriptions(subscriptionData || [])
      setUsers(userData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterSubscriptions = () => {
    let filtered = [...subscriptions]

    // Plan filter
    if (filters.plan !== 'all') {
      filtered = filtered.filter(sub => sub.plan === filters.plan)
    }

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(sub => sub.status === filters.status)
    }

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(sub => 
        sub.profiles?.display_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        sub.profiles?.city?.toLowerCase().includes(filters.search.toLowerCase())
      )
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date()
      const days = {
        'today': 1,
        'week': 7,
        'month': 30
      }
      
      if (days[filters.dateRange]) {
        const cutoff = new Date(now.getTime() - (days[filters.dateRange] * 24 * 60 * 60 * 1000))
        filtered = filtered.filter(sub => new Date(sub.created_at) >= cutoff)
      }
    }

    setFilteredSubscriptions(filtered)
  }

  const handleSubscriptionAction = async (action, subscription, data = {}) => {
    try {
      let updateData = {}
      let logMessage = ''

      switch (action) {
        case 'activate':
          updateData = { status: 'active' }
          logMessage = `Activated subscription for ${subscription.profiles?.display_name}`
          break
        case 'cancel':
          updateData = { 
            status: 'cancelled', 
            cancelled_at: new Date().toISOString() 
          }
          logMessage = `Cancelled subscription for ${subscription.profiles?.display_name}`
          break
        case 'expire':
          updateData = { 
            status: 'expired',
            expires_at: new Date().toISOString()
          }
          logMessage = `Expired subscription for ${subscription.profiles?.display_name}`
          break
        case 'extend':
          const currentExpiry = subscription.expires_at ? new Date(subscription.expires_at) : new Date()
          const newExpiry = new Date(currentExpiry.getTime() + (data.months * 30 * 24 * 60 * 60 * 1000))
          updateData = { 
            expires_at: newExpiry.toISOString(),
            status: 'active'
          }
          logMessage = `Extended subscription for ${subscription.profiles?.display_name} by ${data.months} month(s)`
          break
        case 'delete':
          const { error: deleteError } = await supabaseAdmin
            .from('user_subscriptions')
            .delete()
            .eq('id', subscription.id)

          if (deleteError) throw deleteError

          // Update user premium status if this was their only active subscription
          const { data: otherSubs } = await supabaseAdmin
            .from('user_subscriptions')
            .select('id')
            .eq('user_id', subscription.user_id)
            .eq('status', 'active')

          if (!otherSubs || otherSubs.length === 0) {
            await supabaseAdmin
              .from('profiles')
              .update({ is_premium: false })
              .eq('id', subscription.user_id)
          }

          await logAction('delete', 'subscription', subscription.id, {
            user_name: subscription.profiles?.display_name,
            plan: subscription.plan
          })

          await loadData()
          setConfirmAction(null)
          alert('Subscription deleted successfully!')
          return
      }

      const { error } = await supabaseAdmin
        .from('user_subscriptions')
        .update(updateData)
        .eq('id', subscription.id)

      if (error) throw error

      // Update user premium status based on subscription
      const isPremium = updateData.status === 'active' && subscription.plan !== 'free'
      await supabaseAdmin
        .from('profiles')
        .update({ is_premium: isPremium })
        .eq('id', subscription.user_id)

      await logAction(action, 'subscription', subscription.id, {
        user_name: subscription.profiles?.display_name,
        plan: subscription.plan,
        ...data
      })

      await loadData()
      setConfirmAction(null)
      alert(`${logMessage} successfully!`)
    } catch (error) {
      console.error('Error performing action:', error)
      alert('Error performing action')
    }
  }

  const handleGrantSubscription = async (subscriptionData) => {
    try {
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + parseInt(subscriptionData.duration))

      // Cancel any existing active subscriptions for this user
      await supabaseAdmin
        .from('user_subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('user_id', subscriptionData.userId)
        .eq('status', 'active')

      // Create new subscription
      const { error } = await supabaseAdmin
        .from('user_subscriptions')
        .insert({
          user_id: subscriptionData.userId,
          plan: subscriptionData.plan,
          status: 'active',
          expires_at: expiresAt.toISOString(),
          granted_by_admin: true
        })

      if (error) throw error

      // Update user premium status
      await supabaseAdmin
        .from('profiles')
        .update({ is_premium: subscriptionData.plan !== 'free' })
        .eq('id', subscriptionData.userId)

      const user = users.find(u => u.id === subscriptionData.userId)
      await logAction('grant', 'subscription', null, {
        user_name: user?.display_name,
        plan: subscriptionData.plan,
        duration: subscriptionData.duration
      })

      await loadData()
      setShowGrantModal(false)
      alert('Subscription granted successfully!')
    } catch (error) {
      console.error('Error granting subscription:', error)
      alert('Error granting subscription')
    }
  }

  const handleBulkAction = async (action) => {
    try {
      if (bulkSelected.size === 0) {
        alert('No subscriptions selected')
        return
      }

      let updateData = {}
      switch (action) {
        case 'cancel':
          updateData = { status: 'cancelled', cancelled_at: new Date().toISOString() }
          break
        case 'activate':
          updateData = { status: 'active' }
          break
        case 'expire':
          updateData = { status: 'expired' }
          break
      }

      const { error } = await supabaseAdmin
        .from('user_subscriptions')
        .update(updateData)
        .in('id', Array.from(bulkSelected))

      if (error) throw error

      await logAction(`bulk_${action}`, 'subscription', null, {
        count: bulkSelected.size,
        subscription_ids: Array.from(bulkSelected)
      })

      setBulkSelected(new Set())
      await loadData()
      alert(`Bulk ${action} completed for ${bulkSelected.size} subscriptions!`)
    } catch (error) {
      console.error('Error performing bulk action:', error)
      alert('Error performing bulk action')
    }
  }

  const getStatusStats = () => {
    const now = new Date()
    return {
      active: subscriptions.filter(s => s.status === 'active').length,
      expired: subscriptions.filter(s => s.status === 'expired').length,
      cancelled: subscriptions.filter(s => s.status === 'cancelled').length,
      expiringSoon: subscriptions.filter(s => {
        if (s.status !== 'active' || !s.expires_at) return false
        const expiry = new Date(s.expires_at)
        const daysDiff = (expiry - now) / (1000 * 60 * 60 * 24)
        return daysDiff <= 7 && daysDiff > 0
      }).length,
      total: subscriptions.length
    }
  }

  const getPlanStats = () => {
    return {
      free: subscriptions.filter(s => s.plan === 'free' && s.status === 'active').length,
      basic: subscriptions.filter(s => s.plan === 'basic' && s.status === 'active').length,
      premium: subscriptions.filter(s => s.plan === 'premium' && s.status === 'active').length,
      vip: subscriptions.filter(s => s.plan === 'vip' && s.status === 'active').length
    }
  }

  const statusStats = getStatusStats()
  const planStats = getPlanStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Subscription Management</h1>
          <p className="text-gray-400">Manage user subscriptions and billing</p>
        </div>
        
        <div className="flex space-x-2">
          <button
            onClick={() => setShowGrantModal(true)}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
          >
            Grant Subscription
          </button>
          <button
            onClick={loadData}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Status Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Total Subscriptions</div>
          <div className="text-white text-xl font-bold">{statusStats.total}</div>
        </div>
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-4">
          <div className="text-green-400 text-sm">Active</div>
          <div className="text-white text-xl font-bold">{statusStats.active}</div>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
          <div className="text-yellow-400 text-sm">Expiring Soon</div>
          <div className="text-white text-xl font-bold">{statusStats.expiringSoon}</div>
        </div>
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-4">
          <div className="text-red-400 text-sm">Expired</div>
          <div className="text-white text-xl font-bold">{statusStats.expired}</div>
        </div>
        <div className="bg-gray-900/20 border border-gray-600 rounded-lg p-4">
          <div className="text-gray-400 text-sm">Cancelled</div>
          <div className="text-white text-xl font-bold">{statusStats.cancelled}</div>
        </div>
      </div>

      {/* Plan Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Free Plans</div>
          <div className="text-white text-xl font-bold">{planStats.free}</div>
        </div>
        <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
          <div className="text-blue-400 text-sm">Basic Plans</div>
          <div className="text-white text-xl font-bold">{planStats.basic}</div>
        </div>
        <div className="bg-purple-900/20 border border-purple-600 rounded-lg p-4">
          <div className="text-purple-400 text-sm">Premium Plans</div>
          <div className="text-white text-xl font-bold">{planStats.premium}</div>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
          <div className="text-yellow-400 text-sm">VIP Plans</div>
          <div className="text-white text-xl font-bold">{planStats.vip}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Plan</label>
            <select
              value={filters.plan}
              onChange={(e) => setFilters({ ...filters, plan: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
              <option value="vip">VIP</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="trial">Trial</option>
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
              placeholder="Search users..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ plan: 'all', status: 'all', search: '', dateRange: 'all' })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {bulkSelected.size > 0 && (
        <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-blue-300">
              {bulkSelected.size} subscription{bulkSelected.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => handleBulkAction('activate')}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
              >
                Activate All
              </button>
              <button
                onClick={() => handleBulkAction('cancel')}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                Cancel All
              </button>
              <button
                onClick={() => handleBulkAction('expire')}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors"
              >
                Expire All
              </button>
              <button
                onClick={() => setBulkSelected(new Set())}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Subscription Table */}
      <SubscriptionTable
        subscriptions={filteredSubscriptions}
        loading={loading}
        bulkSelected={bulkSelected}
        onSelectSubscription={(subId, selected) => {
          const newSelected = new Set(bulkSelected)
          if (selected) {
            newSelected.add(subId)
          } else {
            newSelected.delete(subId)
          }
          setBulkSelected(newSelected)
        }}
        onSelectAll={(selected) => {
          if (selected) {
            setBulkSelected(new Set(filteredSubscriptions.map(s => s.id)))
          } else {
            setBulkSelected(new Set())
          }
        }}
        onSubscriptionAction={(action, subscription, data) => {
          if (action === 'delete') {
            setConfirmAction({
              type: 'delete',
              subscription,
              title: 'Delete Subscription',
              message: `Are you sure you want to delete this subscription for ${subscription.profiles?.display_name}? This action cannot be undone.`,
              confirmText: 'Delete',
              onConfirm: () => handleSubscriptionAction('delete', subscription)
            })
          } else {
            handleSubscriptionAction(action, subscription, data)
          }
        }}
      />

      {/* Grant Subscription Modal */}
      {showGrantModal && (
        <GrantSubscriptionModal
          users={users}
          onClose={() => setShowGrantModal(false)}
          onGrant={handleGrantSubscription}
        />
      )}

      {/* Confirm Action Modal */}
      {confirmAction && (
        <ConfirmModal
          title={confirmAction.title}
          message={confirmAction.message}
          confirmText={confirmAction.confirmText}
          onConfirm={confirmAction.onConfirm}
          onCancel={() => setConfirmAction(null)}
          destructive={confirmAction.type === 'delete'}
        />
      )}
    </div>
  )
}

export default SubscriptionManagement