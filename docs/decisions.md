# Architecture Decisions

## Stack
- Next.js 16 + Tailwind CSS (frontend)
- Supabase (auth, database, storage)
- OpenAI Whisper API (speech-to-text transcription)
- Anthropic Claude API (AI judge)
- No separate backend — Next.js API routes handle server-side logic

## Key decisions
- **Async debate flow** — User 1 records, User 2 responds later. Real-time to be added in v2.
- **Room sharing via link** — User 1 creates a debate, shares a unique URL with User 2.
- **Google login + allowlist** — Google OAuth via Supabase auth, access controlled by an allowlist table in the DB.
- **Speech-to-text** — OpenAI Whisper. Audio stored in Supabase private storage bucket, transcribed server-side via Next.js API route.
- **Two rounds** — Opening speech (round 1) + rebuttal (round 2). Both sides record independently.
- **AI judge** — Claude analyzes both transcripts after all speeches are submitted. Evaluates logic, accuracy, and reasoning quality.
- **No internet access for judge** — Claude uses training data only for judging. Resolution generation also uses training data (Tavily web search planned for v2).
