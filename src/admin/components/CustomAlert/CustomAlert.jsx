import { useState, useEffect } from 'react'
import { 
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  QuestionMarkCircleIcon,
  InformationCircleIcon
} from '@heroicons/react/24/outline'

const CustomAlert = ({ isOpen, onClose, title, message, type = 'info', onConfirm, showConfirm = false }) => {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true)
    } else {
      const timer = setTimeout(() => setIsVisible(false), 150)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  if (!isVisible && !isOpen) return null

  const getIcon = () => {
    const iconClass = "w-6 h-6"
    
    switch (type) {
      case 'success': 
        return <CheckCircleIcon className={`${iconClass} text-green-400`} />
      case 'error': 
        return <XCircleIcon className={`${iconClass} text-red-400`} />
      case 'warning': 
        return <ExclamationTriangleIcon className={`${iconClass} text-yellow-400`} />
      case 'confirm': 
        return <QuestionMarkCircleIcon className={`${iconClass} text-blue-400`} />
      default: 
        return <InformationCircleIcon className={`${iconClass} text-blue-400`} />
    }
  }

  const getColors = () => {
    switch (type) {
      case 'success': return 'border-green-500 bg-green-900/20'
      case 'error': return 'border-red-500 bg-red-900/20'
      case 'warning': return 'border-yellow-500 bg-yellow-900/20'
      case 'confirm': return 'border-blue-500 bg-blue-900/20'
      default: return 'border-blue-500 bg-blue-900/20'
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 transition-opacity duration-150 ${
        isOpen ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleBackdropClick}
    >
      <div className={`bg-gray-800 border rounded-lg shadow-xl transform transition-all duration-150 max-w-md w-full ${
        isOpen ? 'scale-100 translate-y-0' : 'scale-95 translate-y-2'
      } ${getColors()}`}>
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-4">
            {getIcon()}
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>
          
          <p className="text-gray-300 mb-6">{message}</p>
          
          <div className="flex justify-end space-x-3">
            {showConfirm && (
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              onClick={() => {
                if (showConfirm && onConfirm) {
                  onConfirm()
                }
                onClose()
              }}
              className={`px-4 py-2 rounded-md transition-colors ${
                type === 'error' || type === 'warning' 
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {showConfirm ? 'Confirm' : 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CustomAlert