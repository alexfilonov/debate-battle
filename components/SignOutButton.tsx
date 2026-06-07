'use client'

import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

// Sign out button — must be a Client Component because it handles a click event
// and uses the browser Supabase client to clear the session.
export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <button
      onClick={handleSignOut}
      className="text-sm text-gray-400 hover:text-white transition-colors"
    >
      Sign out
    </button>
  )
}
