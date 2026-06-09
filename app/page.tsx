'use client'

import { useState, Suspense, type CSSProperties } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

const titleStyle: CSSProperties = {
  fontSize: 'clamp(3.5rem, 9vw, 6rem)',
  lineHeight: 0.9,
  fontWeight: 900,
  marginBottom: '20px',
  letterSpacing: '-0.08em',
  // Wrap to a second line on narrow screens instead of overflowing the edge;
  // stays on one line wherever it fits.
  whiteSpace: 'normal',
  background: `linear-gradient(
    135deg,
    #ffffff 0%,
    #d1d5db 35%,
    #8b5cf6 70%,
    #38bdf8 100%
  )`,
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  textShadow: '0 0 40px rgba(139, 92, 246, 0.25)',
}

// useSearchParams() requires a Suspense boundary in Next.js, so we split
// the page into an inner component (which reads params) and an outer wrapper.
function LandingPageInner() {
  const [loading, setLoading] = useState(false)
  const searchParams = useSearchParams()

  // Read error from URL — set by /auth/callback when login fails
  const urlError = searchParams.get('error')
  let errorMessage: string | null = null
  if (urlError === 'not_allowed') errorMessage = 'Your email is not on the access list.'
  else if (urlError === 'auth_failed') errorMessage = 'Sign in failed. Please try again.'
  else if (urlError === 'missing_code') errorMessage = 'Something went wrong. Please try again.'

  async function handleSignIn() {
    setLoading(true)
    const supabase = createSupabaseBrowserClient()

    // Kick off Google OAuth — Supabase redirects to Google, which sends
    // the user back to /auth/callback with a one-time code when done.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-4">
      <div className="max-w-lg w-full text-center">

        {/* App name and tagline */}
        <h1 style={titleStyle}>
          Debate Battle
        </h1>
        <p className="text-xl text-gray-400 mb-2">
          Real debates. Real arguments. Real winner.
        </p>
        <p className="text-gray-500 mb-12">
          Record your speeches, challenge a friend, and let an AI judge decide who made the stronger case.
        </p>

        {/* How it works */}
        <div className="grid grid-cols-3 gap-4 mb-12 text-sm">
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-2xl mb-2">🎙️</div>
            <div className="text-white font-medium mb-1">Record</div>
            <div className="text-gray-500">Give your opening speech and rebuttal on any topic</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-2xl mb-2">⚔️</div>
            <div className="text-white font-medium mb-1">Challenge</div>
            <div className="text-gray-500">Send the debate link to your opponent</div>
          </div>
          <div className="bg-gray-900 rounded-xl p-4">
            <div className="text-2xl mb-2">⚖️</div>
            <div className="text-white font-medium mb-1">Judge</div>
            <div className="text-gray-500">AI analyzes logic and reasoning to pick the winner</div>
          </div>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm">
            {errorMessage}
          </div>
        )}

        {/* Sign in button */}
        <button
          onClick={handleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-3 px-6 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {/* Google logo */}
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>

        <p className="text-gray-600 text-xs mt-4">
          Access is invite-only.
        </p>
      </div>
    </div>
  )
}

// Suspense wrapper required by Next.js when using useSearchParams()
export default function LandingPage() {
  return (
    <Suspense>
      <LandingPageInner />
    </Suspense>
  )
}
