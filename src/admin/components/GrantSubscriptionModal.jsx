import { useState } from 'react'

const GrantSubscriptionModal = ({ users, onClose, onGrant }) => {
  const [selectedUser, setSelectedUser] = useState('')
  const [plan, setPlan] = useState('basic')
  const [duration, setDuration] = useState('1')
  const [searchTerm, setSearchTerm] = useState('')

  const filteredUsers = users.filter(user => 
    user.display_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.city?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!selectedUser) {
      alert('Please select a user')
      return
    }

    onGrant({
      userId: selectedUser,
      plan,
      duration: parseInt(duration)
    })
  }

  const planOptions = [
    { value: 'free', label: 'Free', description: 'Basic features only' },
    { value: 'basic', label: 'Basic', description: 'Standard features + limited premium' },
    { value: 'premium', label: 'Premium', description: 'All features + priority support' },
    { value: 'vip', label: 'VIP', description: 'Everything + exclusive features' }
  ]

  const durationOptions = [
    { value: '1', label: '1 Month' },
    { value: '3', label: '3 Months' },
    { value: '6', label: '6 Months' },
    { value: '12', label: '12 Months' },
    { value: '24', label: '24 Months' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-white">Grant Subscription</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Select User
            </label>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Search users by name or city..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              
              <div className="max-h-48 overflow-y-auto border border-gray-600 rounded-md bg-gray-700">
                {filteredUsers.length === 0 ? (
                  <div className="p-4 text-center text-gray-400">
                    {searchTerm ? 'No users found matching your search' : 'No users available'}
                  </div>
                ) : (
                  filteredUsers.map(user => (
                    <label
                      key={user.id}
                      className="flex items-center p-3 hover:bg-gray-600 cursor-pointer border-b border-gray-600 last:border-b-0"
                    >
                      <input
                        type="radio"
                        name="user"
                        value={user.id}
                        checked={selectedUser === user.id}
                        onChange={(e) => setSelectedUser(e.target.value)}
                        className="mr-3"
                      />
                      <img
                        className="w-8 h-8 rounded-full object-cover mr-3"
                        src={user.avatar_url || '/default-avatar.png'}
                        alt={user.display_name}
                      />
                      <div>
                        <div className="text-white font-medium">
                          {user.display_name || 'Unnamed User'}
                        </div>
                        <div className="text-gray-400 text-sm">
                          {user.city || 'No location'}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Plan Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Subscription Plan
            </label>
            <div className="space-y-2">
              {planOptions.map(option => (
                <label
                  key={option.value}
                  className="flex items-start p-3 border border-gray-600 rounded-md hover:border-blue-500 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="plan"
                    value={option.value}
                    checked={plan === option.value}
                    onChange={(e) => setPlan(e.target.value)}
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="text-white font-medium capitalize">
                      {option.label}
                    </div>
                    <div className="text-gray-400 text-sm">
                      {option.description}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Duration Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Duration
            </label>
            <select
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {durationOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Summary */}
          {selectedUser && (
            <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
              <h3 className="text-blue-300 font-medium mb-2">Summary</h3>
              <div className="text-gray-300 space-y-1">
                <div>
                  <strong>User:</strong> {filteredUsers.find(u => u.id === selectedUser)?.display_name || 'Unknown'}
                </div>
                <div>
                  <strong>Plan:</strong> {plan.toUpperCase()}
                </div>
                <div>
                  <strong>Duration:</strong> {durationOptions.find(d => d.value === duration)?.label}
                </div>
                <div>
                  <strong>Expires:</strong> {
                    new Date(Date.now() + parseInt(duration) * 30 * 24 * 60 * 60 * 1000)
                      .toLocaleDateString()
                  }
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-600 text-gray-300 rounded-md hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!selectedUser}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Grant Subscription
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default GrantSubscriptionModal