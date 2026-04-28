import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../utils/supabase'

const UserModal = ({ user, onClose, onUserAction, onReload }) => {
  const [activeTab, setActiveTab] = useState('details')
  const [userDetails, setUserDetails] = useState(user)
  const [loading, setLoading] = useState(false)
  const [newSubscription, setNewSubscription] = useState({
    plan: 'basic',
    duration: '1'
  })

  useEffect(() => {
    if (user) {
      setUserDetails(user)
      if (!user.streams || !user.massage_clinics) {
        loadAdditionalUserData()
      }
    }
  }, [user])

  const loadAdditionalUserData = async () => {
    try {
      setLoading(true)
      
      // Get detailed stream data
      const { data: streams } = await supabaseAdmin
        .from('streams')
        .select('id, caption, status, created_at, views_count')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      // Get detailed clinic data
      const { data: clinics } = await supabaseAdmin
        .from('massage_clinics')
        .select('id, name, status, created_at, rating, review_count')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      setUserDetails({
        ...user,
        detailedStreams: streams || [],
        detailedClinics: clinics || []
      })
    } catch (error) {
      console.error('Error loading additional user data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubscriptionUpdate = async () => {
    try {
      const expiresAt = new Date()
      expiresAt.setMonth(expiresAt.getMonth() + parseInt(newSubscription.duration))

      // Cancel existing active subscriptions
      await supabaseAdmin
        .from('user_subscriptions')
        .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('status', 'active')

      // Create new subscription
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

      // Update premium status in profiles
      await supabaseAdmin
        .from('profiles')
        .update({ is_premium: newSubscription.plan !== 'free' })
        .eq('id', user.id)

      await onReload()
      alert('Subscription updated successfully!')
    } catch (error) {
      console.error('Error updating subscription:', error)
      alert('Error updating subscription')
    }
  }

  const handleDeleteContent = async (type, itemId) => {
    try {
      const table = type === 'stream' ? 'streams' : 'massage_clinics'
      await supabaseAdmin.from(table).delete().eq('id', itemId)
      await loadAdditionalUserData()
      alert(`${type} deleted successfully!`)
    } catch (error) {
      console.error(`Error deleting ${type}:`, error)
      alert(`Error deleting ${type}`)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return 'Not set'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getAge = (dob) => {
    if (!dob) return 'Not set'
    const today = new Date()
    const birthDate = new Date(dob)
    const age = today.getFullYear() - birthDate.getFullYear()
    const monthDiff = today.getMonth() - birthDate.getMonth()
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      return age - 1
    }
    return age
  }

  const getActiveSubscription = () => {
    return userDetails?.user_subscriptions?.find(sub => sub.status === 'active')
  }

  if (!userDetails) {
    return null
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <img
                className="h-16 w-16 rounded-full object-cover border-2 border-gray-600"
                src={userDetails.avatar_url || '/default-avatar.png'}
                alt={userDetails.display_name || 'User'}
                onError={(e) => { e.target.src = '/default-avatar.png' }}
              />
              {userDetails.is_verified && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <div className="space-y-1">
              <div className="flex items-center space-x-3">
                <h2 className="text-xl font-bold text-white">
                  {userDetails.display_name || 'No Name'}
                </h2>
                <div className="flex space-x-2">
                  {userDetails.is_admin && (
                    <span className="px-2 py-1 bg-red-900 text-red-300 text-xs rounded-full">Admin</span>
                  )}
                  {userDetails.is_premium && (
                    <span className="px-2 py-1 bg-yellow-900 text-yellow-300 text-xs rounded-full">Premium</span>
                  )}
                  {userDetails.is_verified && (
                    <span className="px-2 py-1 bg-blue-900 text-blue-300 text-xs rounded-full">Verified</span>
                  )}
                </div>
              </div>
              <p className="text-gray-400 text-sm">
                {userDetails.email} • Joined {formatDate(userDetails.created_at)}
              </p>
              <p className="text-gray-400 text-sm">
                Profile: {userDetails.profile_complete ? 'Complete' : 'Incomplete'}
              </p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
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
                className={`py-4 px-1 border-b-2 font-medium text-sm capitalize transition-colors ${
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
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-6">
          {activeTab === 'details' && (
            <div className="space-y-8">
              {/* Personal Information */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">
                    Personal Information
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-400 text-sm font-medium">Full Name</label>
                      <p className="text-white mt-1">{userDetails.display_name || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm font-medium">Email</label>
                      <p className="text-white mt-1">{userDetails.email}</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm font-medium">Age</label>
                      <p className="text-white mt-1">{getAge(userDetails.dob)} years old</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm font-medium">Gender</label>
                      <p className="text-white mt-1 capitalize">{userDetails.gender || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm font-medium">Bio</label>
                      <p className="text-white mt-1">{userDetails.bio || 'No bio provided'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">
                    Location & Work
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-gray-400 text-sm font-medium">City</label>
                      <p className="text-white mt-1">{userDetails.city || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm font-medium">Profession</label>
                      <p className="text-white mt-1">{userDetails.profession || 'Not provided'}</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm font-medium">Last Sign In</label>
                      <p className="text-white mt-1">{formatDate(userDetails.last_sign_in_at)}</p>
                    </div>
                    <div>
                      <label className="text-gray-400 text-sm font-medium">Profile Updated</label>
                      <p className="text-white mt-1">{formatDate(userDetails.updated_at)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">
                  Quick Actions
                </h3>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => onUserAction('verify', userDetails)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      userDetails.is_verified
                        ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {userDetails.is_verified ? 'Remove Verification' : 'Verify User'}
                  </button>
                  
                  <button
                    onClick={() => onUserAction('admin', userDetails)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      userDetails.is_admin
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                  >
                    {userDetails.is_admin ? 'Remove Admin' : 'Make Admin'}
                  </button>
                  
                  <button
                    onClick={() => onUserAction('premium', userDetails)}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      userDetails.is_premium
                        ? 'bg-gray-600 hover:bg-gray-700 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {userDetails.is_premium ? 'Remove Premium' : 'Grant Premium'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'content' && (
            <div className="space-y-8">
              {/* Photos */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">
                  Photos ({userDetails.photos?.length || 0})
                </h3>
                {userDetails.photos && userDetails.photos.length > 0 ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {userDetails.photos.map((photo) => (
                      <div key={photo.id} className="relative">
                        <img
                          src={photo.path}
                          alt="User photo"
                          className="w-full h-24 object-cover rounded-lg"
                          onError={(e) => { e.target.src = '/default-avatar.png' }}
                        />
                        {photo.is_primary && (
                          <div className="absolute top-1 right-1 bg-blue-500 text-white text-xs px-1 rounded">
                            Primary
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No photos uploaded</p>
                )}
              </div>

              {/* Streams */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">
                  Streams ({userDetails.detailedStreams?.length || userDetails.streams?.[0]?.count || 0})
                </h3>
                {userDetails.detailedStreams && userDetails.detailedStreams.length > 0 ? (
                  <div className="space-y-3">
                    {userDetails.detailedStreams.map((stream) => (
                      <div key={stream.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                        <div className="flex-1">
                          <p className="text-white font-medium">{stream.caption || 'No caption'}</p>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-400">
                            <span>Status: {stream.status}</span>
                            <span>Views: {stream.views_count || 0}</span>
                            <span>Created: {formatDate(stream.created_at)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteContent('stream', stream.id)}
                          className="text-red-400 hover:text-red-300 p-2 rounded transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No streams created</p>
                )}
              </div>

              {/* Massage Clinics */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">
                  Massage Clinics ({userDetails.detailedClinics?.length || userDetails.massage_clinics?.[0]?.count || 0})
                </h3>
                {userDetails.detailedClinics && userDetails.detailedClinics.length > 0 ? (
                  <div className="space-y-3">
                    {userDetails.detailedClinics.map((clinic) => (
                      <div key={clinic.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                        <div className="flex-1">
                          <p className="text-white font-medium">{clinic.name}</p>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-400">
                            <span>Status: {clinic.status}</span>
                            <span>Rating: {clinic.rating || 0}/5</span>
                            <span>Reviews: {clinic.review_count || 0}</span>
                            <span>Created: {formatDate(clinic.created_at)}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteContent('clinic', clinic.id)}
                          className="text-red-400 hover:text-red-300 p-2 rounded transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No massage clinics created</p>
                )}
              </div>
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="space-y-8">
              {/* Current Subscriptions */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">
                  Current Subscriptions
                </h3>
                {userDetails.user_subscriptions && userDetails.user_subscriptions.length > 0 ? (
                  <div className="space-y-3">
                    {userDetails.user_subscriptions.map((sub) => (
                      <div key={sub.id} className="p-4 bg-gray-700 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <h4 className="text-white font-medium capitalize">{sub.plan} Plan</h4>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                sub.status === 'active' ? 'bg-green-900 text-green-300' :
                                sub.status === 'expired' ? 'bg-red-900 text-red-300' :
                                'bg-gray-900 text-gray-300'
                              }`}>
                                {sub.status}
                              </span>
                              {sub.granted_by_admin && (
                                <span className="px-2 py-1 bg-blue-900 text-blue-300 rounded-full text-xs">
                                  Admin Granted
                                </span>
                              )}
                            </div>
                            <div className="text-sm text-gray-400 space-y-1">
                              <p>Started: {formatDate(sub.created_at)}</p>
                              {sub.expires_at && <p>Expires: {formatDate(sub.expires_at)}</p>}
                              {sub.cancelled_at && <p>Cancelled: {formatDate(sub.cancelled_at)}</p>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-400">No subscriptions found</p>
                )}
              </div>

              {/* Grant New Subscription */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-white border-b border-gray-600 pb-2">
                  Grant New Subscription
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 text-sm font-medium mb-2">Plan</label>
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
                    <label className="block text-gray-300 text-sm font-medium mb-2">Duration</label>
                    <select
                      value={newSubscription.duration}
                      onChange={(e) => setNewSubscription({...newSubscription, duration: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1">1 Month</option>
                      <option value="3">3 Months</option>
                      <option value="6">6 Months</option>
                      <option value="12">12 Months</option>
                      <option value="24">24 Months</option>
                    </select>
                  </div>
                </div>
                
                <button
                  onClick={handleSubscriptionUpdate}
                  disabled={loading}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md font-medium transition-colors disabled:opacity-50"
                >
                  {loading ? 'Processing...' : 'Grant Subscription'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default UserModal