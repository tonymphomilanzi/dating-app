import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'
import StreamCard from '../components/StreamCard'
import StreamPreviewModal from '../components/StreamPreviewModal'
import ConfirmModal from '../components/ConfirmModal'

const StreamManagement = () => {
  const { logAction } = useAuth()
  const [streams, setStreams] = useState([])
  const [filteredStreams, setFilteredStreams] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: 'pending',
    search: '',
    dateRange: 'all'
  })
  const [selectedStream, setSelectedStream] = useState(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [bulkSelected, setBulkSelected] = useState(new Set())

  useEffect(() => {
    loadStreams()
  }, [])

  useEffect(() => {
    filterStreams()
  }, [streams, filters])

  const loadStreams = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabaseAdmin
        .from('streams')
        .select(`
          *,
          profiles (
            id,
            display_name,
            avatar_url,
            is_verified,
            is_premium
          ),
          stream_likes (count),
          stream_comments (count),
          stream_shares (count)
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setStreams(data || [])
    } catch (error) {
      console.error('Error loading streams:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterStreams = () => {
    let filtered = [...streams]

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(stream => stream.status === filters.status)
    }

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(stream => 
        stream.caption?.toLowerCase().includes(filters.search.toLowerCase()) ||
        stream.profiles?.display_name?.toLowerCase().includes(filters.search.toLowerCase())
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
        filtered = filtered.filter(stream => new Date(stream.created_at) >= cutoff)
      }
    }

    setFilteredStreams(filtered)
  }

  const handleStreamAction = async (action, stream, reason = '') => {
    try {
      let updateData = {}
      let logMessage = ''

      switch (action) {
        case 'approve':
          updateData = { 
            status: 'approved', 
            approved_at: new Date().toISOString() 
          }
          logMessage = `Approved stream by ${stream.profiles?.display_name}`
          break
        case 'reject':
          updateData = { 
            status: 'rejected', 
            rejected_at: new Date().toISOString() 
          }
          logMessage = `Rejected stream by ${stream.profiles?.display_name}`
          break
        case 'delete':
          // Delete the stream entirely
          const { error: deleteError } = await supabaseAdmin
            .from('streams')
            .delete()
            .eq('id', stream.id)

          if (deleteError) throw deleteError

          await logAction('delete', 'stream', stream.id, {
            user_name: stream.profiles?.display_name,
            reason
          })

          await loadStreams()
          setConfirmAction(null)
          alert('Stream deleted successfully!')
          return
        case 'feature':
          updateData = { is_featured: !stream.is_featured }
          logMessage = `${stream.is_featured ? 'Unfeatured' : 'Featured'} stream by ${stream.profiles?.display_name}`
          break
      }

      const { error } = await supabaseAdmin
        .from('streams')
        .update(updateData)
        .eq('id', stream.id)

      if (error) throw error

      await logAction(action, 'stream', stream.id, {
        user_name: stream.profiles?.display_name,
        reason
      })

      await loadStreams()
      setConfirmAction(null)
      alert(`${logMessage} successfully!`)
    } catch (error) {
      console.error('Error performing action:', error)
      alert('Error performing action')
    }
  }

  const handleBulkAction = async (action) => {
    try {
      if (bulkSelected.size === 0) {
        alert('No streams selected')
        return
      }

      let updateData = {}
      switch (action) {
        case 'approve':
          updateData = { status: 'approved', approved_at: new Date().toISOString() }
          break
        case 'reject':
          updateData = { status: 'rejected', rejected_at: new Date().toISOString() }
          break
        case 'delete':
          const { error } = await supabaseAdmin
            .from('streams')
            .delete()
            .in('id', Array.from(bulkSelected))

          if (error) throw error

          await logAction('bulk_delete', 'stream', null, {
            count: bulkSelected.size,
            stream_ids: Array.from(bulkSelected)
          })

          setBulkSelected(new Set())
          await loadStreams()
          alert(`${bulkSelected.size} streams deleted successfully!`)
          return
      }

      const { error } = await supabaseAdmin
        .from('streams')
        .update(updateData)
        .in('id', Array.from(bulkSelected))

      if (error) throw error

      await logAction(`bulk_${action}`, 'stream', null, {
        count: bulkSelected.size,
        stream_ids: Array.from(bulkSelected)
      })

      setBulkSelected(new Set())
      await loadStreams()
      alert(`Bulk ${action} completed for ${bulkSelected.size} streams!`)
    } catch (error) {
      console.error('Error performing bulk action:', error)
      alert('Error performing bulk action')
    }
  }

  const toggleSelectStream = (streamId) => {
    const newSelected = new Set(bulkSelected)
    if (newSelected.has(streamId)) {
      newSelected.delete(streamId)
    } else {
      newSelected.add(streamId)
    }
    setBulkSelected(newSelected)
  }

  const selectAllStreams = () => {
    if (bulkSelected.size === filteredStreams.length) {
      setBulkSelected(new Set())
    } else {
      setBulkSelected(new Set(filteredStreams.map(s => s.id)))
    }
  }

  const getStatusStats = () => {
    return {
      pending: streams.filter(s => s.status === 'pending').length,
      approved: streams.filter(s => s.status === 'approved').length,
      rejected: streams.filter(s => s.status === 'rejected').length,
      total: streams.length
    }
  }

  const stats = getStatusStats()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Stream Management</h1>
          <p className="text-gray-400">Review and manage user-submitted video streams</p>
        </div>
        
        <button
          onClick={loadStreams}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Total Streams</div>
          <div className="text-white text-xl font-bold">{stats.total}</div>
        </div>
        <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
          <div className="text-yellow-400 text-sm">Pending Review</div>
          <div className="text-white text-xl font-bold">{stats.pending}</div>
        </div>
        <div className="bg-green-900/20 border border-green-600 rounded-lg p-4">
          <div className="text-green-400 text-sm">Approved</div>
          <div className="text-white text-xl font-bold">{stats.approved}</div>
        </div>
        <div className="bg-red-900/20 border border-red-600 rounded-lg p-4">
          <div className="text-red-400 text-sm">Rejected</div>
          <div className="text-white text-xl font-bold">{stats.rejected}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
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
              placeholder="Search by caption or user..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: 'all', search: '', dateRange: 'all' })}
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
              {bulkSelected.size} stream{bulkSelected.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => handleBulkAction('approve')}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded transition-colors"
              >
                Approve All
              </button>
              <button
                onClick={() => handleBulkAction('reject')}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded transition-colors"
              >
                Reject All
              </button>
              <button
                onClick={() => handleBulkAction('delete')}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
              >
                Delete All
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

      {/* Stream Grid */}
      <div className="space-y-4">
        {!loading && filteredStreams.length > 0 && (
          <div className="flex items-center justify-between">
            <button
              onClick={selectAllStreams}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              {bulkSelected.size === filteredStreams.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="text-gray-400 text-sm">
              Showing {filteredStreams.length} of {streams.length} streams
            </span>
          </div>
        )}

        {loading ? (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
            <div className="text-center text-gray-400">Loading streams...</div>
          </div>
        ) : filteredStreams.length === 0 ? (
          <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
            <div className="text-center text-gray-400">
              {streams.length === 0 ? 'No streams found' : 'No streams match your filters'}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredStreams.map((stream) => (
              <StreamCard
                key={stream.id}
                stream={stream}
                selected={bulkSelected.has(stream.id)}
                onSelect={(selected) => toggleSelectStream(stream.id)}
                onPreview={() => {
                  setSelectedStream(stream)
                  setShowPreviewModal(true)
                }}
                onAction={(action) => {
                  if (action === 'delete') {
                    setConfirmAction({
                      type: 'delete',
                      stream,
                      title: 'Delete Stream',
                      message: `Are you sure you want to delete this stream by ${stream.profiles?.display_name}? This action cannot be undone.`,
                      confirmText: 'Delete',
                      onConfirm: () => handleStreamAction('delete', stream)
                    })
                  } else {
                    handleStreamAction(action, stream)
                  }
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Stream Preview Modal */}
      {showPreviewModal && selectedStream && (
        <StreamPreviewModal
          stream={selectedStream}
          onClose={() => {
            setShowPreviewModal(false)
            setSelectedStream(null)
          }}
          onAction={(action, reason) => {
            setShowPreviewModal(false)
            if (action === 'delete') {
              setConfirmAction({
                type: 'delete',
                stream: selectedStream,
                title: 'Delete Stream',
                message: `Are you sure you want to delete this stream? This action cannot be undone.`,
                confirmText: 'Delete',
                onConfirm: () => handleStreamAction('delete', selectedStream, reason)
              })
            } else {
              handleStreamAction(action, selectedStream, reason)
            }
          }}
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

export default StreamManagement