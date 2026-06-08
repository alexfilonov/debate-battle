'use client'

import { useState, useRef, useEffect } from 'react'

type RecorderState = 'idle' | 'recording' | 'submitting' | 'done'

type Props = {
  debateId: string
  round: number
  onSubmitted: (transcript: string) => void
}

// Browsers disagree on audio formats: Chrome/Firefox record WebM, but iOS Safari
// only records MP4. Pick the first format the current device supports so
// recording works on every phone/browser. Whisper accepts all of these.
const MIME_CANDIDATES = ['audio/webm', 'audio/mp4', 'audio/ogg']

function pickSupportedMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

// Map a MIME type to the file extension Whisper expects.
function extensionForMime(mime: string): string {
  if (mime.includes('mp4')) return 'mp4'
  if (mime.includes('ogg')) return 'ogg'
  return 'webm'
}

// SpeechRecorder handles the full recording flow:
// 1. User clicks record → mic starts, 2-minute countdown begins
// 2. Timer hits 0 OR user clicks stop → recording ends automatically
// 3. Audio is sent to /api/transcribe → saved to Supabase + transcribed
// Once submitted, the component locks and shows the transcript.
export default function SpeechRecorder({ debateId, round, onSubmitted }: Props) {
  const [state, setState] = useState<RecorderState>('idle')
  const [timeLeft, setTimeLeft] = useState(120) // 2 minutes in seconds
  const [error, setError] = useState<string | null>(null)

  // Refs hold mutable values that don't trigger re-renders
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  // Clean up timer when component unmounts
  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  async function startRecording() {
    setError(null)

    // Request microphone access from the browser
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => {
      setError('Microphone access denied. Please allow mic access and try again.')
      return null
    })
    if (!stream) return

    // Set up the MediaRecorder using a format this browser actually supports
    // (iOS Safari can't do WebM); fall back to the browser default if needed.
    const mimeType = pickSupportedMimeType()
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType })
      : new MediaRecorder(stream)
    mediaRecorderRef.current = recorder
    chunksRef.current = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    // When recording stops (either manually or by timer), submit the audio
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop()) // release mic
      submitAudio()
    }

    recorder.start()
    setState('recording')

    // Start the 2-minute countdown
    setTimeLeft(120)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Time's up — stop the recording automatically
          clearInterval(timerRef.current!)
          recorder.stop()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
  }

  async function submitAudio() {
    setState('submitting')

    // Build the file from the recorder's ACTUAL format (+ matching extension),
    // so the server and Whisper get a correctly-labeled file on every device.
    const mimeType = mediaRecorderRef.current?.mimeType || 'audio/webm'
    const ext = extensionForMime(mimeType)
    const audioBlob = new Blob(chunksRef.current, { type: mimeType })
    const audioFile = new File([audioBlob], `speech-round${round}.${ext}`, { type: mimeType })

    // Send to our transcription API route
    const form = new FormData()
    form.append('audio', audioFile)
    form.append('debateId', debateId)
    form.append('round', String(round))

    const res = await fetch('/api/transcribe', { method: 'POST', body: form })

    if (!res.ok) {
      setError('Failed to submit speech. Please try again.')
      setState('idle')
      return
    }

    const { transcript } = await res.json()
    setState('done')
    onSubmitted(transcript)
  }

  // Format seconds as M:SS (e.g. 90 → "1:30")
  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (state === 'done') {
    return (
      <div className="bg-green-900/20 border border-green-800 rounded-xl px-4 py-3 text-green-400 text-sm">
        ✓ Speech submitted
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {state === 'idle' && (
        <button
          onClick={startRecording}
          className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          <span className="w-3 h-3 rounded-full bg-white" />
          Start Recording
        </button>
      )}

      {state === 'recording' && (
        <div className="flex flex-col items-center gap-4">
          {/* Pulsing red dot to show recording is active */}
          <div className="flex items-center gap-2 text-red-400">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-medium">Recording</span>
          </div>

          {/* Countdown timer */}
          <div className={`text-4xl font-mono font-bold ${timeLeft <= 30 ? 'text-red-400' : 'text-white'}`}>
            {formatTime(timeLeft)}
          </div>

          <button
            onClick={stopRecording}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-6 rounded-xl transition-colors"
          >
            Stop & Submit
          </button>
        </div>
      )}

      {state === 'submitting' && (
        <div className="text-center text-gray-400 py-4">
          Transcribing your speech...
        </div>
      )}
    </div>
  )
}
