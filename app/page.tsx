'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

// ─── Rotating debate questions ────────────────────────────────────────────────
// Displayed above the title and typed out one character at a time on page load.
// Intentionally lighthearted — they set the tone before the user signs in.
const QUESTIONS = [
  'Is a hot dog a sandwich?',
  'Is cereal a soup?',
  'Is a Pop-Tart a calzone?',
  'Is a taco a sandwich?',
  'Is a burrito a sandwich?',
  'Is a grilled cheese a sandwich?',
  'Is a calzone just a folded pizza?',
  'Should pineapple go on pizza?',
  'Should you eat pizza with a fork?',
  'Should you put milk in before the cereal?',
  'Is a Jaffa Cake a biscuit?',
  'Should you double-dip?',
  'Is breakfast the most important meal of the day?',
  'Is it okay to take the last piece without asking?',
  'Should you rinse dishes before the dishwasher?',
  'Is Die Hard a Christmas movie?',
  'Was the ending of Game of Thrones fine actually?',
  'Was Jar Jar Binks a Sith Lord all along?',
  'Is Star Wars better than Star Trek?',
  'Was Thanos right?',
  'Is GIF pronounced "jif"?',
  'Is the Oxford comma necessary?',
  'Is "irregardless" a real word?',
  'Are emojis ruining language?',
  'Is Dark Mode superior?',
  'Should tabs replace spaces?',
  'Is reply-all ever okay?',
  'Are NFTs art?',
  'Is social media making us dumber?',
  'Is hustle culture toxic?',
  'Should you wake up before 6am to be successful?',
  'Does money buy happiness?',
  'Is the customer always right?',
  'Should phones be allowed at the dinner table?',
  'Is small talk a form of torture?',
  'Should you hold the door for someone 20 feet away?',
  'Is it rude to recline your airplane seat?',
  'Should you clap when the plane lands?',
  'Is it okay to ghost someone after one date?',
  'Is texting back immediately desperate?',
  'Can you be friends with an ex?',
  'Should you split the bill on a first date?',
  'Is it weird to eat lunch alone?',
  'Is it ethical to eat alone at a restaurant?',
  'Is it okay to talk in an elevator?',
  'Should you make your bed every morning?',
  'Should you wash your legs in the shower?',
  'Does toilet paper go over or under?',
  'Is water wet?',
  'Does a straw have one hole or two?',
  'Is Pluto a planet?',
  'Was the dress blue or gold?',
  'Was Y2K a real threat?',
  'Was Napoleon actually short?',
  'Is free will real?',
  'Does everything happen for a reason?',
  'Is laughter the best medicine?',
  'Does talking to plants help them grow?',
  'Is chess a sport?',
  'Is competitive eating a sport?',
  'Is binge-watching TV a valid hobby?',
  'Is cheating at solitaire even wrong?',
  'Is it plagiarism if you cite yourself?',
  'Should kids learn cursive writing?',
  'Should there be a driving retest after 60?',
  'Is a mullet a valid life choice?',
  'Is it okay to judge people by their music taste?',
  'Are cats or dogs objectively better?',
  'Is it rude to show up exactly on time?',
  'Should you tip at a fast food restaurant?',
  'Was Socrates actually wise?',
]

// SessionStorage keys for the shuffle queue.
// We persist the queue across page refreshes so all questions cycle through
// before any repeat — like a shuffled playlist.
const QUEUE_KEY = 'debatable_queue'
const INDEX_KEY = 'debatable_index'

// Fisher-Yates shuffle: produces an unbiased random ordering of the array.
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Returns the next question from the sessionStorage shuffle queue.
// When the queue is exhausted it reshuffles automatically.
// Falls back to a random pick if sessionStorage is unavailable (e.g. private browsing).
function getNextQuestion(): string {
  try {
    let queue: string[] = JSON.parse(sessionStorage.getItem(QUEUE_KEY) ?? 'null') ?? []
    let index = parseInt(sessionStorage.getItem(INDEX_KEY) ?? '0')
    if (!queue.length || index >= queue.length) {
      queue = shuffle(QUESTIONS)
      index = 0
    }
    const question = queue[index]
    sessionStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
    sessionStorage.setItem(INDEX_KEY, String(index + 1))
    return question
  } catch {
    return QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)]
  }
}

