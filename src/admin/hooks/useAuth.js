import React, { createContext, useContext, useState, useEffect } from 'react'
import bcrypt from 'bcryptjs'
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

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = () => {
    const adminData = localStorage.getItem('admin')
    if (adminData) {
      setAdmin(JSON.parse(adminData))
    }
    setLoading(false)
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

      const isValid = await bcrypt.compare(password, data.password_hash)
      if (!isValid) {
        throw new Error('Invalid credentials')
      }

      // Update last login
      await supabaseAdmin
        .from('admin_users')
        .update({ last_login: new Date() })
        .eq('id', data.id)

      const adminData = { id: data.id, username: data.username }
      setAdmin(adminData)
      localStorage.setItem('admin', JSON.stringify(adminData))

      return { success: true }
    } catch (error) {
      return { success: false, error: error.message }
    }
  }

  const logout = () => {
    setAdmin(null)
    localStorage.removeItem('admin')
  }

  const logAction = async (action, targetType, targetId = null, details = {}) => {
    if (!admin) return

    await supabaseAdmin
      .from('admin_logs')
      .insert({
        admin_id: admin.id,
        action,
        target_type: targetType,
        target_id: targetId,
        details
      })
  }

  const value = {
    admin,
    loading,
    login,
    logout,
    logAction
  }

  return React.createElement(AuthContext.Provider, { value }, children)
}