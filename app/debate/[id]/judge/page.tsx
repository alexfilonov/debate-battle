'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { Judgement } from '@/lib/supabase'

type PageState = 'loading' | 'judging' | 'done' | 'error'

// The judge page has two jobs:
// 1. Trigger the AI judging if it hasn't happened yet (calls /api/judge)
// 2. Display the verdict — winner, reasoning, and the current user's personal feedback
export default function JudgePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [judgement, setJudgement] = useState<Judgement | null>(null)
  const [myFeedback, setMyFeedback] = useState<string>('')
  const [iWon, setIWon] = useState<boolean | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    async function loadOrJudge() {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      // Find this user's side in the debate
      const { data: participant } = await supabase
        .from('debate_participants')
        .select('side')
        .eq('debate_id', id)
        .eq('user_id', user.id)
        .single()

      const mySide = participant?.side ?? null

      // Check if a judgement already exists (e.g. opponent triggered it first)
      const { data: existing } = await supabase
        .from('judgements')
        .select('*')
        .eq('debate_id', id)
        .single()

      if (existing) {
        displayResult(existing, mySide)
        return
      }

      // No judgement yet — call the judge API
      setPageState('judging')

      const res = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debateId: id }),
      })

      if (!res.ok) {
        setErrorMsg('Failed to generate judgment. Please try again.')
        setPageState('error')
        return
      }

      const { judgement: newJudgement } = await res.json()
      displayResult(newJudgement, mySide)
    }

    // Populate state from a judgement record + the user's side
    function displayResult(j: Judgement, mySide: string | null) {
      setJudgement(j)

      if (mySide) {
        // Show the feedback written specifically for this user's side
        setMyFeedback(
          mySide === 'affirmative' ? j.affirmative_feedback : j.negative_feedback
        )
        setIWon(j.winner === mySide)
      }

      setPageState('done')
    }

    loadOrJudge()
  }, [id, router])

  // ── Loading states ──────────────────────────────────────────────

  if (pageState === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Loading...
      </div>
    )
  }

  if (pageState === 'judging') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 text-center px-6">
        {/* Pulsing animation while Claude is thinking */}
        <div className="w-12 h-12 rounded-full border-2 border-white border-t-transparent animate-spin" />
        <p className="text-white font-semibold text-lg">Deliberating...</p>
        <p className="text-gray-500 text-sm max-w-sm">
          The AI judge is reviewing all speeches and preparing its verdict.
        </p>
      </div>
    )
  }

  if (pageState === 'error') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-red-400 font-semibold">{errorMsg}</p>
        <button
          onClick={() => router.push(`/debate/${id}`)}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Back to debate
        </button>
      </div>
    )
  }

  if (!judgement) return null

  // ── Verdict ─────────────────────────────────────────────────────

  // iWon is null if the current user isn't a participant (e.g. spectator)
  const outcomeLabel =
    iWon === true  ? 'You won' :
    iWon === false ? 'You lost' :
    `${judgement.winner.charAt(0).toUpperCase() + judgement.winner.slice(1)} wins`

  const outcomeStyles =
    iWon === true  ? 'text-green-400 border-green-800 bg-green-900/20' :
    iWon === false ? 'text-red-400 border-red-800 bg-red-900/20' :
                    'text-white border-gray-700 bg-gray-900'

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => router.push(`/debate/${id}`)}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Back to debate
        </button>
        <span className="text-sm text-gray-500 uppercase tracking-wide">Verdict</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">

        {/* Winner banner */}
        <div className={`rounded-2xl border px-6 py-8 text-center ${outcomeStyles}`}>
          <p className="text-4xl font-bold mb-2">{outcomeLabel}</p>
          <p className="text-sm opacity-70">
            The {judgement.winner} side wins this debate
          </p>
        </div>

        {/* Per-category score breakdown */}
        <ScoreBreakdown judgement={judgement} />

        {/* Judge's reasoning — why they picked this winner */}
        <section>
          <h2 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Judge's Reasoning</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-gray-300 text-sm leading-relaxed">
            {judgement.reasoning}
          </div>
        </section>

        {/* Personalized feedback for this user */}
        {myFeedback && (
          <section>
            <h2 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Your Feedback</h2>
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-gray-300 text-sm leading-relaxed">
              {myFeedback}
            </div>
          </section>
        )}

        {/* Feedback for both sides (collapsed under a toggle) */}
        <FullFeedback judgement={judgement} />

        {/* CTA back to dashboard */}
        <div className="text-center pt-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-white text-gray-900 font-semibold px-8 py-3 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Back to Dashboard
          </button>
        </div>

      </main>
    </div>
  )
}

// Per-category score comparison (1-10 per dimension for each side) with totals.
// Renders nothing for older judgements that predate the scores feature.
function ScoreBreakdown({ judgement }: { judgement: Judgement }) {
  // Scores are all set together, so checking one is enough to know they exist.
  if (judgement.aff_argumentation == null) return null

  // One row per scoring dimension, pulling the matching pair of columns.
  const rows = [
    { label: 'Argumentation', aff: judgement.aff_argumentation, neg: judgement.neg_argumentation },
    { label: 'Evidence', aff: judgement.aff_evidence, neg: judgement.neg_evidence },
    { label: 'Rebuttal', aff: judgement.aff_rebuttal, neg: judgement.neg_rebuttal },
  ]
  const affTotal = rows.reduce((sum, r) => sum + (r.aff ?? 0), 0)
  const negTotal = rows.reduce((sum, r) => sum + (r.neg ?? 0), 0)

  // Render a score, bold green when it's the higher of the two for that row.
  const cell = (value: number | null, isHigher: boolean) => (
    <span className={`text-right ${isHigher ? 'font-bold text-green-400' : 'text-gray-300'}`}>
      {value}
    </span>
  )

  return (
    <section>
      <h2 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Scores</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
        {/* Column headers */}
        <div className="grid grid-cols-[1fr_6rem_6rem] text-xs uppercase tracking-wide mb-3">
          <span />
          <span className="text-blue-400 text-right">Affirmative</span>
          <span className="text-orange-400 text-right">Negative</span>
        </div>

        {/* One row per dimension */}
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-[1fr_6rem_6rem] text-sm py-1.5">
            <span className="text-gray-400">{r.label}</span>
            {cell(r.aff, (r.aff ?? 0) > (r.neg ?? 0))}
            {cell(r.neg, (r.neg ?? 0) > (r.aff ?? 0))}
          </div>
        ))}

        {/* Totals */}
        <div className="grid grid-cols-[1fr_6rem_6rem] text-sm pt-3 mt-2 border-t border-gray-800 font-semibold">
          <span className="text-gray-300">Total</span>
          {cell(affTotal, affTotal > negTotal)}
          {cell(negTotal, negTotal > affTotal)}
        </div>
      </div>
    </section>
  )
}

// Collapsible section showing both sides' feedback — useful when reviewing a debate
function FullFeedback({ judgement }: { judgement: Judgement }) {
  const [open, setOpen] = useState(false)

  return (
    <section>
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1 hover:text-gray-300 transition-colors"
      >
        {open ? '▾' : '▸'} Full Feedback
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <p className="text-xs text-blue-400 mb-2">Affirmative</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-gray-300 text-sm leading-relaxed">
              {judgement.affirmative_feedback}
            </div>
          </div>
          <div>
            <p className="text-xs text-orange-400 mb-2">Negative</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-gray-300 text-sm leading-relaxed">
              {judgement.negative_feedback}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
