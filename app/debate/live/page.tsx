'use client'

import { useRouter } from 'next/navigation'
import LiveRecorder from '@/components/LiveRecorder'

// One-phone (in-person) debate. Two people argue out loud while one phone records;
// the recording is diarized + judged at the end, then we jump to the verdict.
export default function LiveDebatePage() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-10">
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => router.push('/debate/new')}
          className="text-gray-500 hover:text-white text-sm mb-8 flex items-center gap-1 transition-colors"
        >
          ← Back
        </button>

        <h1 className="text-2xl font-bold mb-2">In-person debate</h1>
        <p className="text-gray-400 mb-6">
          Put the phone between you and your opponent, hit record, and argue it out.
          When you stop, an AI judge separates your two voices and scores the debate.
        </p>

        <ul className="text-sm text-gray-500 mb-8 flex flex-col gap-1.5">
          <li>• Take turns speaking so your voices stay distinct.</li>
          <li>• No topic needed — the judge figures out what you argued about.</li>
          <li>• Aim for a few minutes. Recording auto-stops at 5:00.</li>
        </ul>

        <LiveRecorder onComplete={(id) => router.push(`/debate/${id}/judge`)} />
      </div>
    </div>
  )
}
