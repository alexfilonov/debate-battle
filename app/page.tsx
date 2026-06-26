'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import ScrollVelocity from '@/components/ScrollVelocity'


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

  // Food
  'Is a wrap just a scared taco?',
  'Is ketchup a smoothie?',
  'Is a banana a berry but a strawberry isn\'t?',
  'Should you eat the pizza crust?',
  'Is ranch dressing acceptable on pizza?',
  'Is a pickle just a cucumber that went through something?',
  'Should you wash fruit before eating it?',
  'Is cereal a valid dinner?',
  'Is eating cold pizza for breakfast a sign of good character?',
  'Can you put ketchup on a steak?',
  'Is sparkling water just angry water?',
  'Is a Mcflurry just a milkshake that went to college?',
  'Is soup just hot water that got too involved?',

  // Relationships & Social
  'Is it cheating if it\'s in a dream?',
  'Should you tell your friend their partner is ugly?',
  'Is ghosting ever morally defensible?',
  'Is it rude to not laugh at someone\'s joke even if it\'s bad?',
  'Should you correct a stranger\'s grammar?',
  'Is being bad at texting a red flag?',
  'Is it okay to snoop through your partner\'s phone?',
  'Should you tell someone they have food in their teeth?',
  'Is it wrong to rate your Uber driver less than 5 stars?',
  'Is venting to a friend just making your problems their problems?',
  'Should you tell someone their baby is ugly?',
  'Is canceling plans the highest form of self-care?',

  // Pop culture & media
  'Was Breaking Bad better than The Sopranos?',
  'Is Taylor Swift overrated?',
  'Is Marvel ruining cinema?',
  'Was Lost good or just confusing?',
  'Is anime just cartoons for adults who won\'t admit it?',
  'Is TikTok just Vine for people with shorter attention spans?',
  'Is LinkedIn just Facebook for people ashamed of Facebook?',
  'Are podcasts just radio for people who think they\'re better than radio?',
  'Is a reboot ever better than the original?',
  'Was Shrek a cinematic masterpiece?',
  'Is astrology just horoscopes with better branding?',
  'Is true crime just gossip with a documentary budget?',

  // Modern life
  'Is working from home making us worse at being people?',
  'Is a side hustle just a second job with better PR?',
  'Is therapy just paying someone to be your friend?',
  'Are morning people just annoying?',
  'Is skipping the gym once a slippery slope?',
  'Should you wash your jeans?',
  'Is it okay to wear socks with sandals unironically?',
  'Is it rude to eat someone else\'s clearly labeled food from the fridge?',
  'Should you flush in the middle of the night?',
  'Is lying about your age online just personal branding?',
  'Is "I\'m an introvert" just an excuse?',
  'Should you tip for counter service?',
  'Is the five-second rule scientifically valid?',

  // Big and spicy
  'Is democracy overrated?',
  'Was colonialism the worst thing to happen to cuisine? (it improved it)',
  'Is capitalism just organized chaos we agreed to like?',
  'Are participation trophies ruining a generation?',
  'Is cancel culture just accountability with bad PR?',
  'Is college worth the debt?',
  'Should voting be mandatory?',
  'Is it ever okay to lie to a child about Santa?',
  'Is working hard overrated?',
  'Is it ethical to have kids in 2025?',
  'Is it okay to recline your airplane seat immediately?',
  'Are zoos ethical?',
  'Is eating meat morally defensible?',

  // Political
  'Is the two-party system just two bad options with better logos?',
  'Is free speech absolutism just a cover for saying awful things?',
  'Should billionaires exist?',
  'Is the Electoral College still defensible?',
  'Was Edward Snowden a hero or a traitor?',
  'Should the voting age be lowered to 16?',
  'Is universal basic income a utopia or a disaster?',
  'Should the rich pay more taxes or just pay their existing taxes?',
  'Is the media more biased left or right?',
  'Was the Iraq War the biggest foreign policy blunder in modern history?',
  'Should term limits apply to the Supreme Court?',
  'Is political correctness free speech in disguise?',
  'Should social media companies moderate political speech?',
  'Is the UN actually useful?',
  'Should drugs be decriminalized?',
  'Is NATO still relevant?',
  'Was Churchill a hero or a villain?',
  'Should the government control healthcare?',
  'Is open borders a realistic policy?',
  'Is affirmative action fair?',
  'Should felons be allowed to vote?',
  'Is nuclear energy the only realistic path to clean energy?',
  'Was the American Revolution just a tax dispute with good PR?',
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

  // Staggered content reveal: animate each element below the title in sequence
  // when the arrow is clicked, instead of fading the whole block at once.
  useEffect(() => {
    if (!revealed) return
    import('animejs').then(({ animate, utils }) => {
      animate('.reveal-item', {
        opacity: [0, 1],

        delay: utils.stagger(110, { start: 320 }),
        ease: 'easeOutCubic',
        duration: 480,
      })
    })
  }, [revealed])

  // Typewriter effect: reveal one character every 18ms until the full question is shown.
  useEffect(() => {
    if (!question) return
    setDisplayedChars(0)
    let chars = 0
    const interval = setInterval(() => {
      chars++
      setDisplayedChars(chars)
      if (chars >= question.length) clearInterval(interval)
    }, 18)
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
      className="overflow-hidden"
      // Cap height to the viewport before the arrow is clicked so the hidden
      // revealed content (below the fold) can't be scrolled to early.
      // Uses CSS color tokens so the theme can be updated from globals.css.
      style={{ minHeight: '100vh', maxHeight: scrollUnlocked ? 'none' : '100vh', background: 'var(--color-base)', color: 'var(--color-text)' }}
    >

      {/* ── Hero section ──────────────────────────────────────────────────────
          Title is vertically centered before reveal. paddingTop shrinks on
          reveal to float the title upward. Scroll bands are position:absolute
          so they never affect layout — no height animation, no bounce. */}
      <div
        style={{
          paddingTop: revealed ? 'calc(50vh - 200px)' : 'calc(50vh - 100px)',
          paddingBottom: revealed ? '2.5rem' : '0',
          transition: 'padding 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="w-full text-center px-6">

          {/* Rotating question — fades out on reveal */}
          <div className="mb-3">
            <p style={{
              fontFamily: 'var(--font-playfair)',
              fontStyle: 'italic',
              fontSize: 'clamp(1rem, 2.5vw, 1.2rem)',
              color: 'var(--color-text-muted)',
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
                  color: 'var(--color-text-muted)',
                  marginLeft: '1px',
                }}>|</span>
              )}
            </p>
          </div>

          {/* App title — position:relative so the scroll band can anchor to it */}
          <div style={{ position: 'relative', display: 'inline-block' }}>

            {/* Scroll band running through the vertical center of the title.
                position:absolute removes it from flow so it never shifts the title.
                z-index:0 puts it behind the h1 (z-index:1). Always visible. */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '100vw',
              zIndex: 0,
              opacity: revealed ? 1 : 0,
              transition: 'opacity 0.6s ease 0.2s',
              pointerEvents: 'none',
            }}>
              <ScrollVelocity
                text={QUESTIONS.join('  ·  ')}
                velocity={-55}
                textStyle={{
                  fontFamily: 'var(--font-bebas)',
                  fontSize: 'clamp(1.4rem, 3.5vw, 2rem)',
                  color: 'var(--color-text-muted)',
                  letterSpacing: '0.05em',
                }}
              />
            </div>

            <h1
              className="leading-none"
              style={{
                fontFamily: 'var(--font-bebas)',
                fontSize: 'clamp(3.5rem, 12vw, 8rem)',
                lineHeight: 1,
                display: 'block',
                position: 'relative',
                zIndex: 1,
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
                style={{ display: 'inline-grid', cursor: revealed ? 'default' : 'pointer', verticalAlign: 'baseline' }}
              >
                {/* Period — hidden before reveal, fades in after */}
                <span style={{
                  gridArea: '1/1',
                  color: 'var(--color-verdict)',
                  opacity: revealed ? 1 : 0,
                  transition: 'opacity 0.15s ease',
                  fontFamily: 'var(--font-bebas)',
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
                  {/* clipPath triangle — cleaner than the CSS border trick */}
                  <span style={{
                    display: 'inline-block',
                    width: '0.22em',
                    height: '0.18em',
                    background: 'var(--color-verdict)',
                    clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
                  }} />
                </span>
              </span>
            </h1>

          </div>
        </div>
      </div>

      {/* ── Revealed content ──────────────────────────────────────────────────
          Wrapper just controls pointer events. Each child animates in
          independently via Anime.js stagger when revealed becomes true. */}
      <div style={{ pointerEvents: revealed ? 'auto' : 'none' }}>
        <div className="w-full max-w-lg mx-auto px-6 text-center pb-16" style={{ paddingTop: '0' }}>

          {/* Auth error message (e.g. email not on allowlist) */}
          {errorMessage && (
            <div className="reveal-item bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm" style={{ opacity: 0 }}>
              {errorMessage}
            </div>
          )}

          <button
            onClick={handleSignIn}
            disabled={loading}
            className="reveal-item w-full py-2.5 rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              opacity: 0,
              background: 'transparent',
              border: '1px solid #3f3f3f',
              color: '#9a9a9a',
              fontFamily: 'var(--font-bebas)',
              fontSize: 'clamp(1.1rem, 2.5vw, 1.4rem)',
              letterSpacing: '0.18em',
              transition: 'border-color 0.2s ease, color 0.2s ease',
            }}
            onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLButtonElement).style.borderColor = '#6b6b6b'; (e.currentTarget as HTMLButtonElement).style.color = '#d4d4d4' } }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = '#3f3f3f'; (e.currentTarget as HTMLButtonElement).style.color = '#9a9a9a' }}
          >
            {loading ? 'Hang on...' : 'You in?'}
          </button>

          <p className="reveal-item text-xs mt-3" style={{ color: 'var(--color-text-subtle)', opacity: 0, letterSpacing: '0.1em' }}>via Google · invite only</p>
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
