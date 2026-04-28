import { useState } from 'react'

const ClinicTable = ({ 
  clinics, 
  loading, 
  bulkSelected, 
  onSelectClinic, 
  onSelectAll, 
  onViewClinic, 
  onClinicAction 
}) => {
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' })

  const handleSort = (key) => {
    const direction = sortConfig.key === key && sortConfig.direction === 'asc' ? 'desc' : 'asc'
    setSortConfig({ key, direction })
  }

  const sortedClinics = [...clinics].sort((a, b) => {
    if (sortConfig.key === 'created_at') {
      return sortConfig.direction === 'asc' 
        ? new Date(a.created_at) - new Date(b.created_at)
        : new Date(b.created_at) - new Date(a.created_at)
    }
    
    if (sortConfig.key === 'rating') {
      return sortConfig.direction === 'asc' 
        ? (a.rating || 0) - (b.rating || 0)
        : (b.rating || 0) - (a.rating || 0)
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

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending': return 'bg-yellow-900 text-yellow-300'
      case 'approved': return 'bg-green-900 text-green-300'
      case 'rejected': return 'bg-red-900 text-red-300'
      default: return 'bg-gray-900 text-gray-300'
    }
  }

  const getStatusBadges = (clinic) => {
    const badges = []
    
    badges.push({
      text: clinic.status,
      color: getStatusColor(clinic.status)
    })
    
    if (clinic.is_verified) {
      badges.push({ text: 'Verified', color: 'bg-blue-900 text-blue-300' })
    }
    
    if (clinic.is_featured) {
      badges.push({ text: 'Featured', color: 'bg-purple-900 text-purple-300' })
    }

    return badges
  }

  const getAverageRating = (clinic) => {
    if (!clinic.clinic_reviews || clinic.clinic_reviews.length === 0) return 0
    const sum = clinic.clinic_reviews.reduce((acc, review) => acc + review.rating, 0)
    return (sum / clinic.clinic_reviews.length).toFixed(1)
  }

  if (loading) {
    return (
      <div className="bg-gray-800 rounded-lg border border-gray-700 p-8">
        <div className="text-center text-gray-400">Loading clinics...</div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-700">
          <thead className="bg-gray-750">
            <tr>
              <th className="px-6 py-3 text-left">
                <input
                  type="checkbox"
                  checked={bulkSelected.size === clinics.length && clinics.length > 0}
                  onChange={(e) => onSelectAll(e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('name')}
              >
                Clinic Info
                {sortConfig.key === 'name' && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Location
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('rating')}
              >
                Rating
                {sortConfig.key === 'rating' && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Status
              </th>
              
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:text-white"
                onClick={() => handleSort('created_at')}
              >
                Created
                {sortConfig.key === 'created_at' && (
                  <span className="ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
              
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          
          <tbody className="bg-gray-800 divide-y divide-gray-700">
            {sortedClinics.map((clinic) => {
              const statusBadges = getStatusBadges(clinic)
              const averageRating = getAverageRating(clinic)
              const reviewCount = clinic.clinic_reviews?.length || 0
              const specialtyCount = clinic.clinic_specialties?.length || 0
              
              return (
                <tr key={clinic.id} className="hover:bg-gray-700/50">
                  <td className="px-6 py-4">
                    <input
                      type="checkbox"
                      checked={bulkSelected.has(clinic.id)}
                      onChange={(e) => onSelectClinic(clinic.id, e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <img
                          className="h-12 w-12 rounded-lg object-cover"
                          src={clinic.cover_url || '/default-clinic.png'}
                          alt={clinic.name}
                          onError={(e) => {
                            e.target.src = '/default-clinic.png'
                          }}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                          {clinic.name}
                        </p>
                        <p className="text-sm text-gray-400 truncate">
                          {clinic.description ? 
                            clinic.description.substring(0, 60) + (clinic.description.length > 60 ? '...' : '')
                            : 'No description'
                          }
                        </p>
                        {specialtyCount > 0 && (
                          <p className="text-xs text-gray-500">
                            {specialtyCount} specialt{specialtyCount !== 1 ? 'ies' : 'y'}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-300">
                      <p>{clinic.city || 'No city'}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {clinic.address || 'No address'}
                      </p>
                    </div>
                  </td>
                  
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-1">
                      <span className="text-yellow-400">★</span>
                      <span className="text-sm text-white">
                        {averageRating > 0 ? averageRating : 'No reviews'}
                      </span>
                      {reviewCount > 0 && (
                        <span className="text-xs text-gray-400">
                          ({reviewCount})
                        </span>
                      )}
                    </div>
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
                    </div>
                  </td>
                  
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {formatDate(clinic.created_at)}
                  </td>
                  
                  <td className="px-6 py-4 text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => onViewClinic(clinic)}
                        className="text-blue-400 hover:text-blue-300"
                        title="View Details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>

                      {clinic.status === 'pending' && (
                        <>
                          <button
                            onClick={() => onClinicAction('approve', clinic)}
                            className="text-green-400 hover:text-green-300"
                            title="Approve"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onClinicAction('reject', clinic)}
                            className="text-red-400 hover:text-red-300"
                            title="Reject"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </>
                      )}

                      {clinic.status === 'approved' && (
                        <button
                          onClick={() => onClinicAction('reject', clinic)}
                          className="text-red-400 hover:text-red-300"
                          title="Reject"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}

                      {clinic.status === 'rejected' && (
                        <button
                          onClick={() => onClinicAction('approve', clinic)}
                          className="text-green-400 hover:text-green-300"
                          title="Approve"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      )}
                      
                      <button
                        onClick={() => onClinicAction('verify', clinic)}
                        className={`${clinic.is_verified ? 'text-yellow-400 hover:text-yellow-300' : 'text-blue-400 hover:text-blue-300'}`}
                        title={clinic.is_verified ? 'Unverify' : 'Verify'}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                      
                      <button
                        onClick={() => onClinicAction('delete', clinic)}
                        className="text-red-400 hover:text-red-300"
                        title="Delete Clinic"
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
        
        {sortedClinics.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            No clinics found matching your criteria
          </div>
        )}
      </div>
    </div>
  )
}

export default ClinicTable