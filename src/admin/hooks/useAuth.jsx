import { createContext, useContext, useState, useEffect } from 'react'
import { supabaseAdmin } from '../utils/supabase'

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [admin, setAdmin] = useState(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    if (!initialized) {
      checkAuth()
      setInitialized(true)
    }
  }, [initialized])

  const checkAuth = async () => {
    try {
      setLoading(true)
      
      // Use a different localStorage key to avoid conflicts with main app
      const adminData = localStorage.getItem('admin_panel_session')
      
      if (adminData) {
        try {
          const parsed = JSON.parse(adminData)
          
          // Verify the session is still valid by checking if admin user exists
          const { data: adminUser, error } = await supabaseAdmin
            .from('admin_users')
            .select('id, username, is_active')
            .eq('id', parsed.id)
            .eq('is_active', true)
            .single()
          
          if (error || !adminUser) {
            // Session is invalid, clear it
            localStorage.removeItem('admin_panel_session')
            setAdmin(null)
          } else {
            setAdmin(parsed)
          }
        } catch (error) {
          console.error('Error parsing admin session:', error)
          localStorage.removeItem('admin_panel_session')
          setAdmin(null)
        }
      } else {
        setAdmin(null)
      }
    } catch (error) {
      console.error('Error checking auth:', error)
      setAdmin(null)
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    try {
      const { data, error } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('username', username)
        .eq('is_active', true)
        .single()

      if (error || !data) {
        throw new Error('Invalid credentials')
      }

      // Simple password check (change this to bcrypt in production)
      if (password !== 'admin123') {
        throw new Error('Invalid credentials')
      }

      // Update last login
      await supabaseAdmin
        .from('admin_users')
        .update({ last_login: new Date().toISOString() })
        .eq('id', data.id)

      const adminData = { id: data.id, username: data.username }
      setAdmin(adminData)
      localStorage.setItem('admin_panel_session', JSON.stringify(adminData))

      return { success: true }
    } catch (error) {
      console.error('Login error:', error)
      return { success: false, error: error.message }
    }
  }

  const logout = () => {
    setAdmin(null)
    localStorage.removeItem('admin_panel_session')
  }

  const logAction = async (action, targetType, targetId = null, details = {}) => {
    if (!admin) return

    try {
      await supabaseAdmin
        .from('admin_logs')
        .insert({
          admin_id: admin.id,
          action,
          target_type: targetType,
          target_id: targetId,
          details
        })
    } catch (error) {
      console.error('Error logging admin action:', error)
    }
  }

  const value = {
    admin,
    loading,
    login,
    logout,
    logAction,
    initialized
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}