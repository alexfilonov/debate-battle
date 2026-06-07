# Debate Battle

A full-stack debate app where two users record speeches on a topic, and an AI judge analyzes and scores the debate.

## Stack
- **Frontend:** Next.js 16 + React + Tailwind CSS
- **Auth & Database:** Supabase (Google OAuth + PostgreSQL)
- **Storage:** Supabase private storage bucket (`speeches`) for audio files
- **Transcription:** OpenAI Whisper API (server-side via Next.js API routes)
- **AI Judge:** Anthropic Claude API (server-side via Next.js API routes)
- **Deployment:** Vercel (planned)

## Architecture
- No separate backend — all server-side logic runs in Next.js API routes
- Async debate flow: User 1 records first, User 2 responds later
- Users join via shared link (no matchmaking)
- Google login + allowlist table controls who can access the app
- Audio stored in Supabase private storage, transcribed server-side
- Claude judges debates after all speeches are submitted

## Debate flow
1. User 1 creates a debate → picks topic area → picks or writes a resolution → shares link
2. User 2 joins via link → assigned opposite side
3. Both users record a 2-minute opening speech (async)
4. Both users read each other's transcripts
5. Both users record a 2-minute rebuttal speech
6. Claude judges all transcripts → verdict + individual feedback shown to each debater

## Folder structure
```
app/
  page.tsx              # landing page
  auth/                 # Google login callback
  debate/
    new/                # create debate flow
    [id]/               # debate room
    [id]/judge/         # results page
components/             # shared UI components
lib/
  supabase.ts           # Supabase client + TypeScript types
  whisper.ts            # Whisper transcription helper
  judge.ts              # Claude judging helper
docs/
  schema.sql            # full database schema
  decisions.md          # architecture decision log
```

## Database tables
- `allowlist` — approved emails
- `debates` — debate sessions (topic, resolution, status)
- `debate_participants` — which user is on which side
- `speeches` — audio URL + transcript per round per user
- `judgements` — AI judge verdict and feedback

## Environment variables
All in `.env.local` (gitignored):
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`

## Product decisions
- Topic areas (fixed list): U.S. Politics, International Politics, Economics, Technology, Science, Philosophy, Sports, Culture
- Resolutions: Claude generates 5 instantly when user picks a topic area (no "Generate" button)
- Side assignment: random if user has no preference; User 2 always gets the opposite side
- Debate has 2 rounds: opening speech + rebuttal (async — each user records independently)
- No internet access for AI judge or resolution generation (v2 feature)

## Development conventions
- Ask clarifying questions before building any new feature or page
- Explain what each file/concept does when introducing something new
- Write comments throughout code so the developer can follow along
- Use Server Components by default; only add 'use client' when handling events or browser APIs

## Important notes
- Next.js 16 has breaking changes from v15 — use Context7 for up-to-date docs. middleware.ts is now proxy.ts, export function name is `proxy` not `middleware`
- RLS (Row Level Security) is enabled on all tables — check policies in docs/schema.sql
- Must GRANT SELECT privileges explicitly: `GRANT SELECT ON public.<table> TO authenticated, service_role`
- Audio bucket (`speeches`) is private — always use signed URLs to serve audio
- Skip tests for now — early stage project
- Service role key is in SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix — server only)
