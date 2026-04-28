import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY

// Admin client with service role key for full access
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

// Regular client for auth
export const supabase = createClient(supabaseUrl, import.meta.env.VITE_SUPABASE_ANON_KEY)