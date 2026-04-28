import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../utils/supabase'

const StatsCard = ({ title, value, icon, trend, loading }) => (
  <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-gray-400 text-sm">{title}</p>
        <p className="text-white text-2xl font-bold">
          {loading ? '...' : value?.toLocaleString() || '0'}
        </p>
        {trend && (
          <p className={`text-sm ${trend.positive ? 'text-green-400' : 'text-red-400'}`}>
            {trend.positive ? '↗' : '↘'} {trend.value}% from last month
          </p>
        )}
      </div>
      <div className="text-blue-400">
        {icon}
      </div>
    </div>
  </div>
)

const Dashboard = () => {
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [recentActivity, setRecentActivity] = useState([])

  useEffect(() => {
    loadDashboardData()
  }, [])

  const loadDashboardData = async () => {
    try {
      setLoading(true)

      // Get user stats
      const { data: userStats } = await supabaseAdmin
        .from('profiles')
        .select('id, created_at, is_premium')

      // Get stream stats
      const { data: streamStats } = await supabaseAdmin
        .from('streams')
        .select('id, status, created_at')

      // Get clinic stats
      const { data: clinicStats } = await supabaseAdmin
        .from('massage_clinics')
        .select('id, status, created_at')

      // Get subscription stats
      const { data: subscriptionStats } = await supabaseAdmin
        .from('user_subscriptions')
        .select('id, plan, status')

      // Pending approvals
      const { data: pendingStreams } = await supabaseAdmin
        .from('streams')
        .select('id, user_id, created_at, profiles(display_name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10)

      const { data: pendingClinics } = await supabaseAdmin
        .from('massage_clinics')
        .select('id, name, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(10)

      setStats({
        totalUsers: userStats?.length || 0,
        premiumUsers: userStats?.filter(u => u.is_premium)?.length || 0,
        totalStreams: streamStats?.length || 0,
        pendingStreams: streamStats?.filter(s => s.status === 'pending')?.length || 0,
        totalClinics: clinicStats?.length || 0,
        pendingClinics: clinicStats?.filter(c => c.status === 'pending')?.length || 0,
        activeSubscriptions: subscriptionStats?.filter(s => s.status === 'active')?.length || 0
      })

      setRecentActivity([
        ...pendingStreams?.map(s => ({
          type: 'stream',
          id: s.id,
          title: `New stream from ${s.profiles?.display_name || 'Unknown'}`,
          time: s.created_at
        })) || [],
        ...pendingClinics?.map(c => ({
          type: 'clinic',
          id: c.id,
          title: `New clinic: ${c.name}`,
          time: c.created_at
        })) || []
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 10))

    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diff = now - time
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400">Welcome to the admin panel</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Users"
          value={stats.totalUsers}
          loading={loading}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
            </svg>
          }
        />

        <StatsCard
          title="Premium Users"
          value={stats.premiumUsers}
          loading={loading}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          }
        />

        <StatsCard
          title="Pending Streams"
          value={stats.pendingStreams}
          loading={loading}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          }
        />

        <StatsCard
          title="Pending Clinics"
          value={stats.pendingClinics}
          loading={loading}
          icon={
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-gray-800 rounded-lg border border-gray-700">
        <div className="px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
          <p className="text-gray-400 text-sm">Latest submissions requiring attention</p>
        </div>

        <div className="divide-y divide-gray-700">
          {loading ? (
            <div className="px-6 py-4 text-center text-gray-400">Loading...</div>
          ) : recentActivity.length === 0 ? (
            <div className="px-6 py-4 text-center text-gray-400">No recent activity</div>
          ) : (
            recentActivity.map((item, index) => (
              <div key={index} className="px-6 py-4 hover:bg-gray-700/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${item.type === 'stream' ? 'bg-blue-400' : 'bg-green-400'}`} />
                    <span className="text-white">{item.title}</span>
                    <span className={`px-2 py-1 rounded-full text-xs ${item.type === 'stream' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>
                      {item.type}
                    </span>
                  </div>
                  <span className="text-gray-400 text-sm">{formatTimeAgo(item.time)}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {recentActivity.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-700">
            <button
              onClick={loadDashboardData}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              Refresh Data
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard