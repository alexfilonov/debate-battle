'use client'

import { useState, useRef, useEffect } from 'react'

type RecorderState = 'idle' | 'recording' | 'submitting'

type Props = {
  // Called with the new debate id once the conversation is recorded + judged.
  onComplete: (debateId: string) => void
}

// Same cross-browser format detection as SpeechRecorder: Chrome/Firefox record
// WebM, but iOS Safari only does MP4. Pick the first supported type so recording
// works on every phone. AssemblyAI accepts all of these.
const MIME_CANDIDATES = ['audio/webm', 'audio/mp4', 'audio/ogg']

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

function extensionForMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

// Soft cap: auto-stop after 5 minutes so a forgotten recording can't run forever.
const MAX_SECONDS = 5 * 60

// LiveRecorder records one continuous in-person conversation on a single device,
// then sends it to /api/live-debate (diarize + judge) and reports the debate id.
export default function LiveRecorder({ onComplete }: Props) {
  const [state, setState] = useState<RecorderState>('idle')
  const [elapsed, setElapsed] = useState(0) // seconds recorded so far
  const [error, setError] = useState<string | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up the timer if the component unmounts mid-recording.
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  async function startRecording() {
    setError(null)

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {
      setError('Microphone access denied. Please allow mic access and try again.')
      return null
    })
    if (!stream) return

    const mimeType = pickSupportedMimeType()
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)
    mediaRecorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop()) // release the mic
      submitAudio()
    }

    recorder.start()
    setState('recording')

    // Count UP, and auto-stop at the soft cap.
    setElapsed(0)
    timerRef.current = setInterval(() => {
      setElapsed((prev) => {
        if (prev + 1 >= MAX_SECONDS) {
          clearInterval(timerRef.current!)
          recorder.stop()
          return MAX_SECONDS
        }
        return prev + 1
      })
    }, 1000)
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
  }

  async function submitAudio() {
    setState('submitting')

    // Build the file from the recorder's ACTUAL format (+ matching extension) so
    // the server gets a correctly-labeled file on every device.
    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
    const ext = extensionForMime(mimeType)
    const audioBlob = new Blob(chunksRef.current, { type: mimeType })
    const audioFile = new File([audioBlob], `live-debate.${ext}`, { type: mimeType })

    const form = new FormData()
    form.append('audio', audioFile)

    const res = await fetch('/api/live-debate', { method: 'POST', body: form })

    if (!res.ok) {
      // Surface the server's message (e.g. "couldn't separate two speakers").
      let message = 'Something went wrong. Please try again.'
      try {
        const body = await res.json()
        if (body.error) message = body.error
      } catch {}
      setError(message)
      setState('idle')
      setElapsed(0)
      return
    }

    const { debateId } = await res.json()
    onComplete(debateId)
  }

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {state === 'idle' && (
        <button
          onClick={startRecording}
          className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-4 px-6 rounded-xl transition-colors"
        >
          <span className="w-3 h-3 rounded-full bg-white" />
          Start Recording
        </button>
      )}

      {state === 'recording' && (
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-red-400">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium">Recording</span>
          </div>
          <div className="text-5xl font-mono font-bold text-white">{formatTime(elapsed)}</div>
          <p className="text-xs text-gray-500">Auto-stops at 5:00</p>
          <button
            onClick={stopRecording}
            className="mt-2 bg-white text-gray-900 font-semibold py-3 px-8 rounded-xl hover:bg-gray-100 transition-colors"
          >
            Stop &amp; Judge
          </button>
        </div>
      )}

      {state === 'submitting' && (
        <div className="text-center text-gray-400 py-6 flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-white border-t-transparent animate-spin" />
          Transcribing and judging your debate...
        </div>
      )}
    </div>
  )
}
