import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { cookies } from 'next/headers'

// This route is called by Supabase after the user completes Google OAuth.
// It exchanges the temporary 'code' for a real session, then checks the
// allowlist before letting the user into the app.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=missing_code`)
  }

  const supabase = await createSupabaseServerClient()

  // Exchange the OAuth code for a user session
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/?error=auth_failed`)
  }

  // Use the service role key to check the allowlist — this bypasses RLS
  // so the server can always read the allowlist regardless of the user's auth state.
  const cookieStore = await cookies()
  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  const { data: allowlistEntry, error: allowlistError } = await adminClient
    .from('allowlist')
    .select('email')
    .eq('email', data.user.email)
    .single()

if (!allowlistEntry) {
    // Not on the allowlist — sign them out and send them back with an error
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/?error=not_allowed`)
  }

  // Allowed — send them to the dashboard
  return NextResponse.redirect(`${origin}/dashboard`)
}
