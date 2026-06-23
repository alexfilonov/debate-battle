'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

// Fixed list of topic areas users can choose from
const TOPIC_AREAS = [
  'U.S. Politics',
  'International Politics',
  'Economics',
  'Technology',
  'Science',
  'Philosophy',
  'Sports',
  'Culture',
]

// The new debate page walks the user through up to 4 steps:
// 1. Choose a format (two phones → continue here; one phone → /debate/live)
// 2. Pick a topic area
// 3. Pick or write a resolution
// 4. Pick a side (or get randomly assigned)
//
// One-phone (in-person) mode is a different flow entirely — it has no topic,
// resolution, or side — so step 1 routes there and the rest of this page is the
// original two-phone structured flow, unchanged apart from being renumbered.
export default function NewDebatePage() {
  const router = useRouter()

  // Track which step the user is on
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)

  // Form state
  const [selectedTopic, setSelectedTopic] = useState('')
  const [resolutions, setResolutions] = useState<string[]>([])
  const [selectedResolution, setSelectedResolution] = useState('')
  const [customResolution, setCustomResolution] = useState('')
  const [selectedSide, setSelectedSide] = useState<'affirmative' | 'negative' | 'random'>('random')

  // Loading and error states
  const [loadingResolutions, setLoadingResolutions] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Step 1: choose a format. One-phone is its own flow on a separate route;
  // two-phone continues through the topic/resolution/side steps below.
  function handleFormatSelect(format: 'two-phones' | 'one-phone') {
    if (format === 'one-phone') {
      router.push('/debate/live')
      return
    }
    setStep(2)
  }

  // Step 2 → 3: user picks a topic, we fetch resolutions from Claude
  async function handleTopicSelect(topic: string) {
    setSelectedTopic(topic)
    setLoadingResolutions(true)
    setError(null)

    try {
      // Call our API route which asks Claude to generate 5 resolutions
      const res = await fetch('/api/resolutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topicArea: topic }),
      })

      if (!res.ok) throw new Error('Failed to generate resolutions')

      const { resolutions } = await res.json()
      setResolutions(resolutions)
      setStep(3)
    } catch {
      setError('Failed to generate resolutions. Please try again.')
    } finally {
      setLoadingResolutions(false)
    }
  }

  // Step 3 → 4: user picks or writes a resolution
  function handleResolutionSelect(resolution: string) {
    setSelectedResolution(resolution)
    setCustomResolution('')
    setStep(4)
  }

  function handleCustomResolutionSubmit() {
    if (!customResolution.trim()) return
    setSelectedResolution(customResolution.trim())
    setStep(4)
  }

  // Step 4: create the debate in Supabase and redirect to the debate room
  async function handleCreateDebate() {
    setCreating(true)
    setError(null)

    const supabase = createSupabaseBrowserClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    // Randomly assign a side if the user chose "random"
    const side = selectedSide === 'random'
      ? (Math.random() > 0.5 ? 'affirmative' : 'negative')
      : selectedSide

    // Insert the debate into the database (format defaults to 'two_phone')
    const { data: debate, error: debateError } = await supabase
      .from('debates')
      .insert({
        topic_area: selectedTopic,
        resolution: selectedResolution,
        status: 'waiting',
        created_by: user.id,
      })
      .select()
      .single()

    if (debateError || !debate) {
      setError('Failed to create debate. Please try again.')
      setCreating(false)
      return
    }

    // Add the creator as a participant with their assigned side
    const { error: participantError } = await supabase
      .from('debate_participants')
      .insert({
        debate_id: debate.id,
        user_id: user.id,
        side,
      })

    if (participantError) {
      setError('Failed to join debate. Please try again.')
      setCreating(false)
      return
    }

    // Success — go to the debate room
    router.push(`/debate/${debate.id}`)
  }

  const finalResolution = selectedResolution || customResolution

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-2xl mx-auto">

        {/* Back button */}
        <button
          onClick={() => step === 1 ? router.push('/dashboard') : setStep((step - 1) as 1 | 2 | 3 | 4)}
          className="text-gray-500 hover:text-white text-sm mb-8 flex items-center gap-1 transition-colors"
        >
          ← Back
        </button>

        {/* Step indicator — 4 segments, one per step */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                s <= step ? 'bg-white' : 'bg-gray-800'
              }`}
            />
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 mb-6 text-sm">
            {error}
          </div>
        )}

        {/* ── Step 1: Choose battle format ── */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold mb-2">How do you want to debate?</h1>
            <p className="text-gray-400 mb-8">Pick the format that fits your situation.</p>

            <div className="flex flex-col gap-3">

              {/* Two phones — the original async, structured flow */}
              <button
                onClick={() => handleFormatSelect('two-phones')}
                className="border border-gray-800 bg-gray-900 hover:bg-gray-800 rounded-xl p-5 text-left transition-colors"
              >
                <div className="font-semibold text-white mb-1">Two Phones</div>
                <div className="text-sm text-gray-400">
                  Pick a topic and share a link. Each person records timed opening and
                  rebuttal speeches on their own device, whenever they&apos;re ready.
                </div>
              </button>

              {/* One phone — the in-person, free-form flow */}
              <button
                onClick={() => handleFormatSelect('one-phone')}
                className="border border-gray-800 bg-gray-900 hover:bg-gray-800 rounded-xl p-5 text-left transition-colors"
              >
                <div className="font-semibold text-white mb-1">One Phone</div>
                <div className="text-sm text-gray-400">
                  In person, right now. Put one phone between you, argue it out loud, and
                  let the AI judge separate your voices and score it.
                </div>
              </button>

            </div>
          </div>
        )}

        {/* ── Step 2: Pick a topic area ── */}
        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold mb-2">Choose a topic area</h1>
            <p className="text-gray-400 mb-8">We&apos;ll generate debate resolutions based on your choice.</p>

            {loadingResolutions ? (
              <div className="text-center py-20 text-gray-400">
                Generating resolutions...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {TOPIC_AREAS.map((topic) => (
                  <button
                    key={topic}
                    onClick={() => handleTopicSelect(topic)}
                    className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl p-4 text-left font-medium transition-colors"
                  >
                    {topic}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Pick a resolution ── */}
        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold mb-2">Choose a resolution</h1>
            <p className="text-gray-400 mb-2">
              Topic: <span className="text-white">{selectedTopic}</span>
            </p>
            <p className="text-gray-500 text-sm mb-8">Pick one of these or write your own below.</p>

            <div className="flex flex-col gap-3 mb-6">
              {resolutions.map((resolution) => (
                <button
                  key={resolution}
                  onClick={() => handleResolutionSelect(resolution)}
                  className="bg-gray-900 hover:bg-gray-800 border border-gray-800 rounded-xl p-4 text-left transition-colors"
                >
                  {resolution}
                </button>
              ))}
            </div>

            {/* Custom resolution input */}
            <div className="border-t border-gray-800 pt-6">
              <p className="text-sm text-gray-500 mb-3">Or write your own resolution:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customResolution}
                  onChange={(e) => setCustomResolution(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCustomResolutionSubmit()}
                  placeholder="e.g. The U.S. should abolish the Electoral College"
                  className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-gray-500"
                />
                <button
                  onClick={handleCustomResolutionSubmit}
                  disabled={!customResolution.trim()}
                  className="bg-white text-gray-900 font-semibold px-4 py-3 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-40"
                >
                  Use this
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Pick a side ── */}
        {step === 4 && (
          <div>
            <h1 className="text-2xl font-bold mb-2">Pick your side</h1>
            <p className="text-gray-400 mb-1">Resolution:</p>
            <p className="text-white font-medium mb-8 bg-gray-900 rounded-xl px-4 py-3 border border-gray-800">
              {finalResolution}
            </p>

            <div className="flex flex-col gap-3 mb-8">
              {/* Affirmative — argues FOR the resolution */}
              <button
                onClick={() => setSelectedSide('affirmative')}
                className={`border rounded-xl p-4 text-left transition-colors ${
                  selectedSide === 'affirmative'
                    ? 'border-white bg-white/10'
                    : 'border-gray-800 bg-gray-900 hover:bg-gray-800'
                }`}
              >
                <div className="font-semibold mb-1">Affirmative</div>
                <div className="text-sm text-gray-400">You argue FOR the resolution</div>
              </button>

              {/* Negative — argues AGAINST the resolution */}
              <button
                onClick={() => setSelectedSide('negative')}
                className={`border rounded-xl p-4 text-left transition-colors ${
                  selectedSide === 'negative'
                    ? 'border-white bg-white/10'
                    : 'border-gray-800 bg-gray-900 hover:bg-gray-800'
                }`}
              >
                <div className="font-semibold mb-1">Negative</div>
                <div className="text-sm text-gray-400">You argue AGAINST the resolution</div>
              </button>

              {/* Random — system picks for them */}
              <button
                onClick={() => setSelectedSide('random')}
                className={`border rounded-xl p-4 text-left transition-colors ${
                  selectedSide === 'random'
                    ? 'border-white bg-white/10'
                    : 'border-gray-800 bg-gray-900 hover:bg-gray-800'
                }`}
              >
                <div className="font-semibold mb-1">Surprise me</div>
                <div className="text-sm text-gray-400">Randomly assign my side</div>
              </button>
            </div>

            <button
              onClick={handleCreateDebate}
              disabled={creating}
              className="w-full bg-white text-gray-900 font-semibold py-3 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-60"
            >
              {creating ? 'Creating debate...' : 'Create Debate →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
