import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../utils/supabase'

const UserModal = ({ user, onClose, onUserAction, onReload }) => {
  const [activeTab, setActiveTab] = useState('details')
  const [userDetails, setUserDetails] = useState(null)
  const [loading, setLoading] = useState(true)
  const [newSubscription, setNewSubscription] = useState({
    plan: 'free',
    duration: '1' // months
  })

  useEffect(() => {
    loadUserDetails()
  }, [user.id])

  const loadUserDetails = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabaseAdmin
        .from('profiles')
        .select(`
          *,
          user_subscriptions (*),
          photos (*),
          streams (id, caption, status, created_at, views_count),
          massage_clinics (id, name, status, created_at),
          matches (count),
          messages (count),
          stories (count)
        `)
        .eq('id', user.id)
        .single()

      if (error) throw error
      setUserDetails(data)
    } catch (error) {
      console.error('Error loading user details:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscriptionUpdate = async () => {
    try {
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + parseInt(newSubscription.duration))

      const { error } = await supabaseAdmin
        .from('user_subscriptions')
        .insert({
          user_id: user.id,
          plan: newSubscription.plan,
          status: 'active',
          expires_at: expiresAt.toISOString(),
          granted_by_admin: true
        })

      if (error) throw error

      // Also update premium status
      await supabaseAdmin
        .from('profiles')
        .update({ is_premium: newSubscription.plan !== 'free' })
        .eq('id', user.id)

      await loadUserDetails()
      await onReload()
      alert('Subscription updated successfully!')
    } catch (error) {
      console.error('Error updating subscription:', error)
      alert('Error updating subscription')
    }
  }

  const handleDeleteContent = async (type, itemId) => {
    try {
      await supabaseAdmin
        .from(type === 'stream' ? 'streams' : 'massage_clinics')
        .delete()
        .eq('id', itemId)

      await loadUserDetails()
      alert(`${type} deleted successfully!`)
    } catch (error) {
      console.error(`Error deleting ${type}:`, error)
      alert(`Error deleting ${type}`)
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="text-white">Loading user details...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <img
              className="h-12 w-12 rounded-full object-cover"
              src={userDetails?.avatar_url || '/default-avatar.png'}
              alt={userDetails?.display_name || 'User'}
            />
            <div>
              <h2 className="text-xl font-bold text-white">
                {userDetails?.display_name || 'Unnamed User'}
              </h2>
              <p className="text-gray-400">
                Joined {new Date(userDetails?.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700">
          <nav className="flex space-x-8 px-6">
            {['details', 'content', 'subscription'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 max-h-96 overflow-y-auto">
          {activeTab === 'details' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Personal Info</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-400 text-sm">Display Name</label>
                      <p className="text-white">{userDetails?.display_name || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm">Bio</label>
                      <p className="text-white">{userDetails?.bio || 'No bio'}</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm">Age</label>
                      <p className="text-white">
                        {userDetails?.dob 
                          ? Math.floor((new Date() - new Date(userDetails.dob)) / 365.25 / 24 / 60 / 60 / 1000)
                          : 'Not set'
                        }
                      </p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm">Gender</label>
                      <p className="text-white">{userDetails?.gender || 'Not set'}</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Location & Work</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-gray-400 text-sm">City</label>
                      <p className="text-white">{userDetails?.city || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm">Profession</label>
                      <p className="text-white">{userDetails?.profession || 'Not set'}</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm">Coordinates</label>
                      <p className="text-white">
                        {userDetails?.lat && userDetails?.lng 
                          ? `${userDetails.lat}, ${userDetails.lng}`
                          : 'Not set'
                        }
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => onUserAction('verify', userDetails)}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      userDetails?.is_verified
                        ? 'bg-yellow-600 hover:bg-yellow-700'
                        : 'bg-green-600 hover:bg-green-700'
                    } text-white transition-colors`}
                  >
                    {userDetails?.is_verified ? 'Unverify' : 'Verify'} User
                  </button>
                  
                  <button
                    onClick={() => onUserAction('admin', userDetails)}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      userDetails?.is_admin
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-purple-600 hover:bg-purple-700'
                    } text-white transition-colors`}
                  >
                    {userDetails?.is_admin ? 'Remove Admin' : 'Make Admin'}
                  </button>
                  
                  <button
                    onClick={() => onUserAction('premium', userDetails)}
                    className={`px-4 py-2 rounded-md text-sm font-medium ${
                      userDetails?.is_premium
                        ? 'bg-gray-600 hover:bg-gray-700'
                        : 'bg-yellow-600 hover:bg-yellow-700'
                    } text-white transition-colors`}
                  >
                    {userDetails?.is_premium ? 'Remove Premium' : 'Grant Premium'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Streams ({userDetails?.streams?.length || 0})</h3>
                <div className="space-y-2">
                  {userDetails?.streams?.map((stream) => (
                    <div key={stream.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                      <div>
                        <p className="text-white">{stream.caption || 'No caption'}</p>
                        <p className="text-gray-400 text-sm">
                          {stream.status} • {stream.views_count} views • {new Date(stream.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteContent('stream', stream.id)}
                        className="text-red-400 hover:text-red-300 p-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {(!userDetails?.streams || userDetails.streams.length === 0) && (
                    <p className="text-gray-400">No streams found</p>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Clinics ({userDetails?.massage_clinics?.length || 0})</h3>
                <div className="space-y-2">
                  {userDetails?.massage_clinics?.map((clinic) => (
                    <div key={clinic.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                      <div>
                        <p className="text-white">{clinic.name}</p>
                        <p className="text-gray-400 text-sm">
                          {clinic.status} • {new Date(clinic.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteContent('clinic', clinic.id)}
                        className="text-red-400 hover:text-red-300 p-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                  {(!userDetails?.massage_clinics || userDetails.massage_clinics.length === 0) && (
                    <p className="text-gray-400">No clinics found</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Current Subscription</h3>
                {userDetails?.user_subscriptions?.length > 0 ? (
                  <div className="space-y-2">
                    {userDetails.user_subscriptions.map((sub) => (
                      <div key={sub.id} className="p-3 bg-gray-700 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-white font-medium capitalize">{sub.plan} Plan</p>
                            <p className="text-gray-400 text-sm">
                              Status: {sub.status} • 
                              {sub.expires_at ? ` Expires: ${new Date(sub.expires_at).toLocaleDateString()}` : ' No expiration'}
                              {sub.granted_by_admin && ' (Admin Granted)'}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No active subscriptions</p>
                )}
              </div>

              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Grant New Subscription</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-gray-300 text-sm mb-2">Plan</label>
                    <select
                      value={newSubscription.plan}
                      onChange={(e) => setNewSubscription({...newSubscription, plan: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="free">Free</option>
                      <option value="basic">Basic</option>
                      <option value="premium">Premium</option>
                      <option value="vip">VIP</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-gray-300 text-sm mb-2">Duration (months)</label>
                    <select
                      value={newSubscription.duration}
                      onChange={(e) => setNewSubscription({...newSubscription, duration: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1">1 Month</option>
                      <option value="3">3 Months</option>
                      <option value="6">6 Months</option>
                      <option value="12">12 Months</option>
                    </select>
                  </div>
                  
                  <button
                    onClick={handleSubscriptionUpdate}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                  >
                    Grant Subscription
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserModal