'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { LiveResult, LiveScores, LiveSideVerdict } from '@/lib/supabase'

// The five length-neutral criteria, in display order.
const CRITERIA: { key: keyof LiveScores; label: string }[] = [
  { key: 'argument', label: 'Argument' },
  { key: 'evidence', label: 'Evidence' },
  { key: 'responsiveness', label: 'Responsiveness' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'persuasiveness', label: 'Persuasiveness' },
]

// Verdict view for a one-phone (in-person) debate. There are no accounts for the
// two debaters — they're "Pro" and "Con", mapped from the diarized voices A/B.
export default function LiveVerdict({ result }: { result: LiveResult }) {
  const router = useRouter()
  const verdict = result.verdict

  // Degrade gracefully if the structured verdict is somehow missing.
  if (!verdict) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-4 text-center px-6">
        <p className="text-gray-400">This debate couldn&apos;t be scored.</p>
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white text-sm">
          ← Back to dashboard
        </button>
      </div>
    )
  }

  const winnerLabel = verdict.winner === 'pro' ? 'Pro wins' : 'Con wins'

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <button
          onClick={() => router.push('/dashboard')}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← Dashboard
        </button>
        <span className="text-sm text-gray-500 uppercase tracking-wide">Verdict</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-8">
        {/* Topic the judge inferred from the conversation */}
        <div className="text-center">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">They argued about</p>
          <p className="text-lg text-white font-medium">{result.inferred_topic ?? verdict.topic}</p>
        </div>

        {/* Winner banner + overall reasoning */}
        <div className="rounded-2xl border border-gray-700 bg-gray-900 px-6 py-8 text-center">
          <p className="text-4xl font-bold mb-2">{winnerLabel}</p>
          <p className="text-sm text-gray-400 leading-relaxed">{verdict.summary}</p>
        </div>

        {/* Per-side score panels */}
        <div className="flex flex-col gap-4">
          <SidePanel label="Pro" color="blue" side={verdict.pro} />
          <SidePanel label="Con" color="orange" side={verdict.con} />
        </div>

        {/* Diarized transcript (collapsed) */}
        <Transcript result={result} />

        <div className="text-center pt-2">
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

// One side's scores + feedback. `side.speaker` is the diarized voice (A/B).
function SidePanel({ label, color, side }: { label: string; color: 'blue' | 'orange'; side: LiveSideVerdict }) {
  const accent = color === 'blue' ? 'text-blue-400' : 'text-orange-400'
  const barColor = color === 'blue' ? 'bg-blue-500' : 'bg-orange-500'
  const total = CRITERIA.reduce((s, c) => s + (side.scores[c.key] ?? 0), 0)

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <p className={`text-sm font-semibold ${accent}`}>{label}</p>
        <p className="text-xs text-gray-500">Voice {side.speaker} · {total}/50</p>
      </div>

      <div className="flex flex-col gap-3">
        {CRITERIA.map((c) => {
          const v = side.scores[c.key] ?? 0
          return (
            <div key={c.key}>
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>{c.label}</span>
                <span>{v}</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${barColor}`} style={{ width: `${v * 10}%` }} />
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-sm text-gray-300 leading-relaxed mt-4">{side.feedback}</p>
    </div>
  )
}

// Collapsible diarized transcript, so users can see who said what.
function Transcript({ result }: { result: LiveResult }) {
  const [open, setOpen] = useState(false)
  if (!result.transcript || result.transcript.length === 0) return null

  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-xs text-gray-500 uppercase tracking-wide flex items-center gap-1 hover:text-gray-300 transition-colors"
      >
        {open ? '▾' : '▸'} Transcript
      </button>
      {open && (
        <div className="mt-3 bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 flex flex-col gap-2 text-sm">
          {result.transcript.map((seg, i) => (
            <p key={i} className="text-gray-300">
              <span className="text-gray-500">Voice {seg.speaker}:</span> {seg.text}
            </p>
          ))}
        </div>
      )}
    </section>
  )
}