// ─── Landing page ─────────────────────────────────────────────────────────────
// Wrapped in <Suspense> because useSearchParams() requires it in the Next.js app router.
function LandingPageInner() {
  const [loading, setLoading] = useState(false)
  const [question, setQuestion] = useState<string | null>(null)
  const [displayedChars, setDisplayedChars] = useState(0)     // how many characters have typed out so far
  const [revealed, setRevealed] = useState(false)             // true once the user clicks the arrow
  const [scrollUnlocked, setScrollUnlocked] = useState(false) // true once the reveal animation finishes
  const searchParams = useSearchParams()

  // After the arrow is clicked, wait for the reveal animation to finish (~950ms)
  // before removing the maxHeight cap. Without this delay, the page briefly flashes
  // a scrollbar as the below-fold content becomes visible mid-animation.
  useEffect(() => {
    if (!revealed) return
    const t = setTimeout(() => setScrollUnlocked(true), 950)
    return () => clearTimeout(t)
  }, [revealed])

  // Pick a question on mount. Must run client-side because sessionStorage
  // doesn't exist on the server.
  useEffect(() => {
    setQuestion(getNextQuestion())
  }, [])

  // Typewriter effect: reveal one character every 38ms until the full question is shown.
  useEffect(() => {
    if (!question) return
    setDisplayedChars(0)
    let chars = 0
    const interval = setInterval(() => {
      chars++
      setDisplayedChars(chars)
      if (chars >= question.length) clearInterval(interval)
    }, 38)
    return () => clearInterval(interval)
  }, [question])

  // Parse any auth error codes the OAuth callback passes back via URL params.
  const urlError = searchParams.get('error')
  let errorMessage: string | null = null
  if (urlError === 'not_allowed') errorMessage = 'Your email is not on the access list.'
  else if (urlError === 'auth_failed') errorMessage = 'Sign in failed. Please try again.'
  else if (urlError === 'missing_code') errorMessage = 'Something went wrong. Please try again.'

  // Kicks off the Google OAuth flow. On success the browser redirects to /auth/callback,
  // which validates the session and sends the user to the dashboard.
  async function handleSignIn() {
    setLoading(true)
    const supabase = createSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setLoading(false)
  }

  return (
    <main
      className="bg-[#09090b] text-white overflow-hidden"
      // Cap height to the viewport before the arrow is clicked so the hidden
      // revealed content (below the fold) can't be scrolled to early.
      style={{ minHeight: '100vh', maxHeight: scrollUnlocked ? 'none' : '100vh' }}
    >

      {/* ── Hero section ──────────────────────────────────────────────────────
          Sits vertically centered before reveal. On reveal, paddingTop shrinks
          so the title floats upward, making room for the content below. */}
      <div
        style={{
          paddingTop: revealed ? 'calc(50vh - 220px)' : 'calc(50vh - 110px)',
          paddingBottom: revealed ? '2.5rem' : '0',
          transition: 'padding 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="w-full text-center px-6">

          {/* Rotating question ──────────────────────────────────────────────
              Always rendered (even before a question is picked) so the title
              doesn't jump when the first question appears. minHeight reserves
              the line's space while the string is empty. */}
          <div className="mb-3">
            <p style={{
              fontFamily: 'var(--font-playfair)',
              fontStyle: 'italic',
              fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
              color: '#6b7280',
              letterSpacing: '0.01em',
              lineHeight: 1.4,
              minHeight: '1.5em',
              opacity: revealed ? 0 : 1,
              transition: 'opacity 0.3s ease',
            }}>
              {question ? question.slice(0, displayedChars) : ''}
              {/* Text cursor: solid block while typing, blinks when done */}
              {question && (
                <span style={{
                  animation: displayedChars >= question.length ? 'cursor-blink 1s step-end infinite' : 'none',
                  color: '#6b7280',
                  marginLeft: '1px',
                }}>|</span>
              )}
            </p>
          </div>

          {/* App title ───────────────────────────────────────────────────── */}
          <h1
            className="leading-none"
            style={{
              fontFamily: 'var(--font-bebas)',
              fontSize: 'clamp(3.5rem, 12vw, 8rem)',
              display: 'block',
            }}
          >
            debatable
            {/* CSS Grid trick ─────────────────────────────────────────────
                display:inline-grid stacks the period and the triangle in the
                exact same grid cell (gridArea: '1/1'). The period always
                renders so it naturally sizes the cell — the triangle sits in
                that same space at the baseline. No guesswork on positioning.
                Clicking anywhere on this element triggers the reveal. */}
            <span
              onClick={!revealed ? () => setRevealed(true) : undefined}
              style={{ display: 'inline-grid', cursor: revealed ? 'default' : 'pointer' }}
            >
              {/* Period — hidden before reveal, fades in after */}
              <span style={{
                gridArea: '1/1',
                color: '#e11d48',
                opacity: revealed ? 1 : 0,
                transition: 'opacity 0.15s ease',
              }}>.</span>

              {/* Triangle arrow — visible before reveal, pulses to invite a click.
                  alignItems: flex-end pushes it to the bottom of the cell so it
                  sits at the baseline where the period would be. */}
              <span style={{
                gridArea: '1/1',
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'center',
                paddingBottom: '0.07em',
                opacity: revealed ? 0 : 1,
                transition: 'opacity 0.15s ease',
                animation: revealed ? 'none' : 'pulse-arrow 1.8s ease-in-out infinite',
                pointerEvents: revealed ? 'none' : 'auto',
              }}>
                {/* Pure CSS triangle using borders — no image or icon needed */}
                <span style={{
                  display: 'inline-block',
                  width: 0,
                  height: 0,
                  borderLeft: '0.11em solid transparent',
                  borderRight: '0.11em solid transparent',
                  borderBottom: '0.18em solid #e11d48',
                }} />
              </span>
            </span>
          </h1>

        </div>
      </div>

      {/* ── Revealed content ──────────────────────────────────────────────────
          Fades and slides up after the hero starts moving. The 0.35s delay
          lets the title shift begin first so the two animations feel staggered. */}
      <div
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(1.5rem)',
          transition: 'opacity 0.55s ease 0.35s, transform 0.55s ease 0.35s',
          pointerEvents: revealed ? 'auto' : 'none',
        }}
      >
        <div className="w-full max-w-lg mx-auto px-6 text-center pb-16">

          <p className="text-gray-400 text-xs uppercase mb-4" style={{ letterSpacing: '0.2em' }}>
            Make your case. Let the record show.
          </p>
          <p className="text-gray-500 text-sm mb-10">
            Record your speeches, challenge a friend, and let an AI judge decide who made the stronger case.
          </p>

          {/* Auth error message (e.g. email not on allowlist) */}
          {errorMessage && (
            <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm">
              {errorMessage}
            </div>
          )}

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white text-gray-900 font-semibold py-3 px-6 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {/* Google logo SVG — each path is one color of the Google G */}
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </button>

          <p className="text-gray-600 text-xs mt-4">Access is invite-only.</p>
        </div>
      </div>

    </main>
  )
}

export default function LandingPage() {
  return (
    <Suspense>
      <LandingPageInner />
    </Suspense>
  )
}
