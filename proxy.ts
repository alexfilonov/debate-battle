import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Proxy runs on every request before the page renders.
// Its job here is to: (1) refresh the user's auth session cookie, and
// (2) redirect unauthenticated users away from protected routes.
export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write updated cookies to both the request and the response
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the session — important: use getUser(), not getSession(), for security
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect unauthenticated users away from debate routes
  if (!user && request.nextUrl.pathname.startsWith('/debate')) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return supabaseResponse
}

// Run middleware on all routes except static files and images
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
