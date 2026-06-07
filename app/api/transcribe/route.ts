import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

// POST /api/transcribe
// Accepts a speech audio file, uploads it to Supabase storage,
// transcribes it with Whisper, and saves the result to the speeches table.
export async function POST(request: Request) {
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

  // Upload the audio file to Supabase private storage
  // File path: speeches/{debateId}/{userId}-round{round}.webm
  const filePath = `${debateId}/${user.id}-round${round}.webm`
  const { error: uploadError } = await supabase.storage
    .from('speeches')
    .upload(filePath, audioFile, { upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: 'Failed to upload audio' }, { status: 500 })
  }

  // Transcribe the audio using OpenAI Whisper
  // Whisper expects a File-like object with a name property
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
  })

  // Use service role to bypass RLS for inserting the speech record
  const cookieStore = await cookies()
  const adminClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )

  // Save the speech record with the audio path and transcript
  const { error: speechError } = await adminClient
    .from('speeches')
    .insert({
      debate_id: debateId,
      user_id: user.id,
      round,
      audio_url: filePath,
      transcript: transcription.text,
    })

  if (speechError) {
    return NextResponse.json({ error: 'Failed to save speech' }, { status: 500 })
  }

  return NextResponse.json({ transcript: transcription.text })
}
