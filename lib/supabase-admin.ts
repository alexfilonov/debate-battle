import { createClient } from '@supabase/supabase-js'

// Service-role Supabase client for trusted server-side writes (e.g. saving AI
// judgements). Unlike the SSR `createServerClient`, this does NOT read auth
// cookies — it always authenticates as `service_role`, bypassing RLS. That
// distinction matters: a cookie-aware client would send the logged-in user's
// JWT instead of the service key, and the write would be blocked by RLS.
//
// SERVER ONLY. The service role key must never reach the browser.
export function createSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
