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
    console.log('📝 Username:', username)
    console.log('🔑 Password provided:', password ? 'Yes' : 'No')

    // 1. Fetch user by username
    console.log('🔍 Querying database for user...')
    const { data: adminUser, error } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('username', username)
      .eq('is_active', true)
      .single()

    console.log('📊 Database query result:', { 
      data: adminUser ? 'Found' : 'Not found', 
      error: error ? error.message : 'No error' 
    })

    if (error) {
      console.error('❌ Database error:', error)
      throw new Error('Invalid credentials')
    }

    if (!adminUser) {
      console.error('❌ No admin user found')
      throw new Error('Invalid credentials')
    }

    console.log('✅ User found:', {
      id: adminUser.id,
      username: adminUser.username,
      is_active: adminUser.is_active,
      password_hash_exists: !!adminUser.password_hash,
      password_hash_format: adminUser.password_hash ? adminUser.password_hash.substring(0, 7) + '...' : 'None'
    })

    // 2. Compare provided password with hashed password in DB
    console.log('🔒 Comparing passwords...')
    console.log('🔑 Hash from DB:', adminUser.password_hash)
    
    const isValid = await bcrypt.compare(password, adminUser.password_hash)
    console.log('✅ Password comparison result:', isValid)

    if (!isValid) {
      console.error('❌ Password comparison failed')
      throw new Error('Invalid credentials')
    }

    // 3. Prepare session
    console.log('🎫 Creating session...')
    const adminData = { id: adminUser.id, username: adminUser.username }

    // 4. Update last login timestamp in DB
    console.log('📅 Updating last login...')
    const { error: updateError } = await supabaseAdmin
      .from('admin_users')
      .update({ last_login: new Date().toISOString() })
      .eq('id', adminUser.id)

    if (updateError) {
      console.warn('⚠️ Failed to update last login:', updateError)
    }

    // 5. Update local state and storage
    console.log('💾 Saving session locally...')
    setAdmin(adminData)
    localStorage.setItem('admin_panel_session', JSON.stringify(adminData))

    console.log('🎉 Login successful!')
    return { success: true }
  } catch (error) {
    console.error('💥 Login process failed:', error.message)
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