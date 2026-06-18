'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

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

const QUEUE_KEY = 'debatable_queue'
const INDEX_KEY = 'debatable_index'

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

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

function LandingPageInner() {
  const [loading, setLoading] = useState(false)
  const [question, setQuestion] = useState<string | null>(null)
  const [displayedChars, setDisplayedChars] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [scrollUnlocked, setScrollUnlocked] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (!revealed) return
    const t = setTimeout(() => setScrollUnlocked(true), 950)
    return () => clearTimeout(t)
  }, [revealed])

  useEffect(() => {
    setQuestion(getNextQuestion())
  }, [])

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

  const urlError = searchParams.get('error')
  let errorMessage: string | null = null
  if (urlError === 'not_allowed') errorMessage = 'Your email is not on the access list.'
  else if (urlError === 'auth_failed') errorMessage = 'Sign in failed. Please try again.'
  else if (urlError === 'missing_code') errorMessage = 'Something went wrong. Please try again.'

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
      style={{ minHeight: '100vh', maxHeight: scrollUnlocked ? 'none' : '100vh', background: 'var(--color-base)', color: 'var(--color-text)' }}
    >

      {/* Hero group — floats up on reveal by animating paddingTop */}
      <div
        style={{
          paddingTop: revealed ? 'calc(50vh - 220px)' : 'calc(50vh - 110px)',
          paddingBottom: revealed ? '2.5rem' : '0',
          transition: 'padding 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        <div className="w-full text-center px-6">

          {/* Rotating question — always in DOM to prevent title from shifting */}
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
              {question && (
                <span style={{
                  animation: displayedChars >= question.length ? 'cursor-blink 1s step-end infinite' : 'none',
                  color: 'var(--color-text-muted)',
                  marginLeft: '1px',
                }}>|</span>
              )}
            </p>
          </div>

          {/* Title */}
          <h1
            className="leading-none"
            style={{
              fontFamily: 'var(--font-bebas)',
              fontSize: 'clamp(3.5rem, 12vw, 8rem)',
              display: 'block',
              lineHeight: 1,
            }}
          >
            debatable

            {/* Period + triangle — outside gradient span so they render white */}
            <span
              onClick={!revealed ? () => setRevealed(true) : undefined}
              style={{ display: 'inline-grid', cursor: revealed ? 'default' : 'pointer', verticalAlign: 'baseline' }}
            >
              {/* Period */}
              <span style={{
                gridArea: '1/1',
                opacity: revealed ? 1 : 0,
                transition: 'opacity 0.15s ease',
                color: 'var(--color-verdict)',
                fontFamily: 'var(--font-bebas)',
              }}>.</span>

              {/* Triangle */}
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

      {/* Revealed content — fades in after hero starts moving */}
      <div
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? 'translateY(0)' : 'translateY(1.5rem)',
          transition: 'opacity 0.55s ease 0.35s, transform 0.55s ease 0.35s',
          pointerEvents: revealed ? 'auto' : 'none',
        }}
      >
        <div className="w-full max-w-lg mx-auto px-6 text-center pb-16">

          <p className="text-xs uppercase mb-4" style={{ letterSpacing: '0.2em', color: 'var(--color-text-muted)' }}>
            Make your case. Let the record show.
          </p>
          <p className="text-sm mb-10" style={{ color: 'var(--color-text-muted)' }}>
            Record your speeches, challenge a friend, and let an AI judge decide who made the stronger case.
          </p>

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
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Signing in...' : 'Sign in with Google'}
          </button>

          <p className="text-xs mt-4" style={{ color: 'var(--color-text-subtle)' }}>Access is invite-only.</p>
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
