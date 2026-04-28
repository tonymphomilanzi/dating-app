import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

// Check if required environment variables are set
if (!supabaseUrl) {
  throw new Error('Missing VITE_SUPABASE_URL environment variable')
}

if (!supabaseServiceKey) {
  throw new Error('Missing VITE_SUPABASE_SERVICE_ROLE_KEY environment variable')
}

// Admin client with service role key for full access
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    storageKey: 'admin-panel-auth', // Use different storage key
    storage: {
      // Custom storage to avoid conflicts
      getItem: (key) => {
        try {
          return localStorage.getItem(`admin_${key}`)
        } catch {
          return null
        }
      },
      setItem: (key, value) => {
        try {
          localStorage.setItem(`admin_${key}`, value)
        } catch {}
      },
      removeItem: (key) => {
        try {
          localStorage.removeItem(`admin_${key}`)
        } catch {}
      }
    }
  }
})