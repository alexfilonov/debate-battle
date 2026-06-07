import { createBrowserClient } from '@supabase/ssr'

// Browser-side Supabase client — use this in Client Components (anything with 'use client').
// Safe to call multiple times — createBrowserClient handles deduplication internally.
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
