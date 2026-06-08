import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Single shared Supabase client instance for the app
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// TypeScript types matching our database schema
export type DebateStatus = 'waiting' | 'in_progress' | 'complete'
export type Side = 'affirmative' | 'negative'

export type Debate = {
  id: string
  topic_area: string
  resolution: string
  status: DebateStatus
  created_by: string
  created_at: string
}

export type DebateParticipant = {
  id: string
  debate_id: string
  user_id: string
  side: Side
}

export type Speech = {
  id: string
  debate_id: string
  user_id: string
  round: number
  audio_url: string | null
  transcript: string | null
  created_at: string
}

export type Judgement = {
  id: string
  debate_id: string
  winner: Side
  reasoning: string
  affirmative_feedback: string
  negative_feedback: string
  // Per-category 1-10 scores set by the AI judge. Nullable because judgements
  // created before scores existed don't have them.
  aff_argumentation: number | null
  aff_evidence: number | null
  aff_rebuttal: number | null
  neg_argumentation: number | null
  neg_evidence: number | null
  neg_rebuttal: number | null
  created_at: string
}
