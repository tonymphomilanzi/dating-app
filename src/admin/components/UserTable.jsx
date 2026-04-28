import { useState } from 'react'

const UserTable = ({ users, loading, onViewUser, onUserAction, onBulkAction }) => {
  const [selectedUsers, setSelectedUsers] = useState(new Set())
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' })

  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedUsers(new Set(users.map(u => u.id)))
    } else {
      setSelectedUsers(new Set())
    }
  }

  const handleSelectUser = (userId, checked) => {
    const newSelected = new Set(selectedUsers)
    if (checked) {
      newSelected.add(userId)
    } else {
      newSelected.delete(userId)
    }
    setSelectedUsers(newSelected)
  }

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    setSortConfig({ key, direction })
  }

  const sortedUsers = [...users].sort((a, b) => {
    if (sortConfig.key === 'created_at') {
      return sortConfig.direction === 'asc' 
        ? new Date(a.created_at) - new Date(b.created_at)
        : new Date(b.created_at) - new Date(a.created_at)
    }
    
    const aValue = a[sortConfig.key] || ''
    const bValue = b[sortConfig.key] || ''
    
    if (sortConfig.direction === 'asc') {
      return aValue.toString().localeCompare(bValue.toString())
    }
    return bValue.toString().localeCompare(aValue.toString())
  })

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getSubscriptionPlan = (user) => {
    const subscription = user.user_subscriptions?.[0]
    if (!subscription || subscription.status !== 'active') return 'Free'
    return subscription.plan.charAt(0).toUpperCase() + subscription.plan.slice(1)
  }

  const getStatusBadges = (user) => {
    const badges = []
    
    if (user.is_admin) {
      badges.push({ text: 'Admin', color: 'bg-red-900 text-red-300' })
    }
    
    if (user.is_verified) {
      badges.push({ text: 'Verified', color: 'bg-green-900 text-green-300' })
    }
    
    if (user.is_premium) {
      badges.push({ text: 'Premium', color: 'bg-yellow-900 text-yellow-300' })
    }

    return badges
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
        <div className="text-center text-gray-400">Loading users...</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Bulk Actions */}
      {selectedUsers.size > 0 && (
        <div className="px-6 py-3 bg-gray-700 border-b border-gray-600">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">
              {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => onBulkAction('verify', Array.from(selectedUsers))}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
              >
                Verify
              </button>
              <button
                onClick={() => onBulkAction('unverify', Array.from(selectedUsers))}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
              >
                Unverify
              </button>
              <button
                onClick={() => onBulkAction('premium', Array.from(selectedUsers))}
                className="px-3 py-1 bg-yellow-600 hover:bg-yellow-700 text-white text-sm rounded transition-colors"
              >
                Grant Premium
              </button>
              <button
                onClick={() => setSelectedUsers(new Set())}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-750">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedUsers.size === users.length && users.length > 0}
                  onChange={(e) => handleSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('display_name')}
              >
                User
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('created_at')}
              >
                Joined
              </th>
              
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Status
              </th>
              
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Subscription
              </th>
              
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Content
              </th>
              
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {sortedUsers.map((user) => {
              const statusBadges = getStatusBadges(user)
              const streamCount = user.streams?.[0]?.count || 0
              const clinicCount = user.massage_clinics?.[0]?.count || 0
              
              return (
                <tr key={user.id} className="hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={selectedUsers.has(user.id)}
                      onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <img
                          className="h-10 w-10 rounded-full object-cover"
                          src={user.avatar_url || '/default-avatar.png'}
                          alt={user.display_name || 'User'}
                          onError={(e) => {
                            e.target.src = '/default-avatar.png'
                          }}
                        />
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-white">
                          {user.display_name || 'No name'}
                        </div>
                        <div className="text-sm text-gray-400">
                          {user.city || 'No location'} • {user.profession || 'No profession'}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {formatDate(user.created_at)}
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {statusBadges.map((badge, index) => (
                        <span
                          key={index}
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badge.color}`}
                        >
                          {badge.text}
                        </span>
                      ))}
                      {statusBadges.length === 0 && (
                        <span className="text-gray-400 text-sm">Regular User</span>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {getSubscriptionPlan(user)}
                  </td>
                  
                  <td className="px-6 py-4 text-sm text-gray-300">
                    <div className="flex space-x-4">
                      <span>{streamCount} streams</span>
                      <span>{clinicCount} clinics</span>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onViewUser(user)}
                        className="text-blue-400 hover:text-blue-300"
                        title="View Details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => onUserAction('verify', user)}
                        className={`${user.is_verified ? 'text-yellow-400 hover:text-yellow-300' : 'text-green-400 hover:text-green-300'}`}
                        title={user.is_verified ? 'Unverify' : 'Verify'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => onUserAction('admin', user)}
                        className={`${user.is_admin ? 'text-red-400 hover:text-red-300' : 'text-purple-400 hover:text-purple-300'}`}
                        title={user.is_admin ? 'Remove Admin' : 'Make Admin'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => onUserAction('delete', user)}
                        className="text-red-400 hover:text-red-300"
                        title="Delete User"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        
        {sortedUsers.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No users found matching your criteria
          </div>
        )}
      </div>
    </div>
  )
}

export default UserTable