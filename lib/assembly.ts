import { AssemblyAI } from 'assemblyai'
import type { LiveSegment } from '@/lib/supabase'

// AssemblyAI client. The pre-recorded API takes the RAW key (no Bearer prefix);
// the SDK handles auth for us. SERVER ONLY — the key must never reach the browser.
const client = new AssemblyAI({ apiKey: process.env.ASSEMBLYAI_API_KEY! })

// Transcribe a recorded conversation and split it into two distinct voices.
//
// We use AssemblyAI's PRE-RECORDED transcription (not the real-time Voice Agent
// API — see docs/assemblyai-voice-agent.md). `speaker_labels: true` turns on
// speaker diarization, and `speakers_expected: 2` tells it to expect exactly two
// people, which improves accuracy for our one-phone, two-person debates.
//
// Returns the diarized utterances in order: [{ speaker: 'A'|'B', text }, ...].
// The audio itself is never persisted — we upload the bytes, get the transcript,
// and the upload is discarded by AssemblyAI.
export async function diarizeConversation(audio: Buffer): Promise<LiveSegment[]> {
  // 1. Upload the raw audio bytes; AssemblyAI returns a temporary URL to them.
  const uploadUrl = await client.files.upload(audio)

  // 2. Transcribe with diarization. transcribe() submits the job and polls until
  //    it's done, so we get the finished transcript back in one call.
  //
  // language_detection: true — lets AssemblyAI detect each utterance's language
  // independently instead of forcing the whole recording into one language. This
  // handles mixed-language debates (e.g. one speaker in Russian, one in English)
  // without translating either side's words.
  const transcript = await client.transcripts.transcribe({
    audio: uploadUrl,
    speaker_labels: true,
    speakers_expected: 2,
    language_detection: true,
  })

  if (transcript.status === 'error') {
    throw new Error(`AssemblyAI transcription failed: ${transcript.error}`)
  }

  // 3. utterances is the per-speaker breakdown. Each carries a `speaker` label
  //    ('A', 'B', ...) and the spoken `text`.
  const utterances = transcript.utterances ?? []
  return utterances.map((u) => ({ speaker: u.speaker, text: u.text }))
}
