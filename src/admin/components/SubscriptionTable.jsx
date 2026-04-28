import { useState } from 'react'

const SubscriptionTable = ({ 
  subscriptions, 
  loading, 
  bulkSelected, 
  onSelectSubscription, 
  onSelectAll, 
  onSubscriptionAction 
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' })
  const [extendDuration, setExtendDuration] = useState({})

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    setSortConfig({ key, direction })
  }

  const sortedSubscriptions = [...subscriptions].sort((a, b) => {
    if (sortConfig.key === 'created_at' || sortConfig.key === 'expires_at') {
      const aDate = new Date(a[sortConfig.key] || 0)
      const bDate = new Date(b[sortConfig.key] || 0)
      return sortConfig.direction === 'asc' ? aDate - bDate : bDate - aDate
    }
    
    const aValue = a[sortConfig.key] || ''
    const bValue = b[sortConfig.key] || ''
    
    if (sortConfig.direction === 'asc') {
      return aValue.toString().localeCompare(bValue.toString())
    }
    return bValue.toString().localeCompare(aValue.toString())
  })

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-900 text-green-300'
      case 'expired': return 'bg-red-900 text-red-300'
      case 'cancelled': return 'bg-gray-900 text-gray-300'
      case 'trial': return 'bg-blue-900 text-blue-300'
      default: return 'bg-gray-900 text-gray-300'
    }
  }

  const getPlanColor = (plan) => {
    switch (plan) {
      case 'free': return 'bg-gray-900 text-gray-300'
      case 'basic': return 'bg-blue-900 text-blue-300'
      case 'premium': return 'bg-purple-900 text-purple-300'
      case 'vip': return 'bg-yellow-900 text-yellow-300'
      default: return 'bg-gray-900 text-gray-300'
    }
  }

  const getDaysUntilExpiry = (expiryDate) => {
    if (!expiryDate) return null
    const now = new Date()
    const expiry = new Date(expiryDate)
    const diffTime = expiry - now
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  const handleExtendSubmit = (subscription, e) => {
    e.preventDefault()
    const months = extendDuration[subscription.id] || 1
    onSubscriptionAction('extend', subscription, { months: parseInt(months) })
    setExtendDuration({ ...extendDuration, [subscription.id]: '' })
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
        <div className="text-center text-gray-400">Loading subscriptions...</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-750">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={bulkSelected.size === subscriptions.length && subscriptions.length > 0}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('profiles.display_name')}
              >
                User
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('plan')}
              >
                Plan
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('status')}
              >
                Status
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('created_at')}
              >
                Started
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('expires_at')}
              >
                Expires
              </th>
              
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Admin Grant
              </th>
              
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {sortedSubscriptions.map((subscription) => {
              const daysUntilExpiry = getDaysUntilExpiry(subscription.expires_at)
              const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 7 && daysUntilExpiry > 0
              const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0
              
              return (
                <tr key={subscription.id} className="hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={bulkSelected.has(subscription.id)}
                      onChange={(e) => onSelectSubscription(subscription.id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img
                        className="w-8 h-8 rounded-full object-cover"
                        src={subscription.profiles?.avatar_url || '/default-avatar.png'}
                        alt={subscription.profiles?.display_name || 'User'}
                      />
                      <div>
                        <div className="text-sm font-medium text-white">
                          {subscription.profiles?.display_name || 'Unknown User'}
                        </div>
                        <div className="text-sm text-gray-400">
                          {subscription.profiles?.city || 'No location'}
                        </div>
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPlanColor(subscription.plan)}`}>
                      {subscription.plan.toUpperCase()}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(subscription.status)}`}>
                      {subscription.status}
                    </span>
                  </td>
                  
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {formatDate(subscription.created_at)}
                  </td>
                  
                  <td className="px-6 py-4 text-sm">
                    <div className="space-y-1">
                      <div className={`${isExpiringSoon ? 'text-yellow-400' : isExpired ? 'text-red-400' : 'text-gray-300'}`}>
                        {formatDate(subscription.expires_at)}
                      </div>
                      {daysUntilExpiry !== null && (
                        <div className="text-xs text-gray-500">
                          {daysUntilExpiry > 0 ? `${daysUntilExpiry} days left` : 
                           daysUntilExpiry === 0 ? 'Expires today' : 
                           `Expired ${Math.abs(daysUntilExpiry)} days ago`}
                        </div>
                      )}
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    {subscription.granted_by_admin ? (
                      <span className="inline-flex items-center text-xs text-blue-400">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Admin Grant
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">User Purchase</span>
                    )}
                  </td>
                  
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end items-center space-x-2">
                      {subscription.status === 'active' && (
                        <>
                          {/* Extend Subscription */}
                          <form onSubmit={(e) => handleExtendSubmit(subscription, e)} className="flex items-center space-x-1">
                            <input
                              type="number"
                              min="1"
                              max="12"
                              placeholder="Months"
                              value={extendDuration[subscription.id] || ''}
                              onChange={(e) => setExtendDuration({
                                ...extendDuration,
                                [subscription.id]: e.target.value
                              })}
                              className="w-16 px-2 py-1 text-xs border border-gray-600 rounded bg-gray-700 text-white"
                            />
                            <button
                              type="submit"
                              disabled={!extendDuration[subscription.id]}
                              className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors disabled:opacity-50"
                            >
                              Extend
                            </button>
                          </form>
                          
                          <button
                            onClick={() => onSubscriptionAction('cancel', subscription)}
                            className="text-red-400 hover:text-red-300"
                            title="Cancel Subscription"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      )}
                      
                      {subscription.status === 'cancelled' && (
                        <button
                          onClick={() => onSubscriptionAction('activate', subscription)}
                          className="text-green-400 hover:text-green-300"
                          title="Reactivate Subscription"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      
                      {subscription.status === 'expired' && (
                        <button
                          onClick={() => onSubscriptionAction('activate', subscription)}
                          className="text-green-400 hover:text-green-300"
                          title="Reactivate Subscription"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      
                      <button
                        onClick={() => onSubscriptionAction('delete', subscription)}
                        className="text-red-400 hover:text-red-300"
                        title="Delete Subscription"
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
        
        {sortedSubscriptions.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No subscriptions found matching your criteria
          </div>
        )}
      </div>
    </div>
  )
}

export default SubscriptionTable