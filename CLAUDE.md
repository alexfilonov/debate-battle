# Debate Battle

A full-stack debate app where users debate a topic and an AI judge analyzes and scores it. There are two debate modes:
- **Two-phone (async, structured):** two users record timed opening + rebuttal speeches on their own devices, on a chosen resolution. The original flow.
- **One-phone (in-person, free-form):** two people argue out loud next to each other while one phone records. The recording is diarized into two voices and judged at the end. No topic/resolution/side is chosen up front — the judge infers all of it.

## Stack
- **Frontend:** Next.js 16 + React + Tailwind CSS
- **Auth & Database:** Supabase (Google OAuth + PostgreSQL)
- **Storage:** Supabase private storage bucket (`speeches`) for audio files
- **Transcription:** OpenAI Whisper API (server-side via Next.js API routes)
- **AI Judge:** Anthropic Claude API (server-side via Next.js API routes)
- **Deployment:** Vercel (planned)

## Architecture
- No separate backend — all server-side logic runs in Next.js API routes
- Google login + allowlist table controls who can access the app
- `debates.format` (`'two_phone' | 'one_phone'`) distinguishes the two modes
- Two-phone: async (User 1 records first, User 2 responds later), users join via shared link (no matchmaking), audio stored in Supabase private storage + transcribed server-side, Claude judges after all speeches are submitted
- One-phone: single continuous recording posted to one API route that diarizes (AssemblyAI) + judges (Claude) in one shot, then redirects to the verdict. Audio is discarded after transcription — only the transcript + verdict are stored.

## Debate flow — two-phone (async, structured)
1. User 1 creates a debate → picks topic area → picks or writes a resolution → shares link
2. User 2 joins via link → assigned opposite side
3. Both users record a 2-minute opening speech (async)
4. Both users read each other's transcripts
5. Both users record a 2-minute rebuttal speech
6. Claude judges all transcripts → verdict + individual feedback shown to each debater

## Debate flow — one-phone (in-person, free-form)
1. User picks the One Phone format on `/debate/new` → routed to `/debate/live`
2. Both people argue out loud while one phone records a single continuous take (auto-stops at 5:00)
3. On stop, the recording posts to `/api/live-debate`: AssemblyAI diarizes it into two voices (`speaker_labels`, `speakers_expected: 2`)
4. Claude infers the topic, maps each voice to pro/con, and scores both sides with a length-neutral rubric (talking more ≠ more points)
5. Result is saved to `live_results`; user is redirected to `/debate/[id]/judge`, which renders the one-phone verdict view

## Folder structure
```
app/
  page.tsx              # landing page
  auth/                 # Google login callback
  debate/
    new/                # create debate flow (step 1 = pick format)
    live/               # one-phone (in-person) recording screen
    [id]/               # two-phone debate room
    [id]/judge/         # results page (branches on format: two-phone vs one-phone verdict)
  api/
    live-debate/        # one-phone: diarize (AssemblyAI) + judge (Claude) in one route
components/
  SpeechRecorder.tsx    # two-phone timed speech recorder
  LiveRecorder.tsx      # one-phone continuous recorder → /api/live-debate
  LiveVerdict.tsx       # one-phone verdict view (pro/con, scores, transcript)
lib/
  supabase.ts           # Supabase client + TypeScript types (incl. one-phone types)
  whisper.ts            # Whisper transcription helper (two-phone)
  judge.ts              # Claude judging helper (two-phone)
  assembly.ts           # AssemblyAI speaker diarization helper (one-phone)
  judge-live.ts         # Claude length-neutral judging helper (one-phone)
docs/
  schema.sql            # full database schema
  decisions.md          # architecture decision log
```

## Database tables
- `allowlist` — approved emails
- `debates` — debate sessions; `format` ('two_phone' | 'one_phone'), `topic_area`/`resolution` (nullable — null for one-phone), `status`
- `debate_participants` — which user is on which side (two-phone only)
- `speeches` — audio URL + transcript per round per user (two-phone only)
- `judgements` — AI judge verdict and feedback (two-phone only)
- `live_results` — one-phone only: diarized `transcript`, `inferred_topic`, `winner` (pro/con), and `verdict` JSON. One row per debate, keyed by `debate_id`. Visible only to the debate's creator (RLS).

## Environment variables
All in `.env.local` (gitignored):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `ASSEMBLYAI_API_KEY` — speaker-diarized transcription for one-phone (in-person) debates

## Product decisions
- Topic areas (fixed list): U.S. Politics, International Politics, Economics, Technology, Science, Philosophy, Sports, Culture
- Resolutions: Claude generates 5 instantly when user picks a topic area (no "Generate" button)
- Side assignment (two-phone): random if user has no preference; User 2 always gets the opposite side
- Debate has 2 rounds (two-phone): opening speech + rebuttal (async — each user records independently)
- One-phone: no topic/resolution/side picked up front — the judge infers the topic and assigns each diarized voice to pro/con
- One-phone judging is length-neutral: speaking more does not earn more points (5 criteria — argument, evidence, responsiveness, consistency, persuasiveness)
- One-phone recording is processed at the end (record-then-judge), and audio is discarded after transcription (only transcript + verdict are kept)
- No internet access for AI judge or resolution generation (v2 feature)

## Development conventions
- Ask clarifying questions before building any new feature or page
- Explain what each file/concept does when introducing something new
- Write comments throughout code so the developer can follow along
- Use Server Components by default; only add 'use client' when handling events or browser APIs

## Important notes
- Next.js 16 has breaking changes from v15 — use Context7 for up-to-date docs. middleware.ts is now proxy.ts, export function name is `proxy` not `middleware`
- AssemblyAI: always fetch https://www.assemblyai.com/docs/llms.txt before writing AssemblyAI code — their parameter names change, don't rely on memory. Pre-recorded and Streaming products use the raw API key (no `Bearer` prefix); only the Voice Agent API uses `Bearer`. The one-phone (in-person) debate mode uses the **pre-recorded transcription API with speaker diarization** (`speaker_labels`), NOT the Voice Agent API. Reference: docs/assemblyai-voice-agent.md
- RLS (Row Level Security) is enabled on all tables — check policies in docs/schema.sql
- Must GRANT SELECT privileges explicitly: `GRANT SELECT ON public.<table> TO authenticated, service_role`
- Audio bucket (`speeches`) is private — always use signed URLs to serve audio
- Skip tests for now — early stage project
- Service role key is in SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix — server only)
