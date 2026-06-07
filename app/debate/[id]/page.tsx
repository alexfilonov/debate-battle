'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { Debate, DebateParticipant, Speech } from '@/lib/supabase'
import SpeechRecorder from '@/components/SpeechRecorder'

// All the data we need to render the debate room
type DebateData = {
  debate: Debate
  participants: DebateParticipant[]
  speeches: Speech[]
  currentUserId: string
  currentSide: 'affirmative' | 'negative' | null
}

// The debate room page — shows the full debate flow from waiting → recording → judging.
// Polls every 5 seconds so the page updates automatically when the opponent joins or submits.
export default function DebateRoomPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [data, setData] = useState<DebateData | null>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [joiningError, setJoiningError] = useState<string | null>(null)

  // Fetch all debate data from Supabase
  const fetchData = useCallback(async () => {
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    // Fetch the debate, its participants, and all speeches in parallel
    const [debateRes, participantsRes, speechesRes] = await Promise.all([
      supabase.from('debates').select('*').eq('id', id).single(),
      supabase.from('debate_participants').select('*').eq('debate_id', id),
      supabase.from('speeches').select('*').eq('debate_id', id),
    ])

    if (debateRes.error || !debateRes.data) { router.push('/dashboard'); return }

    // Find this user's side in the debate
    const myParticipant = participantsRes.data?.find(p => p.user_id === user.id)

    setData({
      debate: debateRes.data,
      participants: participantsRes.data ?? [],
      speeches: speechesRes.data ?? [],
      currentUserId: user.id,
      currentSide: myParticipant?.side ?? null,
    })
    setLoading(false)
  }, [id, router])

  // Fetch on mount, then poll every 5 seconds for updates
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [fetchData])

  // Join the debate as the second participant (User 2)
  async function joinDebate() {
    setJoiningError(null)
    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !data) return

    // Find which side is already taken, assign the opposite
    const takenSide = data.participants[0]?.side
    const side = takenSide === 'affirmative' ? 'negative' : 'affirmative'

    const { error } = await supabase.from('debate_participants').insert({
      debate_id: id,
      user_id: user.id,
      side,
    })

    if (error) {
      setJoiningError('Failed to join debate. You may already be a participant.')
      return
    }

    // Update debate status to in_progress
    await supabase.from('debates').update({ status: 'in_progress' }).eq('id', id)
    fetchData()
  }

  // Called when a speech is successfully submitted — refresh to show updated state
  function handleSpeechSubmitted() {
    fetchData()
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">
        Loading debate...
      </div>
    )
  }

  if (!data) return null

  const { debate, participants, speeches, currentUserId, currentSide } = data

  // Determine what state the debate is in for this user
  const isMember = participants.some(p => p.user_id === currentUserId)
  const bothJoined = participants.length === 2
  const myRound1Speech = speeches.find(s => s.user_id === currentUserId && s.round === 1)
  const opponentParticipant = participants.find(p => p.user_id !== currentUserId)
  const opponentRound1Speech = speeches.find(s => s.user_id === opponentParticipant?.user_id && s.round === 1)
  const myRound2Speech = speeches.find(s => s.user_id === currentUserId && s.round === 2)
  const opponentRound2Speech = speeches.find(s => s.user_id === opponentParticipant?.user_id && s.round === 2)
  const bothRound1Done = !!myRound1Speech && !!opponentRound1Speech
  const bothRound2Done = !!myRound2Speech && !!opponentRound2Speech

  return (
    <div className="min-h-screen bg-gray-950 text-white">

      {/* Nav */}
      <nav className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white text-sm transition-colors">
          ← Dashboard
        </button>
        <span className="text-sm text-gray-500 uppercase tracking-wide">{debate.topic_area}</span>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-10">

        {/* Resolution */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl px-5 py-4 mb-8">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Resolution</p>
          <p className="text-white font-medium">{debate.resolution}</p>
        </div>

        {/* User's side badge */}
        {currentSide && (
          <div className="mb-8 flex items-center gap-2">
            <span className="text-sm text-gray-400">Your side:</span>
            <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
              currentSide === 'affirmative'
                ? 'bg-blue-900/40 text-blue-400 border border-blue-800'
                : 'bg-orange-900/40 text-orange-400 border border-orange-800'
            }`}>
              {currentSide === 'affirmative' ? 'Affirmative (FOR)' : 'Negative (AGAINST)'}
            </span>
          </div>
        )}

        {/* ── WAITING STATE: User 2 hasn't joined yet ── */}
        {debate.status === 'waiting' && (
          <div>
            {isMember ? (
              // User 1 sees invite link
              <div className="text-center py-10">
                <p className="text-gray-400 mb-6">Share this link with your opponent to start the debate.</p>
                <button
                  onClick={copyInviteLink}
                  className="bg-white text-gray-900 font-semibold px-6 py-3 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  {copied ? '✓ Copied!' : 'Copy Invite Link'}
                </button>
                <p className="text-gray-600 text-sm mt-6 animate-pulse">Waiting for opponent to join...</p>
              </div>
            ) : (
              // User 2 sees a join button
              <div className="text-center py-10">
                <p className="text-gray-300 mb-2 font-medium">You've been challenged to a debate!</p>
                <p className="text-gray-500 text-sm mb-8">
                  You'll be assigned the opposite side and can record your speech once you join.
                </p>
                {joiningError && (
                  <p className="text-red-400 text-sm mb-4">{joiningError}</p>
                )}
                <button
                  onClick={joinDebate}
                  className="bg-white text-gray-900 font-semibold px-6 py-3 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  Accept & Join Debate
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVE DEBATE STATE ── */}
        {(debate.status === 'in_progress' || debate.status === 'complete') && bothJoined && (
          <div className="flex flex-col gap-8">

            {/* Round 1: Opening speeches */}
            <section>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                Round 1 — Opening Speech
                {bothRound1Done && <span className="text-xs text-green-400 font-normal">✓ Both submitted</span>}
              </h2>

              {/* My opening speech */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Your speech</p>
                {myRound1Speech ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-300">
                    <p className="text-xs text-green-400 mb-2">✓ Submitted</p>
                    <p>{myRound1Speech.transcript}</p>
                  </div>
                ) : (
                  <SpeechRecorder
                    debateId={id}
                    round={1}
                    onSubmitted={handleSpeechSubmitted}
                  />
                )}
              </div>

              {/* Opponent's opening speech — only visible after both have submitted */}
              <div>
                <p className="text-sm text-gray-500 mb-2">Opponent's speech</p>
                {opponentRound1Speech ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-300">
                    <p>{opponentRound1Speech.transcript}</p>
                  </div>
                ) : (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-600 italic">
                    Waiting for opponent's speech...
                  </div>
                )}
              </div>
            </section>

            {/* Round 2: Rebuttals — only unlocked after both Round 1 speeches are in */}
            <section className={!bothRound1Done ? 'opacity-40 pointer-events-none' : ''}>
              <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
                Round 2 — Rebuttal
                {bothRound2Done && <span className="text-xs text-green-400 font-normal">✓ Both submitted</span>}
              </h2>
              {!bothRound1Done && (
                <p className="text-xs text-gray-600 mb-4">Unlocks after both opening speeches are submitted.</p>
              )}
              {bothRound1Done && (
                <p className="text-xs text-gray-500 mb-4">Read your opponent's speech above, then record your rebuttal.</p>
              )}

              {/* My rebuttal */}
              <div className="mb-4">
                <p className="text-sm text-gray-500 mb-2">Your rebuttal</p>
                {myRound2Speech ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-300">
                    <p className="text-xs text-green-400 mb-2">✓ Submitted</p>
                    <p>{myRound2Speech.transcript}</p>
                  </div>
                ) : (
                  <SpeechRecorder
                    debateId={id}
                    round={2}
                    onSubmitted={handleSpeechSubmitted}
                  />
                )}
              </div>

              {/* Opponent's rebuttal */}
              <div>
                <p className="text-sm text-gray-500 mb-2">Opponent's rebuttal</p>
                {opponentRound2Speech ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-300">
                    <p>{opponentRound2Speech.transcript}</p>
                  </div>
                ) : (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-sm text-gray-600 italic">
                    Waiting for opponent's rebuttal...
                  </div>
                )}
              </div>
            </section>

            {/* Judge button — appears after all 4 speeches are in */}
            {bothRound2Done && debate.status !== 'complete' && (
              <div className="text-center pt-4 border-t border-gray-800">
                <p className="text-gray-400 text-sm mb-4">All speeches submitted. Ready for the AI judge.</p>
                <button
                  onClick={() => router.push(`/debate/${id}/judge`)}
                  className="bg-white text-gray-900 font-semibold px-8 py-3 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  ⚖️ Get Judgment
                </button>
              </div>
            )}

            {/* If debate is complete, link to results */}
            {debate.status === 'complete' && (
              <div className="text-center pt-4 border-t border-gray-800">
                <button
                  onClick={() => router.push(`/debate/${id}/judge`)}
                  className="bg-white text-gray-900 font-semibold px-8 py-3 rounded-xl hover:bg-gray-100 transition-colors"
                >
                  View Results
                </button>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
