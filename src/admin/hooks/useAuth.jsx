import { createContext, useContext, useState, useEffect } from 'react'
import { supabaseAdmin } from '../utils/supabase'
import bcrypt from 'bcryptjs'

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
      
      // Get session from storage
      const adminData = localStorage.getItem('admin_panel_session')
      
      if (adminData) {
        try {
          const parsed = JSON.parse(adminData)
          
          // Verify session against DB to ensure user is still active/exists
          const { data: adminUser, error } = await supabaseAdmin
            .from('admin_users')
            .select('id, username, is_active')
            .eq('id', parsed.id)
            .eq('is_active', true)
            .single()
          
          if (error || !adminUser) {
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
    console.log('🔐 Starting login process...')
    
    // TEMPORARY: Generate a new hash for the password you're typing
    const testHash = await bcrypt.hash(password, 10)
    console.log('🔨 Generated hash for your password:', testHash)
    
    // Rest of your login code...
    const { data: adminUser, error } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    if (error || !adminUser) {
      throw new Error('Invalid credentials')
    }

    console.log('✅ User found')
    console.log('🔑 Hash from DB:', adminUser.password_hash)
    console.log('🔑 Hash for your input:', testHash)
    
    const isValid = await bcrypt.compare(password, adminUser.password_hash)
    console.log('✅ Password comparison result:', isValid)

    if (!isValid) {
      throw new Error('Invalid credentials')
    }

    // Success flow...
    const adminData = { id: adminUser.id, username: adminUser.username }
    setAdmin(adminData)
    localStorage.setItem('admin_panel_session', JSON.stringify(adminData))

    return { success: true }
  } catch (error) {
    console.error('💥 Login failed:', error.message)
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