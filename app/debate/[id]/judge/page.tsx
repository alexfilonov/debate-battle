'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { Judgement, ClashPoint, ClashResponse, SideAnalysis, Side, LiveResult } from '@/lib/supabase'
import LiveVerdict from '@/components/LiveVerdict'

type PageState = 'loading' | 'judging' | 'done' | 'error'

// The judge page has two jobs:
// 1. Trigger the AI judging if it hasn't happened yet (calls /api/judge)
// 2. Display the verdict dashboard — winner, scores, clash map, and feedback
export default function JudgePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [pageState, setPageState] = useState<PageState>('loading')
  const [judgement, setJudgement] = useState<Judgement | null>(null)
  const [myFeedback, setMyFeedback] = useState<string>('')
  const [mySide, setMySide] = useState<Side | null>(null)
  const [iWon, setIWon] = useState<boolean | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [liveResult, setLiveResult] = useState<LiveResult | null>(null)

  useEffect(() => {
    async function loadOrJudge() {
      const supabase = createSupabaseBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/'); return }

      // One-phone debates are judged at creation and have no participants or
      // judgements row — load their result and render the live verdict instead.
      const { data: debate } = await supabase
        .from('debates')
        .select('format')
        .eq('id', id)
        .single()

      if (debate?.format === 'one_phone') {
        const { data: lr } = await supabase
          .from('live_results')
          .select('*')
          .eq('debate_id', id)
          .single()
        if (lr) {
          setLiveResult(lr as LiveResult)
          setPageState('done')
          return
        }
        setErrorMsg('Result not found.')
        setPageState('error')
        return
      }

      // Find this user's side in the debate
      const { data: participant } = await supabase
        .from('debate_participants')
        .select('side')
        .eq('debate_id', id)
        .eq('user_id', user.id)
        .single()

      const side = (participant?.side ?? null) as Side | null

      // Check if a judgement already exists (e.g. opponent triggered it first)
      const { data: existing } = await supabase
        .from('judgements')
        .select('*')
        .eq('debate_id', id)
        .single()

      if (existing) {
        displayResult(existing, side)
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
      displayResult(newJudgement, side)
    }

    // Populate state from a judgement record + the user's side
    function displayResult(j: Judgement, side: Side | null) {
      setJudgement(j)
      setMySide(side)

      if (side) {
        // Show the narrative feedback written for this user's side
        setMyFeedback(side === 'affirmative' ? j.affirmative_feedback : j.negative_feedback)
        setIWon(j.winner === side)
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

  // One-phone (in-person) verdict — rendered from live_results, not judgements.
  if (liveResult) return <LiveVerdict result={liveResult} />

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

  // The structured analysis written for the current user's side (if any)
  const myAnalysis =
    mySide === 'affirmative' ? judgement.aff_analysis :
    mySide === 'negative'    ? judgement.neg_analysis : null

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
          <p className="text-sm opacity-70">The {judgement.winner} side wins this debate</p>
        </div>

        {/* Judge's reasoning — why they picked this winner */}
        <section>
          <h2 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Judge's Reasoning</h2>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-gray-300 text-sm leading-relaxed">
            {judgement.reasoning}
          </div>
        </section>

        {/* Category score bar chart */}
        <ScoreChart judgement={judgement} />

        {/* Clash map — each side's points + how the opponent answered them */}
        <ClashMap judgement={judgement} />

        {/* Personalized feedback for this user */}
        {(myFeedback || myAnalysis) && (
          <section>
            <h2 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Your Feedback</h2>
            <div className="flex flex-col gap-3">
              {myFeedback && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-gray-300 text-sm leading-relaxed">
                  {myFeedback}
                </div>
              )}
              <FeedbackPanel analysis={myAnalysis} />
            </div>
          </section>
        )}

        {/* Both sides' feedback (collapsed under a toggle) */}
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

// ── Dashboard components ──────────────────────────────────────────

// Horizontal bar chart of the 1-10 scores per dimension for both sides.
// Renders nothing for older judgements that predate scoring.
function ScoreChart({ judgement }: { judgement: Judgement }) {
  if (judgement.aff_argumentation == null) return null

  const rows = [
    { label: 'Argumentation', aff: judgement.aff_argumentation, neg: judgement.neg_argumentation },
    { label: 'Evidence', aff: judgement.aff_evidence, neg: judgement.neg_evidence },
    { label: 'Rebuttal', aff: judgement.aff_rebuttal, neg: judgement.neg_rebuttal },
  ]
  const affTotal = rows.reduce((s, r) => s + (r.aff ?? 0), 0)
  const negTotal = rows.reduce((s, r) => s + (r.neg ?? 0), 0)

  // A single bar: filled to value/10 of the width, with the number beside it.
  const bar = (value: number | null, color: string) => (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${(value ?? 0) * 10}%` }} />
      </div>
      <span className="w-4 text-right text-xs text-gray-300">{value}</span>
    </div>
  )

  return (
    <section>
      <h2 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Scores</h2>
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex flex-col gap-4">
        {/* Legend with totals */}
        <div className="flex gap-4 text-xs">
          <span className="text-blue-400">● Affirmative · {affTotal}/30</span>
          <span className="text-orange-400">● Negative · {negTotal}/30</span>
        </div>

        {rows.map((r) => (
          <div key={r.label}>
            <p className="text-xs text-gray-400 mb-1.5">{r.label}</p>
            <div className="flex flex-col gap-1.5">
              {bar(r.aff, 'bg-blue-500')}
              {bar(r.neg, 'bg-orange-500')}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// Badge styling per clash status, labeled from the POINT-MAKER's perspective:
// a dropped point stood unanswered (good for the maker); a refuted point fell.
const RESPONSE_META: Record<ClashResponse, { label: string; badge: string }> = {
  dropped: { label: 'Unanswered', badge: 'bg-green-900/40 text-green-300 border-green-800' },
  partial: { label: 'Partly answered', badge: 'bg-yellow-900/40 text-yellow-300 border-yellow-800' },
  refuted: { label: 'Refuted', badge: 'bg-red-900/40 text-red-300 border-red-800' },
}

// Clash map: each side's arguments and how well the opponent answered them,
// plus a small scoreboard. Renders nothing if the judgement has no points.
function ClashMap({ judgement }: { judgement: Judgement }) {
  if (!judgement.aff_points && !judgement.neg_points) return null

  return (
    <section>
      <h2 className="text-xs text-gray-500 uppercase tracking-wide mb-3">Clash Map</h2>
      <div className="flex flex-col gap-4">
        <SidePoints label="Affirmative" color="text-blue-400" points={judgement.aff_points} />
        <SidePoints label="Negative" color="text-orange-400" points={judgement.neg_points} />
      </div>
    </section>
  )
}

// One side's points with status badges + a scoreboard line.
function SidePoints({ label, color, points }: { label: string; color: string; points: ClashPoint[] | null }) {
  if (!points || points.length === 0) return null

  // Scoreboard counts by response status.
  const counts = { refuted: 0, partial: 0, dropped: 0 }
  points.forEach((p) => { if (p.response in counts) counts[p.response] += 1 })

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <p className={`text-sm font-semibold ${color}`}>{`${label}'s points`}</p>
        <p className="text-xs text-gray-500 text-right">
          {points.length} raised · {counts.dropped} unanswered · {counts.refuted} refuted
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {points.map((p, i) => {
          const meta = RESPONSE_META[p.response] ?? RESPONSE_META.partial
          return (
            <div key={i} className="text-sm">
              <div className="flex items-start justify-between gap-3">
                <span className="text-gray-200">{p.point}</span>
                <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border ${meta.badge}`}>
                  {meta.label}
                </span>
              </div>
              {p.note && <p className="text-xs text-gray-500 mt-1">{p.note}</p>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Strength / growth area / concrete suggestions for one debater.
function FeedbackPanel({ analysis }: { analysis: SideAnalysis | null }) {
  if (!analysis) return null

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex flex-col gap-3 text-sm">
      <div>
        <p className="text-xs text-green-400 uppercase tracking-wide mb-1">Strength</p>
        <p className="text-gray-300">{analysis.strength}</p>
      </div>
      <div>
        <p className="text-xs text-yellow-400 uppercase tracking-wide mb-1">Work on</p>
        <p className="text-gray-300">{analysis.growth}</p>
      </div>
      {analysis.suggestions?.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">How to strengthen it</p>
          <ul className="list-disc list-inside text-gray-300 flex flex-col gap-1">
            {analysis.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      )}
    </div>
  )
}

// Collapsible section showing both sides' full feedback — useful when reviewing.
function FullFeedback({ judgement }: { judgement: Judgement }) {
  const [open, setOpen] = useState(false)

  return (
    <section>
      <button
        onClick={() => setOpen(o => !o)}
        className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1 hover:text-gray-300 transition-colors"
      >
        {open ? '▾' : '▸'} Full Feedback (both sides)
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-xs text-blue-400">Affirmative</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-gray-300 text-sm leading-relaxed">
              {judgement.affirmative_feedback}
            </div>
            <FeedbackPanel analysis={judgement.aff_analysis} />
          </div>
          <div className="flex flex-col gap-2">
            <p className="text-xs text-orange-400">Negative</p>
            <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 text-gray-300 text-sm leading-relaxed">
              {judgement.negative_feedback}
            </div>
            <FeedbackPanel analysis={judgement.neg_analysis} />
          </div>
        </div>
      )}
    </section>
  )
}
