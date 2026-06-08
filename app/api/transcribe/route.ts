import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createSupabaseServerClient } from '@/lib/supabase-server'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// POST /api/transcribe
// Accepts a speech audio file, uploads it to Supabase storage,
// transcribes it with Whisper, and saves the result to the speeches table.
export async function POST(request: Request) {
  // This client carries the signed-in user's JWT (read from cookies). We use it
  // for both the storage upload and the DB insert because:
  //  - The Storage API rejects the new sb_secret service-role key format
  //    ("Invalid Compact JWS"), but accepts a user JWT.
  //  - RLS policies (docs/schema.sql) already permit a participant to upload
  //    into their debate folder and insert their own speech row.
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Parse the multipart form data — audio file, debate ID, and round number
  const formData = await request.formData()
  const audioFile = formData.get('audio') as File
  const debateId = formData.get('debateId') as string
  const round = parseInt(formData.get('round') as string)

  if (!audioFile || !debateId || !round) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Derive the extension from the uploaded file so the stored object and Whisper
  // both see the right format (phones often send mp4, not webm).
  const ext = (audioFile.name.split('.').pop() || 'webm').toLowerCase()

  // Upload the audio file to Supabase private storage.
  // File path: speeches/{debateId}/{userId}-round{round}.{ext}
  // upsert: true so re-recording a round overwrites the previous take.
  const filePath = `${debateId}/${user.id}-round${round}.${ext}`
  const { error: uploadError } = await supabase.storage
    .from('speeches')
    .upload(filePath, audioFile, { upsert: true })

  if (uploadError) {
    console.error('[transcribe] upload failed:', uploadError)
    return NextResponse.json({ error: 'Failed to upload audio' }, { status: 500 })
  }

  // Transcribe the audio using OpenAI Whisper.
  // Whisper expects a File-like object with a name (extension) it recognizes.
  let transcription
  try {
    transcription = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-1',
    })
  } catch (err) {
    console.error('[transcribe] whisper failed:', err)
    return NextResponse.json({ error: 'Transcription failed' }, { status: 502 })
  }

  // Save the speech record with the audio path and transcript
  const { error: speechError } = await supabase
    .from('speeches')
    .insert({
      debate_id: debateId,
      user_id: user.id,
      round,
      audio_url: filePath,
      transcript: transcription.text,
    })

  if (speechError) {
    console.error('[transcribe] db insert failed:', speechError)
    return NextResponse.json({ error: 'Failed to save speech' }, { status: 500 })
  }

  return NextResponse.json({ transcript: transcription.text })
}
