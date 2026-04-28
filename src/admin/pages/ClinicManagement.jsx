import { useState, useEffect } from 'react'
import { supabaseAdmin } from '../utils/supabase'
import { useAuth } from '../hooks/useAuth'
import ClinicTable from '../components/ClinicTable'
import ClinicPreviewModal from '../components/ClinicPreviewModal'
import ConfirmModal from '../components/ConfirmModal'

const ClinicManagement = () => {
  const { logAction } = useAuth()
  const [clinics, setClinics] = useState([])
  const [filteredClinics, setFilteredClinics] = useState([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    status: 'pending',
    search: '',
    city: 'all',
    verified: 'all'
  })
  const [selectedClinic, setSelectedClinic] = useState(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [bulkSelected, setBulkSelected] = useState(new Set())

  useEffect(() => {
    loadClinics()
  }, [])

  useEffect(() => {
    filterClinics()
  }, [clinics, filters])

  const loadClinics = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabaseAdmin
        .from('massage_clinics')
        .select(`
          *,
          clinic_reviews (
            id,
            rating
          ),
          clinic_specialties (
            id,
            name
          ),
          clinic_media (
            id,
            url,
            caption
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error
      setClinics(data || [])
    } catch (error) {
      console.error('Error loading clinics:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterClinics = () => {
    let filtered = [...clinics]

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(clinic => clinic.status === filters.status)
    }

    // Search filter
    if (filters.search) {
      filtered = filtered.filter(clinic => 
        clinic.name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        clinic.description?.toLowerCase().includes(filters.search.toLowerCase()) ||
        clinic.city?.toLowerCase().includes(filters.search.toLowerCase()) ||
        clinic.address?.toLowerCase().includes(filters.search.toLowerCase())
      )
    }

    // City filter
    if (filters.city !== 'all') {
      filtered = filtered.filter(clinic => clinic.city === filters.city)
    }

    // Verified filter
    if (filters.verified !== 'all') {
      filtered = filtered.filter(clinic => 
        filters.verified === 'true' ? clinic.is_verified : !clinic.is_verified
      )
    }

    setFilteredClinics(filtered)
  }

  const handleClinicAction = async (action, clinic, reason = '') => {
    try {
      let updateData = {}
      let logMessage = ''

      switch (action) {
        case 'approve':
          updateData = { status: 'approved' }
          logMessage = `Approved clinic: ${clinic.name}`
          break
        case 'reject':
          updateData = { status: 'rejected' }
          logMessage = `Rejected clinic: ${clinic.name}`
          break
        case 'verify':
          updateData = { is_verified: !clinic.is_verified }
          logMessage = `${clinic.is_verified ? 'Unverified' : 'Verified'} clinic: ${clinic.name}`
          break
        case 'feature':
          updateData = { is_featured: !clinic.is_featured }
          logMessage = `${clinic.is_featured ? 'Unfeatured' : 'Featured'} clinic: ${clinic.name}`
          break
        case 'delete':
          // Delete related data first
          await supabaseAdmin.from('clinic_reviews').delete().eq('clinic_id', clinic.id)
          await supabaseAdmin.from('clinic_specialties').delete().eq('clinic_id', clinic.id)
          await supabaseAdmin.from('clinic_media').delete().eq('clinic_id', clinic.id)
          
          // Delete the clinic
          const { error: deleteError } = await supabaseAdmin
            .from('massage_clinics')
            .delete()
            .eq('id', clinic.id)

          if (deleteError) throw deleteError

          await logAction('delete', 'clinic', clinic.id, {
            clinic_name: clinic.name,
            reason
          })

          await loadClinics()
          setConfirmAction(null)
          alert('Clinic deleted successfully!')
          return
      }

      const { error } = await supabaseAdmin
        .from('massage_clinics')
        .update(updateData)
        .eq('id', clinic.id)

      if (error) throw error

      await logAction(action, 'clinic', clinic.id, {
        clinic_name: clinic.name,
        reason
      })

      await loadClinics()
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
        alert('No clinics selected')
        return
      }

      let updateData = {}
      switch (action) {
        case 'approve':
          updateData = { status: 'approved' }
          break
        case 'reject':
          updateData = { status: 'rejected' }
          break
        case 'verify':
          updateData = { is_verified: true }
          break
        case 'unverify':
          updateData = { is_verified: false }
          break
        case 'delete':
          // Delete related data first
          await supabaseAdmin.from('clinic_reviews').delete().in('clinic_id', Array.from(bulkSelected))
          await supabaseAdmin.from('clinic_specialties').delete().in('clinic_id', Array.from(bulkSelected))
          await supabaseAdmin.from('clinic_media').delete().in('clinic_id', Array.from(bulkSelected))

          // Delete clinics
          const { error } = await supabaseAdmin
            .from('massage_clinics')
            .delete()
            .in('id', Array.from(bulkSelected))

          if (error) throw error

          await logAction('bulk_delete', 'clinic', null, {
            count: bulkSelected.size,
            clinic_ids: Array.from(bulkSelected)
          })

          setBulkSelected(new Set())
          await loadClinics()
          alert(`${bulkSelected.size} clinics deleted successfully!`)
          return
      }

      const { error } = await supabaseAdmin
        .from('massage_clinics')
        .update(updateData)
        .in('id', Array.from(bulkSelected))

      if (error) throw error

      await logAction(`bulk_${action}`, 'clinic', null, {
        count: bulkSelected.size,
        clinic_ids: Array.from(bulkSelected)
      })

      setBulkSelected(new Set())
      await loadClinics()
      alert(`Bulk ${action} completed for ${bulkSelected.size} clinics!`)
    } catch (error) {
      console.error('Error performing bulk action:', error)
      alert('Error performing bulk action')
    }
  }

  const getStatusStats = () => {
    return {
      pending: clinics.filter(c => c.status === 'pending').length,
      approved: clinics.filter(c => c.status === 'approved').length,
      rejected: clinics.filter(c => c.status === 'rejected').length,
      verified: clinics.filter(c => c.is_verified).length,
      total: clinics.length
    }
  }

  const getUniqueCities = () => {
    return [...new Set(clinics.map(c => c.city).filter(Boolean))].sort()
  }

  const stats = getStatusStats()
  const cities = getUniqueCities()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Clinic Management</h1>
          <p className="text-gray-400">Review and manage massage clinic listings</p>
        </div>
        
        <button
          onClick={loadClinics}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors disabled:opacity-50"
        >
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="text-gray-400 text-sm">Total Clinics</div>
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
        <div className="bg-blue-900/20 border border-blue-600 rounded-lg p-4">
          <div className="text-blue-400 text-sm">Verified</div>
          <div className="text-white text-xl font-bold">{stats.verified}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
            <label className="block text-sm font-medium text-gray-300 mb-2">City</label>
            <select
              value={filters.city}
              onChange={(e) => setFilters({ ...filters, city: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Cities</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>
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
            <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
            <input
              type="text"
              placeholder="Search clinics..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={() => setFilters({ status: 'all', search: '', city: 'all', verified: 'all' })}
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
              {bulkSelected.size} clinic{bulkSelected.size !== 1 ? 's' : ''} selected
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
                onClick={() => handleBulkAction('verify')}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
              >
                Verify All
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

      {/* Clinic Table */}
      <ClinicTable
        clinics={filteredClinics}
        loading={loading}
        bulkSelected={bulkSelected}
        onSelectClinic={(clinicId, selected) => {
          const newSelected = new Set(bulkSelected)
          if (selected) {
            newSelected.add(clinicId)
          } else {
            newSelected.delete(clinicId)
          }
          setBulkSelected(newSelected)
        }}
        onSelectAll={(selected) => {
          if (selected) {
            setBulkSelected(new Set(filteredClinics.map(c => c.id)))
          } else {
            setBulkSelected(new Set())
          }
        }}
        onViewClinic={(clinic) => {
          setSelectedClinic(clinic)
          setShowPreviewModal(true)
        }}
        onClinicAction={(action, clinic) => {
          if (action === 'delete') {
            setConfirmAction({
              type: 'delete',
              clinic,
              title: 'Delete Clinic',
              message: `Are you sure you want to delete "${clinic.name}"? This action cannot be undone and will remove all associated data.`,
              confirmText: 'Delete',
              onConfirm: () => handleClinicAction('delete', clinic)
            })
          } else {
            handleClinicAction(action, clinic)
          }
        }}
      />

      {/* Clinic Preview Modal */}
      {showPreviewModal && selectedClinic && (
        <ClinicPreviewModal
          clinic={selectedClinic}
          onClose={() => {
            setShowPreviewModal(false)
            setSelectedClinic(null)
          }}
          onAction={(action, reason) => {
            setShowPreviewModal(false)
            if (action === 'delete') {
              setConfirmAction({
                type: 'delete',
                clinic: selectedClinic,
                title: 'Delete Clinic',
                message: `Are you sure you want to delete "${selectedClinic.name}"? This action cannot be undone.`,
                confirmText: 'Delete',
                onConfirm: () => handleClinicAction('delete', selectedClinic, reason)
              })
            } else {
              handleClinicAction(action, selectedClinic, reason)
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

export default ClinicManagement