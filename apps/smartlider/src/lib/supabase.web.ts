import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = process.env.EXPO_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: {
      getItem:    (key) => Promise.resolve(localStorage.getItem(key)),
      setItem:    (key, value) => { localStorage.setItem(key, value); return Promise.resolve() },
      removeItem: (key) => { localStorage.removeItem(key); return Promise.resolve() },
    },
    autoRefreshToken:   true,
    persistSession:     true,
    detectSessionInUrl: false,
  },
})
