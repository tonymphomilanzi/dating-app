import { createContext, useContext, useState } from 'react'
import CustomAlert from './CustomAlert'

const AlertContext = createContext()

export const useAlert = () => {
  const context = useContext(AlertContext)
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider')
  }
  return context
}

export const AlertProvider = ({ children }) => {
  const [alert, setAlert] = useState({
    isOpen: false,
    title: '',
    message: '',
    type: 'info',
    onConfirm: null,
    showConfirm: false
  })

  const showAlert = (title, message, type = 'info') => {
    setAlert({
      isOpen: true,
      title,
      message,
      type,
      onConfirm: null,
      showConfirm: false
    })
  }

  const showConfirm = (title, message, onConfirm) => {
    setAlert({
      isOpen: true,
      title,
      message,
      type: 'confirm',
      onConfirm,
      showConfirm: true
    })
  }

  const closeAlert = () => {
    setAlert({ ...alert, isOpen: false })
  }

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm, closeAlert }}>
      {children}
      <CustomAlert
        isOpen={alert.isOpen}
        onClose={closeAlert}
        title={alert.title}
        message={alert.message}
        type={alert.type}
        onConfirm={alert.onConfirm}
        showConfirm={alert.showConfirm}
      />
    </AlertContext.Provider>
  )
}