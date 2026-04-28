import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'
import UserTable from '../components/UserTable'
import UserModal from '../components/UserModal'
import ConfirmModal from '../components/ConfirmModal'

const UserManagement = () => {
  const { logAction } = useAuth()
  const [users, setUsers] = useState([])
  const [filteredUsers, setFilteredUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [filters, setFilters] = useState({
    status: 'all',
    subscription: 'all',
    verified: 'all',
    admin: 'all'
  })
  const [selectedUser, setSelectedUser] = useState(null)
  const [showUserModal, setShowUserModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [])

  useEffect(() => {
    filterUsers()
  }, [users, searchTerm, filters])

const loadUsers = async () => {
  try {
    setLoading(true)
    console.log('🔍 Loading all registered users...')
    
    // 1. Get all users from auth.users
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Auth query error:', authError)
      throw authError
    }

    const authUsers = authData.users || []
    console.log('👥 Found', authUsers.length, 'registered users')

    if (authUsers.length === 0) {
      setUsers([])
      return
    }

    const userIds = authUsers.map(user => user.id)

    // 2. Get profiles data
    const { data: profiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .in('id', userIds)

    if (profileError) {
      console.warn('⚠️ Profile query error:', profileError)
    }

    // 3. Get subscriptions data (separate query since no direct FK)
    const { data: subscriptions, error: subscriptionError } = await supabaseAdmin
      .from('user_subscriptions')
      .select('*')
      .in('user_id', userIds)
      .order('created_at', { ascending: false })

    if (subscriptionError) {
      console.warn('⚠️ Subscription query error:', subscriptionError)
    }

    // 4. Get photos data
    const profileIds = profiles?.map(p => p.id) || []
    const { data: photos, error: photoError } = await supabaseAdmin
      .from('photos')
      .select('*')
      .in('user_id', profileIds)

    if (photoError) {
      console.warn('⚠️ Photos query error:', photoError)
    }

    // 5. Get stream and clinic counts
    const { data: streamCounts, error: streamError } = await supabaseAdmin
      .from('streams')
      .select('user_id')
      .in('user_id', profileIds)

    const { data: clinicCounts, error: clinicError } = await supabaseAdmin
      .from('massage_clinics')
      .select('owner_id')
      .in('owner_id', userIds)

    // 6. Merge all data together
    const mergedUsers = authUsers.map(authUser => {
      const profile = profiles?.find(p => p.id === authUser.id) || {}
      const userSubscriptions = subscriptions?.filter(s => s.user_id === authUser.id) || []
      const userPhotos = photos?.filter(p => p.user_id === authUser.id) || []
      const streamCount = streamCounts?.filter(s => s.user_id === authUser.id).length || 0
      const clinicCount = clinicCounts?.filter(c => c.owner_id === authUser.id).length || 0
      
      return {
        // Auth data
        id: authUser.id,
        email: authUser.email,
        email_confirmed_at: authUser.email_confirmed_at,
        last_sign_in_at: authUser.last_sign_in_at,
        created_at: authUser.created_at,
        
        // Profile data
        display_name: profile.display_name || authUser.email?.split('@')[0] || 'Unknown User',
        bio: profile.bio,
        avatar_url: profile.avatar_url,
        city: profile.city,
        gender: profile.gender,
        dob: profile.dob,
        profession: profile.profession,
        is_premium: profile.is_premium || false,
        is_verified: profile.is_verified || false,
        is_admin: profile.is_admin || false,
        updated_at: profile.updated_at || authUser.created_at,
        
        // Related data (formatted to match expected structure)
        user_subscriptions: userSubscriptions,
        photos: userPhotos,
        streams: [{ count: streamCount }], // Format expected by UserTable
        massage_clinics: [{ count: clinicCount }], // Format expected by UserTable
        
        // Helper flags
        profile_complete: !!(profile.display_name && profile.dob),
        has_active_subscription: userSubscriptions.some(s => s.status === 'active')
      }
    })

    console.log('✅ Successfully merged', mergedUsers.length, 'users')
    console.log('📊 Sample user data:', mergedUsers[0])
    setUsers(mergedUsers)

  } catch (error) {
    console.error('❌ Error loading users:', error)
    
    // Fallback: Just get profiles without related data
    try {
      const { data: basicProfiles, error: basicError } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      
      if (!basicError && basicProfiles) {
        console.log('🔄 Using basic profiles as fallback:', basicProfiles.length)
        setUsers(basicProfiles.map(profile => ({
          ...profile,
          user_subscriptions: [],
          photos: [],
          streams: [{ count: 0 }],
          massage_clinics: [{ count: 0 }],
          profile_complete: !!(profile.display_name && profile.dob)
        })))
      }
    } catch (fallbackError) {
      console.error('❌ Fallback query also failed:', fallbackError)
      setUsers([])
    }
  } finally {
    setLoading(false)
  }
}

  const filterUsers = () => {
    let filtered = [...users]

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(user => 
        user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.profession?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Status filters
    if (filters.verified !== 'all') {
      filtered = filtered.filter(user => 
        filters.verified === 'true' ? user.is_verified : !user.is_verified
      )
    }

    if (filters.admin !== 'all') {
      filtered = filtered.filter(user => 
        filters.admin === 'true' ? user.is_admin : !user.is_admin
      )
    }

    if (filters.subscription !== 'all') {
      filtered = filtered.filter(user => {
        const subscription = user.user_subscriptions?.[0]
        if (!subscription) return filters.subscription === 'free'
        return subscription.plan === filters.subscription
      })
    }

    setFilteredUsers(filtered)
  }

  const handleUserAction = async (action, user, data = {}) => {
    try {
      let updateData = {}
      let logMessage = ''

      switch (action) {
        case 'verify':
          updateData = { is_verified: !user.is_verified }
          logMessage = `${user.is_verified ? 'Unverified' : 'Verified'} user ${user.display_name}`
          break
        case 'admin':
          updateData = { is_admin: !user.is_admin }
          logMessage = `${user.is_admin ? 'Removed admin from' : 'Made admin'} ${user.display_name}`
          break
        case 'ban':
          // For banning, we'll update a status field (you might need to add this to schema)
          updateData = { is_banned: true }
          logMessage = `Banned user ${user.display_name}`
          break
        case 'premium':
          updateData = { is_premium: !user.is_premium }
          logMessage = `${user.is_premium ? 'Removed premium from' : 'Granted premium to'} ${user.display_name}`
          break
      }

      const { error } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .eq('id', user.id)

      if (error) throw error

      // Log the action
      await logAction(action, 'user', user.id, { 
        user_name: user.display_name,
        ...data 
      })

      // Reload users
      await loadUsers()

      setConfirmAction(null)
      alert(`${logMessage} successfully!`)
    } catch (error) {
      console.error('Error performing action:', error)
      alert('Error performing action')
    }
  }

  const handleDeleteUser = async (user) => {
    try {
      // Delete user's content first
      await supabaseAdmin.from('streams').delete().eq('user_id', user.id)
      await supabaseAdmin.from('photos').delete().eq('user_id', user.id)
      await supabaseAdmin.from('stories').delete().eq('user_id', user.id)
      
      // Delete the profile
      await supabaseAdmin.from('profiles').delete().eq('id', user.id)
      
      // Delete from auth (this requires service role)
      await supabaseAdmin.auth.admin.deleteUser(user.id)

      await logAction('delete', 'user', user.id, { 
        user_name: user.display_name 
      })

      await loadUsers()
      setConfirmAction(null)
      alert('User deleted successfully!')
    } catch (error) {
      console.error('Error deleting user:', error)
      alert('Error deleting user')
    }
  }

  const handleBulkAction = async (action, selectedUserIds) => {
    try {
      let updateData = {}
      
      switch (action) {
        case 'verify':
          updateData = { is_verified: true }
          break
        case 'unverify':
          updateData = { is_verified: false }
          break
        case 'premium':
          updateData = { is_premium: true }
          break
        case 'unpremium':
          updateData = { is_premium: false }
          break
      }

      const { error } = await supabaseAdmin
        .from('profiles')
        .update(updateData)
        .in('id', selectedUserIds)

      if (error) throw error

      await logAction('bulk_' + action, 'user', null, { 
        count: selectedUserIds.length,
        user_ids: selectedUserIds
      })

      await loadUsers()
      alert(`Bulk action completed for ${selectedUserIds.length} users!`)
    } catch (error) {
      console.error('Error performing bulk action:', error)
      alert('Error performing bulk action')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-gray-400">Manage users, permissions, and subscriptions</p>
        </div>
        
        <button
          onClick={loadUsers}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Verified</label>
            <select
              value={filters.verified}
              onChange={(e) => setFilters({ ...filters, verified: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="true">Verified</option>
              <option value="false">Not Verified</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Admin</label>
            <select
              value={filters.admin}
              onChange={(e) => setFilters({ ...filters, admin: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All</option>
              <option value="true">Admin</option>
              <option value="false">Regular User</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Subscription</label>
            <select
              value={filters.subscription}
              onChange={(e) => setFilters({ ...filters, subscription: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Plans</option>
              <option value="free">Free</option>
              <option value="basic">Basic</option>
              <option value="premium">Premium</option>
              <option value="vip">VIP</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              onClick={() => {
                setSearchTerm('')
                setFilters({
                  status: 'all',
                  subscription: 'all',
                  verified: 'all',
                  admin: 'all'
                })
              }}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
            >
              Clear Filters
            </button>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Total Users</div>
          <div className="text-white text-xl font-bold">{users.length}</div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Verified Users</div>
          <div className="text-white text-xl font-bold">
            {users.filter(u => u.is_verified).length}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Premium Users</div>
          <div className="text-white text-xl font-bold">
            {users.filter(u => u.is_premium).length}
          </div>
        </div>
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Admin Users</div>
          <div className="text-white text-xl font-bold">
            {users.filter(u => u.is_admin).length}
          </div>
        </div>
      </div>

      {/* User Table */}
      <UserTable
        users={filteredUsers}
        loading={loading}
        onViewUser={(user) => {
          setSelectedUser(user)
          setShowUserModal(true)
        }}
        onUserAction={(action, user) => {
          if (action === 'delete') {
            setConfirmAction({
              type: 'delete',
              user,
              title: 'Delete User',
              message: `Are you sure you want to delete ${user.display_name}? This action cannot be undone and will remove all their content.`,
              confirmText: 'Delete',
              onConfirm: () => handleDeleteUser(user)
            })
          } else {
            setConfirmAction({
              type: action,
              user,
              title: `${action.charAt(0).toUpperCase() + action.slice(1)} User`,
              message: `Are you sure you want to ${action} ${user.display_name}?`,
              confirmText: action.charAt(0).toUpperCase() + action.slice(1),
              onConfirm: () => handleUserAction(action, user)
            })
          }
        }}
        onBulkAction={handleBulkAction}
      />

      {/* User Details Modal */}
      {showUserModal && selectedUser && (
        <UserModal
          user={selectedUser}
          onClose={() => {
            setShowUserModal(false)
            setSelectedUser(null)
          }}
          onUserAction={(action, user, data) => {
            setShowUserModal(false)
            handleUserAction(action, user, data)
          }}
          onReload={loadUsers}
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

export default UserManagement