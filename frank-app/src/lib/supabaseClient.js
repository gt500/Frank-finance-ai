import { createClient } from '@supabase/supabase-js'

// VITE_SUPABASE_ANON_KEY is meant to be public — it identifies the project,
// not a secret. Every table it can touch is protected by Row Level Security
// (see supabase/migrations). Never put the service role key behind a VITE_
// prefix — that one bypasses RLS entirely and must only exist as a Supabase
// Function secret, never in the frontend bundle.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set — auth and billing will not work. Check your .env file.')
}

export const supabase = createClient(url, anonKey, {
  auth: { persistSession: true, autoRefreshToken: true },
})
