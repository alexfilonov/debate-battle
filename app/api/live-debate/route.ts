import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createSupabaseAdminClient } from '@/lib/supabase-admin'
import { diarizeConversation } from '@/lib/assembly'
import { judgeLiveDebate } from '@/lib/judge-live'

// This route does AssemblyAI diarization + a Claude judging call back-to-back, so
// it needs the Node runtime and generous headroom. A full 5-min recording can
// take 1-2 min to diarize + ~60s to judge, so 120s was too short. 300s is the
// Vercel platform max and gives us room to spare.
export const runtime = 'nodejs'
export const maxDuration = 300

// POST /api/live-debate
// One-phone (in-person) debate flow, all in one synchronous request:
//   audio upload -> AssemblyAI diarization -> Claude judges -> save -> return id.
// The audio is never persisted (option A): we stream the bytes to AssemblyAI for
// transcription and discard them.
export async function POST(request: Request) {
  // Identify the phone-holder. They're the only logged-in user; the "opponent" is
  // just an anonymous diarized voice with no account.
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const audioFile = formData.get('audio') as File
  if (!audioFile) {
    return NextResponse.json({ error: 'Missing audio' }, { status: 400 })
  }

  const buffer = Buffer.from(await audioFile.arrayBuffer())

  // 1. Diarize: split the recording into two distinct voices.
  let segments
  try {
    segments = await diarizeConversation(buffer)
  } catch (err) {
    console.error('[live-debate] diarization failed:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 502 })
  }

  // Graceful guard: if we couldn't pick out two separate speakers (one person
  // dominated, heavy overlap, or noise), there's no debate to judge.
  const speakers = new Set(segments.map((s) => s.speaker))
  if (speakers.size < 2 || segments.length === 0) {
    return NextResponse.json(
      { error: "Couldn't clearly separate two speakers. Try recording again with each person speaking in turn." },
      { status: 422 }
    )
  }

  // 2. Judge the unstructured conversation with the length-neutral rubric.
  let verdict
  try {
    verdict = await judgeLiveDebate(segments)
  } catch (err) {
    console.error('[live-debate] judging failed:', err)
    return NextResponse.json({ error: 'Judging failed. Please try again.' }, { status: 502 })
  }

  // 3. Persist via the service-role client. There are no participant rows in this
  //    mode, so all writes go through the admin client (which bypasses RLS); the
  //    holder reads the result back through the created_by RLS policy.
  const admin = createSupabaseAdminClient()

  // Store the inferred topic as the resolution so dashboards/list views show a
  // title for one-phone debates too.
  const { data: debate, error: debateError } = await admin
    .from('debates')
    .insert({
      format: 'one_phone',
      topic_area: 'In-person',
      resolution: verdict.topic,
      status: 'complete',
      created_by: user.id,
    })
    .select()
    .single()

  if (debateError || !debate) {
    console.error('[live-debate] debate insert failed:', debateError)
    return NextResponse.json({ error: 'Failed to save debate' }, { status: 500 })
  }

  const { error: resultError } = await admin
    .from('live_results')
    .insert({
      debate_id: debate.id,
      transcript: segments,
      inferred_topic: verdict.topic,
      winner: verdict.winner,
      verdict,
    })

  if (resultError) {
    console.error('[live-debate] live_results insert failed:', resultError)
    return NextResponse.json({ error: 'Failed to save result' }, { status: 500 })
  }

  return NextResponse.json({ debateId: debate.id })
}
